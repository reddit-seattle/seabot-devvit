import type { HistoryItem } from "./history.js";

const CORE_SUBREDDITS = ["pcos", "testosterone", "nashville"];
const WINDOW_MS = 30 * 86_400_000;
const SESSION_MS = 5 * 60_000;

export interface Detection {
  matched: boolean;
  recentComments: number;
  coreCount: number;
  sessionDays: number;
}

/** Assess a validated, bounded sample ending at the triggering comment. */
export function detectNetwork(
  history: HistoryItem[],
  triggerTime: number,
): Detection {
  const comments = history
    .filter(
      (item) =>
        item.kind === "comment" &&
        item.createdAtMs >= triggerTime - WINDOW_MS &&
        item.createdAtMs <= triggerTime,
    )
    .reverse();
  const subreddits = new Set(comments.map((item) => item.subreddit));
  const coreCount = CORE_SUBREDDITS.filter((sub) => subreddits.has(sub)).length;
  const dates = new Set<string>();
  const pacificDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  // Greedily consume each qualifying window. Overlapping comments cannot create
  // another session, and each Pacific start date counts once, including across DST.
  for (let start = 0; start < comments.length; start++) {
    const subs = new Set<string>();
    let end = start;
    while (
      end < comments.length &&
      comments[end].createdAtMs - comments[start].createdAtMs <= SESSION_MS
    ) {
      subs.add(comments[end].subreddit);
      end++;
    }
    if (subs.size >= 2) {
      dates.add(pacificDate.format(comments[start].createdAtMs));
      start = end - 1;
    }
  }
  return {
    matched: comments.length >= 6 && coreCount >= 2 && dates.size >= 2,
    recentComments: comments.length,
    coreCount,
    sessionDays: dates.size,
  };
}

export function reportReason(result: Detection): string {
  return `SeaBot: possible bot network; ${result.recentComments} comments, ${result.coreCount}/3 core subs, ${result.sessionDays} burst days (30d sample)`;
}
