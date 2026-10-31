import type {
  Comment,
  CommentCreateDefinition,
  CommentDeleteDefinition,
  TriggerContext,
} from "@devvit/public-api";
import {
  detectNetwork,
  reportReason,
  type Detection,
} from "../botTriage/detector.js";
import { getRecentHistory } from "../botTriage/history.js";
import { readTriageSettings } from "../botTriage/settings.js";

const SUBREDDIT = "seattle";
const DAY_MS = 86_400_000;
const COMMENT_RETENTION_MS = 14 * DAY_MS;
const REPORT_COOLDOWN_MS = 7 * DAY_MS;
const EVALUATION_THROTTLE_MS = 15 * 60_000;
const commentKey = (id: string) => `seabot:triage:comment:${id}`;
const expiresIn = (ms: number) => new Date(Date.now() + ms);

async function reportComment(
  comment: Comment,
  detection: Detection,
  dailyCap: number,
  { redis, reddit }: TriggerContext,
): Promise<string | undefined> {
  if (!detection.matched) return "not_matched";
  const claimKey = `seabot:triage:report:${comment.authorName.toLowerCase()}`;
  if (await redis.get(claimKey)) return "cooldown";
  if (dailyCap === 0) return "daily_cap";

  const budgetKey = `seabot:triage:daily:${new Date().toISOString().slice(0, 10)}`;
  await redis.set(budgetKey, "0", {
    nx: true,
    expiration: expiresIn(2 * DAY_MS),
  });
  const attempt = await redis.incrBy(budgetKey, 1);
  let reportAttempted = false;
  try {
    if (attempt > dailyCap) return "daily_cap";
    // Complete cancellation checks before taking the seven-day report claim.
    if (await redis.get(commentKey(comment.id))) return;
    const reason = reportReason(detection);
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
      return "report_failed";
    }
  } finally {
    // Definite skips release their slot so denied requests cannot exhaust a raised cap.
    if (!reportAttempted) await redis.incrBy(budgetKey, -1);
  }
}

async function evaluateComment(
  commentId: string,
  context: TriggerContext,
): Promise<void> {
  const { reddit, redis, settings } = context;
  const options = readTriageSettings(await settings.getAll());
  if (!options.enabled || (await redis.get(commentKey(commentId)))) return;
  const comment = await reddit.getCommentById(commentId);
  if (
    comment.subredditName.toLowerCase() !== SUBREDDIT ||
    comment.removed ||
    comment.spam ||
    comment.approved
  )
    return;
  const userKey = comment.authorName?.toLowerCase();
  if (
    !userKey ||
    [
      "[deleted]",
      "automoderator",
      `${SUBREDDIT}-modteam`,
      context.appName.toLowerCase(),
    ].includes(userKey)
  )
    return;

  // A cap change permits a new evaluation without resetting the report cooldown.
  const recentKey = `seabot:triage:recent:${options.dailyReportCap}:${userKey}`;
  if (
    (await redis.set(recentKey, "1", {
      nx: true,
      expiration: expiresIn(EVALUATION_THROTTLE_MS),
    })) !== "OK"
  )
    return;
  let history;
  try {
    history = await getRecentHistory(reddit, comment);
  } catch {
    // Later comments can retry sooner after a transient history failure.
    await redis.expire(recentKey, 120);
    console.warn("SeaBot triage: history unavailable; no report submitted");
    return;
  }
  const detection = detectNetwork(history, comment.createdAt.getTime());
  const action = await reportComment(
    comment,
    detection,
    options.dailyReportCap,
    context,
  );
  if (action === undefined) return;

  // Store only a deduplication marker. NX prevents an in-flight evaluation from
  // replacing a deletion tombstone; account history and derived evidence stay in memory.
  const saved = await redis.set(commentKey(commentId), "processed", {
    nx: true,
    expiration: expiresIn(COMMENT_RETENTION_MS),
  });
  if (saved === "OK") console.log("SeaBot triage", action);
}

export const TriageComment: CommentCreateDefinition = {
  event: "CommentCreate",
  onEvent: async (event, context) => {
    if (
      context.subredditName?.toLowerCase() !== SUBREDDIT ||
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

export const DeleteTriageComment: CommentDeleteDefinition = {
  event: "CommentDelete",
  onEvent: async (event, context) => {
    if (
      context.subredditName?.toLowerCase() !== SUBREDDIT ||
      !event.commentId?.startsWith("t1_")
    )
      return;
    // A delete can precede a delayed create. Propagate storage failures for retry.
    await context.redis.set(commentKey(event.commentId), "deleted", {
      expiration: expiresIn(COMMENT_RETENTION_MS),
    });
  },
};
