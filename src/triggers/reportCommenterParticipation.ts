import type {
  Comment,
  CommentCreateDefinition,
  ModActionDefinition,
} from "@devvit/public-api";

const stateKey = (id: string) => `seabot:review:${id}`;

export const ApproveCommenterParticipation: ModActionDefinition = {
  event: "ModAction",
  onEvent: async (event, { redis, subredditName }) => {
    if (
      subredditName?.toLowerCase() !== "seattle" ||
      event.action !== "approvecomment" ||
      !event.targetComment?.id
    )
      return;
    const authorId = await redis.get(stateKey(event.targetComment.id));
    if (authorId) await redis.set(stateKey(authorId), "approved");
  },
};

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
      const authorId = comment.authorId;
      if (!authorId) return;
      const key = stateKey(authorId);
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
      const matches = ["pcos", "testosterone", "nashville"].filter((sub) =>
        history.some(
          (item) =>
            item.subredditName.toLowerCase() === sub &&
            item.createdAt.getTime() > 0 &&
            item.createdAt.getTime() <= at,
        ),
      );
      if (matches.length < 2) return;

      if (
        (await redis.set(key, "reported", {
          nx: true,
          expiration: new Date(Date.now() + 7 * 86_400_000),
        })) !== "OK"
      )
        return;
      // Record before reporting so an immediate approval can find the author.
      await redis.set(stateKey(comment.id), authorId);
      comment = await reddit.getCommentById(comment.id);
      if (comment.approved) await redis.set(key, "approved");
      if (!reviewable(comment) || comment.authorName.toLowerCase() !== username)
        return;
      if ((await redis.get(key)) === "approved") return;
      // Keep the claim on failure: Reddit may have accepted the report.
      await reddit.report(comment, {
        reason: `SeaBot review: prior activity in ${matches.map((sub) => `r/${sub}`).join(", ")}`,
      });
    } catch {
      console.error("SeaBot commenter review failed");
    }
  },
};

export default ReportCommenterParticipation;
