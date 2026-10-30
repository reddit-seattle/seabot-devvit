import type {
  Comment,
  CommentCreateDefinition,
  CommentDeleteDefinition,
  TriggerContext,
} from "@devvit/public-api";
import {
  assessAccount,
  compactReportReason,
  evaluationSignature,
  LOCAL_SUBREDDIT,
  shouldReport,
  type Assessment,
  type HistoryItem,
  type ReportOptions,
} from "../botTriage/scoring.js";
import { readTriageSettings } from "../botTriage/settings.js";
import { getRecentHistory } from "../botTriage/history.js";

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

async function reportComment(
  comment: Comment,
  assessment: Assessment,
  options: ReportOptions,
  { redis, reddit }: TriggerContext,
): Promise<CaseRecord["action"] | undefined> {
  if (!shouldReport(assessment, options)) return "evaluated";
  const claimKey = `seabot:triage:report:${comment.authorName.toLowerCase()}`;
  if (await redis.get(claimKey)) return "cooldown";
  if (options.dailyReportCap === 0) return "suppressed_daily_cap";

  const day = new Date().toISOString().slice(0, 10);
  const budgetKey = `seabot:triage:daily:${day}`;
  await redis.set(budgetKey, "0", {
    nx: true,
    expiration: expiresIn(2 * DAY_MS),
  });
  const attempt = await redis.incrBy(budgetKey, 1);
  let reportAttempted = false;
  try {
    if (attempt > options.dailyReportCap) return "suppressed_daily_cap";
    // Finish cancellation checks before taking the seven-day report claim.
    if (await redis.get(caseKey(comment.id))) return;
    const reason = compactReportReason(assessment);
    if (
      (await redis.set(claimKey, "1", {
        nx: true,
        expiration: expiresIn(REPORT_COOLDOWN_MS),
      })) !== "OK"
    )
      return "cooldown";

    reportAttempted = true;
    try {
      await reddit.report(comment, { reason });
      return "reported";
    } catch {
      // Reddit may have accepted a report whose response was lost. Keep both reservations.
      console.error("SeaBot triage: report failed; cooldown retained");
      return "report_failed";
    }
  } finally {
    // Only requests sent to Reddit consume budget; definite skips/errors release their slot.
    if (!reportAttempted) await redis.incrBy(budgetKey, -1);
  }
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
    history = await getRecentHistory(reddit, username);
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
  const action = await reportComment(comment, assessment, options, context);
  if (action === undefined) return;
  const record: CaseRecord = {
    commentId,
    assessedAt: new Date().toISOString(),
    assessment,
    action,
  };

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
