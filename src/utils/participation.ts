import type { Comment, TriggerContext } from "@devvit/public-api";

/** Return distinct target communities observed at or before a comment. */
export async function getParticipationMatches(
  reddit: TriggerContext["reddit"],
  comment: Pick<Comment, "authorName" | "createdAt">,
): Promise<string[]> {
  const at = comment.createdAt.getTime();
  if (!(at > 0 && at <= Date.now()))
    throw new Error("Invalid comment timestamp");
  const history = await reddit
    .getCommentsAndPostsByUser({
      username: comment.authorName,
      sort: "new",
      limit: 100,
    })
    .get(100);
  // Listing order does not matter. Count only activity at/before the comment.
  const subs = new Set(
    history
      .filter(
        (item) =>
          item.createdAt.getTime() > 0 && item.createdAt.getTime() <= at,
      )
      .map((item) =>
        item.subredditName
          .trim()
          .replace(/^\/?r\//i, "")
          .toLowerCase(),
      ),
  );
  return ["pcos", "testosterone", "nashville"].filter((sub) => subs.has(sub));
}
