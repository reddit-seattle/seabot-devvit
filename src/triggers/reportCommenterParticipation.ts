import type {
  CommentCreateDefinition,
  CommentDeleteDefinition,
  TriggerContext,
} from "@devvit/public-api";
import { getParticipationMatches } from "../utils/participation.js";

const DAY_MS = 86_400_000;
const caseKey = (id: string) => `seabot:triage:case:${id}`;
const expiresIn = (ms: number) => new Date(Date.now() + ms);

async function evaluateComment(
  id: string,
  context: TriggerContext,
): Promise<void> {
  const { reddit, redis, settings } = context;
  const enabled = await settings.get("botTriageReportsEnabled");
  if (enabled !== undefined && enabled !== true) return;
  if (await redis.get(caseKey(id))) return;
  const comment = await reddit.getCommentById(id);
  const username = comment.authorName?.toLowerCase();
  if (
    comment.subredditName.toLowerCase() !== "seattle" ||
    comment.removed ||
    comment.spam ||
    comment.approved ||
    comment.ignoringReports ||
    !username ||
    [
      "[deleted]",
      "automoderator",
      "seattle-modteam",
      context.appName.toLowerCase(),
    ].includes(username)
  )
    return;

  const reportKey = `seabot:triage:report:${username}`;
  if (await redis.get(reportKey)) return;
  const recentKey = `seabot:triage:recent:two-of-three:${username}`;
  if (
    (await redis.set(recentKey, "1", {
      nx: true,
      expiration: expiresIn(15 * 60_000),
    })) !== "OK"
  )
    return;

  let matches: string[];
  try {
    matches = await getParticipationMatches(reddit, comment);
  } catch (error) {
    // A later comment can retry sooner after a history failure.
    await redis.expire(recentKey, 120);
    throw error;
  }
  if (matches.length < 2 || (await redis.get(caseKey(id)))) return;
  // Atomic per-author claim prevents concurrent comments from duplicating reports.
  if (
    (await redis.set(reportKey, "1", {
      nx: true,
      expiration: expiresIn(7 * DAY_MS),
    })) !== "OK"
  )
    return;

  // Keep the claim if Reddit's response is lost: the report may have succeeded.
  await reddit.report(comment, {
    reason: `SeaBot review: prior activity in ${matches.map((sub) => `r/${sub}`).join(", ")}`,
  });
  // Store only a marker; NX preserves deletion tombstones.
  await redis.set(caseKey(id), "processed", {
    nx: true,
    expiration: expiresIn(14 * DAY_MS),
  });
}

const ReportCommenterParticipation: CommentCreateDefinition = {
  event: "CommentCreate",
  onEvent: async (event, context) => {
    if (
      context.subredditName?.toLowerCase() !== "seattle" ||
      !event.comment?.id?.startsWith("t1_")
    )
      return;
    try {
      await evaluateComment(event.comment.id, context);
    } catch {
      console.error(
        "SeaBot commenter review: evaluation/report failed; check service availability",
      );
    }
  },
};

export const DeleteCommenterReview: CommentDeleteDefinition = {
  event: "CommentDelete",
  onEvent: async (event, context) => {
    if (
      context.subredditName?.toLowerCase() !== "seattle" ||
      !event.commentId?.startsWith("t1_")
    )
      return;
    // Let storage failures propagate so deletion can be retried.
    await context.redis.set(caseKey(event.commentId), "deleted", {
      expiration: expiresIn(14 * DAY_MS),
    });
  },
};

export default ReportCommenterParticipation;
