import type {
  CommentCreateDefinition,
  CommentDeleteDefinition,
  TriggerContext,
} from "@devvit/public-api";
import {
  assessAccount,
  compactReportReason,
  evaluationSignature,
  HISTORY_LIMIT,
  LOCAL_SUBREDDIT,
  shouldReport,
  type Assessment,
  type HistoryItem,
} from "../botTriage/scoring.js";
import { readTriageSettings } from "../botTriage/settings.js";

const DAY_MS = 86_400_000;
const CASE_RETENTION_MS = 14 * DAY_MS;
const REPORT_COOLDOWN_MS = 7 * DAY_MS;
const EVALUATION_THROTTLE_MS = 15 * 60_000;
const caseKey = (commentId: string) => `seabot:triage:case:${commentId}`;
const expiresIn = (ms: number) => new Date(Date.now() + ms);

interface CaseRecord {
  commentId: string;
  assessedAt: string;
  assessment: Assessment;
  action:
    | "evaluated"
    | "reported"
    | "cooldown"
    | "suppressed_daily_cap"
    | "report_failed";
}

async function evaluateComment(
  commentId: string,
  context: TriggerContext,
): Promise<void> {
  const { reddit, redis, settings } = context;
  // Includes deletion tombstones, so a delayed create cannot restore deleted data.
  if (await redis.get(caseKey(commentId))) return;
  const comment = await reddit.getCommentById(commentId);
  if (
    comment.subredditName.toLowerCase() !== LOCAL_SUBREDDIT ||
    comment.removed ||
    comment.spam ||
    comment.approved
  )
    return;
  const username = comment.authorName;
  const userKey = username?.toLowerCase();
  if (
    !userKey ||
    [
      "[deleted]",
      "automoderator",
      `${LOCAL_SUBREDDIT}-modteam`,
      context.appName.toLowerCase(),
    ].includes(userKey)
  )
    return;

  // Read one settings snapshot. Invalid configuration fails before any claims or reports.
  const { config, options } = readTriageSettings(await settings.getAll());
  const recentKey = `seabot:triage:recent:${evaluationSignature(config, options)}:${userKey}`;
  if (
    (await redis.set(recentKey, "1", {
      nx: true,
      expiration: expiresIn(EVALUATION_THROTTLE_MS),
    })) !== "OK"
  )
    return;

  // Age and username shape are scoring signals, never prefilters.
  let createdAtMs: number | null = null;
  try {
    const user = await reddit.getUserByUsername(username);
    createdAtMs = user?.createdAt.getTime() ?? null;
  } catch {
    console.warn("SeaBot triage: account age unavailable");
  }
  let historyAvailable = true;
  let history: HistoryItem[] = [];
  try {
    const listing = await reddit
      .getCommentsAndPostsByUser({
        username,
        sort: "new",
        limit: HISTORY_LIMIT,
      })
      .get(HISTORY_LIMIT);
    history = listing.map((item) => ({
      id: item.id,
      subreddit: item.subredditName,
    }));
  } catch {
    historyAvailable = false;
    // A later comment can retry sooner after a transient history failure.
    await redis.expire(recentKey, 120);
    console.warn("SeaBot triage: history unavailable");
  }

  const assessment = assessAccount({
    username,
    createdAtMs,
    historyAvailable,
    history,
    nowMs: Date.now(),
    config,
  });
  const record: CaseRecord = {
    commentId,
    assessedAt: new Date().toISOString(),
    assessment,
    action: "evaluated",
  };
  if (await redis.get(caseKey(commentId))) return;

  if (shouldReport(assessment, options)) {
    const claimKey = `seabot:triage:report:${userKey}`;
    if (await redis.get(claimKey)) {
      record.action = "cooldown";
    } else if (options.dailyReportCap === 0) {
      record.action = "suppressed_daily_cap";
    } else {
      const day = new Date().toISOString().slice(0, 10);
      const budgetKey = `seabot:triage:daily:${day}`;
      // Initialize with a TTL atomically; failures/races may spend a slot, never exceed the cap.
      await redis.set(budgetKey, "0", {
        nx: true,
        expiration: expiresIn(2 * DAY_MS),
      });
      const attempt = await redis.incrBy(budgetKey, 1);
      if (attempt > options.dailyReportCap) {
        record.action = "suppressed_daily_cap";
      } else if (
        (await redis.set(claimKey, "1", {
          nx: true,
          expiration: expiresIn(REPORT_COOLDOWN_MS),
        })) !== "OK"
      ) {
        record.action = "cooldown";
      } else {
        // Deletion can arrive while the budget/cooldown calls are in flight.
        if (await redis.get(caseKey(commentId))) return;
        try {
          await reddit.report(comment, {
            reason: compactReportReason(assessment),
          });
          record.action = "reported";
        } catch {
          // Keep the claim: Reddit may have accepted a report whose response was lost.
          record.action = "report_failed";
          console.error("SeaBot triage: report failed; cooldown retained");
        }
      }
    }
  }

  // One final write cannot overwrite a deletion that arrived during evaluation/reporting.
  const saved = await redis.set(caseKey(commentId), JSON.stringify(record), {
    nx: true,
    expiration: expiresIn(CASE_RETENTION_MS),
  });
  if (saved === "OK") {
    // Shadow-mode distributions without exporting account identifiers or history.
    console.log(
      "SeaBot triage",
      JSON.stringify({
        tier: assessment.tier,
        score: assessment.score,
        dataQuality: assessment.dataQuality,
        action: record.action,
      }),
    );
  }
}

export const TriageComment: CommentCreateDefinition = {
  event: "CommentCreate",
  onEvent: async (event, context) => {
    if (
      context.subredditName?.toLowerCase() !== LOCAL_SUBREDDIT ||
      !event.comment?.id?.startsWith("t1_")
    )
      return;
    try {
      await evaluateComment(event.comment.id, context);
    } catch {
      console.error(
        "SeaBot triage: evaluation failed; check settings and service availability",
      );
    }
  },
};

export const DeleteTriageCase: CommentDeleteDefinition = {
  event: "CommentDelete",
  onEvent: async (event, context) => {
    if (
      context.subredditName?.toLowerCase() !== LOCAL_SUBREDDIT ||
      !event.commentId?.startsWith("t1_")
    )
      return;
    // Keep only the comment ID and a marker, including when delete precedes create.
    // Let storage errors propagate so deletion can be retried by Devvit.
    await context.redis.set(caseKey(event.commentId), "deleted", {
      expiration: expiresIn(CASE_RETENTION_MS),
    });
  },
};
