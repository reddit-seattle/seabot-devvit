import type { Comment, TriggerContext } from "@devvit/public-api";

const HISTORY_LIMIT = 100;
export interface HistoryItem {
  id: string;
  subreddit: string;
  createdAtMs: number;
  kind: "comment" | "post";
}

/** Validate the overview before merging the eligible trigger into a bounded sample. */
export async function getRecentHistory(
  reddit: TriggerContext["reddit"],
  comment: Pick<Comment, "id" | "authorName" | "subredditName" | "createdAt">,
  nowMs = Date.now(),
): Promise<HistoryItem[]> {
  const triggerTime = comment.createdAt?.getTime();
  if (!Number.isFinite(triggerTime) || triggerTime <= 0 || triggerTime > nowMs)
    throw new Error("Invalid trigger timestamp");
  const items = await reddit
    .getCommentsAndPostsByUser({
      username: comment.authorName,
      sort: "new",
      limit: HISTORY_LIMIT,
    })
    .get(HISTORY_LIMIT);

  // SDK 0.12.20 omits sort on the wire. Reject invalid ordering before any local
  // sorting; descending timestamps alone still cannot prove the sample is newest.
  let previousTime = Infinity;
  const history: HistoryItem[] = items.map((item) => {
    const time = item.createdAt.getTime();
    if (
      !Number.isFinite(time) ||
      time <= 0 ||
      time > nowMs ||
      time > previousTime
    )
      throw new Error("Invalid or out-of-order account history");
    previousTime = time;
    const kind = item.id.startsWith("t1_")
      ? "comment"
      : item.id.startsWith("t3_")
        ? "post"
        : null;
    if (!kind) throw new Error("Unknown account history item type");
    return {
      id: item.id,
      subreddit: item.subredditName.toLowerCase(),
      createdAtMs: time,
      kind,
    };
  });
  history.push({
    id: comment.id,
    subreddit: comment.subredditName.toLowerCase(),
    createdAtMs: triggerTime,
    kind: "comment",
  });

  // The fetched trigger wins over its indexed copy. Exclude activity after it,
  // including on delayed events, and keep posts within the combined 100-item bound.
  return [...new Map(history.map((item) => [item.id, item])).values()]
    .filter((item) => item.createdAtMs <= triggerTime)
    .sort((a, b) => b.createdAtMs - a.createdAtMs || b.id.localeCompare(a.id))
    .slice(0, HISTORY_LIMIT);
}
