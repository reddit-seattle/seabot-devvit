import type { TriggerContext } from "@devvit/public-api";
import { HISTORY_LIMIT, type HistoryItem } from "./scoring.js";

export async function getRecentHistory(
  reddit: TriggerContext["reddit"],
  username: string,
): Promise<HistoryItem[]> {
  const items = await reddit
    .getCommentsAndPostsByUser({
      username,
      sort: "new",
      limit: HISTORY_LIMIT,
    })
    .get(HISTORY_LIMIT);

  // SDK 0.12.20 omits sort from the wire request. Verify the returned order
  // instead of silently scoring a non-chronological sample or sorting it locally.
  let previousTime = Infinity;
  return items.map((item) => {
    const time = item.createdAt.getTime();
    if (!Number.isFinite(time) || time <= 0 || time > previousTime) {
      throw new Error("Account history is not newest-first");
    }
    previousTime = time;
    return { id: item.id, subreddit: item.subredditName };
  });
}
