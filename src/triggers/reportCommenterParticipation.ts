import type { Comment, CommentCreateDefinition } from "@devvit/public-api";

const reviewable = (comment: Comment) =>
  !comment.removed &&
  !comment.spam &&
  !comment.approved &&
  !comment.ignoringReports;

const ReportCommenterParticipation: CommentCreateDefinition = {
  event: "CommentCreate",
  onEvent: async (event, { reddit, settings, subredditName, appName }) => {
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
      const at = comment.createdAt.getTime();
      if (!(at > 0 && at <= Date.now())) return;
      const history = await reddit
        .getCommentsAndPostsByUser({
          username,
          sort: "new",
          limit: 100,
        })
        .get(100);
      const matches = ["pcos", "testosterone", "nashville"].filter((sub) =>
        history.some(
          (item) =>
            item.subredditName.toLowerCase() === sub &&
            item.createdAt.getTime() > 0 &&
            item.createdAt.getTime() <= at,
        ),
      );
      if (matches.length < 2) return;

      // Recheck deletion/moderation after the history lookup, before reporting.
      comment = await reddit.getCommentById(comment.id);
      if (!reviewable(comment) || comment.authorName.toLowerCase() !== username)
        return;
      await reddit.report(comment, {
        reason: `SeaBot review: prior activity in ${matches.map((sub) => `r/${sub}`).join(", ")}`,
      });
    } catch {
      console.error("SeaBot commenter review failed");
    }
  },
};

export default ReportCommenterParticipation;
