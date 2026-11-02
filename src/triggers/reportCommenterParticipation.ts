import type { Comment, CommentCreateDefinition } from "@devvit/public-api";

const reviewable = (comment: Comment) =>
  !comment.removed &&
  !comment.spam &&
  !comment.approved &&
  !comment.ignoringReports;

const ReportCommenterParticipation: CommentCreateDefinition = {
  event: "CommentCreate",
  onEvent: async (
    event,
    { reddit, redis, settings, subredditName, appName },
  ) => {
    if (subredditName?.toLowerCase() !== "seattle" || !event.comment?.id)
      return;
    try {
      const enabled = await settings.get("botTriageReportsEnabled");
      if (enabled !== undefined && enabled !== true) return;
      let comment = await reddit.getCommentById(event.comment.id);
      const username = comment.authorName?.toLowerCase();
      if (
        !reviewable(comment) ||
        comment.subredditName.toLowerCase() !== "seattle" ||
        !username ||
        [
          "[deleted]",
          "automoderator",
          "seattle-modteam",
          appName.toLowerCase(),
        ].includes(username)
      )
        return;
      const key = `seabot:triage:report:${username}`;
      if (await redis.get(key)) return;
      const at = comment.createdAt.getTime();
      if (!(at > 0 && at <= Date.now())) return;
      const history = await reddit
        .getCommentsAndPostsByUser({
          username,
          sort: "new",
          limit: 100,
        })
        .get(100);
      const subs = new Set(
        history
          .filter(
            (item) =>
              item.createdAt.getTime() > 0 && item.createdAt.getTime() <= at,
          )
          .map((item) => item.subredditName.toLowerCase()),
      );
      const matches = ["pcos", "testosterone", "nashville"].filter((sub) =>
        subs.has(sub),
      );
      if (matches.length < 2) return;

      // Recheck deletion/moderation after the history lookup, before claiming a report.
      comment = await reddit.getCommentById(comment.id);
      if (!reviewable(comment) || comment.authorName.toLowerCase() !== username)
        return;
      if (
        (await redis.set(key, "1", {
          nx: true,
          expiration: new Date(Date.now() + 7 * 86_400_000),
        })) !== "OK"
      )
        return;
      // Retain the claim on failure: Reddit may have accepted the report.
      await reddit.report(comment, {
        reason: `SeaBot review: prior activity in ${matches.map((sub) => `r/${sub}`).join(", ")}`,
      });
    } catch {
      console.error(
        "SeaBot commenter review failed; check service availability",
      );
    }
  },
};

export default ReportCommenterParticipation;
