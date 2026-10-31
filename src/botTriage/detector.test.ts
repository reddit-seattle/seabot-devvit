import { describe, expect, it } from "vitest";
import { detectNetwork, reportReason } from "./detector.js";
import type { HistoryItem } from "./history.js";

const NOW = Date.parse("2026-10-30T20:00:00Z");
const DAY = 86_400_000;
function comment(
  id: string,
  subreddit: string,
  createdAtMs: number,
): HistoryItem {
  return { id: `t1_${id}`, subreddit, createdAtMs, kind: "comment" };
}
function session(at: number, prefix: string) {
  return ["pcos", "nashville", "seattle"].map((sub, i) =>
    comment(`${prefix}${i}`, sub, at + i * 60_000),
  );
}
const matching = [...session(NOW - DAY, "a"), ...session(NOW - 2 * DAY, "b")];
function detect(history = matching, at = NOW) {
  return detectNetwork(
    [...history].sort((a, b) => b.createdAtMs - a.createdAtMs),
    at,
  );
}

describe("network detection", () => {
  it("requires six comments, two core communities, and sessions on two dates", () => {
    expect(detect()).toEqual({
      matched: true,
      recentComments: 6,
      coreCount: 2,
      sessionDays: 2,
    });
    expect(detect(matching.slice(0, 5))).toMatchObject({
      matched: false,
      recentComments: 5,
      coreCount: 2,
      sessionDays: 2,
    });
    expect(
      detect(
        matching.map((x) => ({
          ...x,
          subreddit: x.subreddit === "nashville" ? "sideproject" : x.subreddit,
        })),
      ),
    ).toMatchObject({
      matched: false,
      recentComments: 6,
      coreCount: 1,
      sessionDays: 2,
    });
    expect(
      detect([
        ...session(NOW - DAY, "a"),
        ...session(NOW - DAY + 3_600_000, "b"),
      ]),
    ).toMatchObject({
      matched: false,
      recentComments: 6,
      coreCount: 2,
      sessionDays: 1,
    });
  });
  it("counts sessions in any subreddits but requires distinct communities", () => {
    expect(
      detect(
        matching.map((x) => ({
          ...x,
          subreddit: x.subreddit === "seattle" ? "pcos" : x.subreddit,
        })),
      ),
    ).toMatchObject({ matched: true, sessionDays: 2 });
    expect(
      detect(matching.map((x) => ({ ...x, subreddit: "pcos" }))),
    ).toMatchObject({ matched: false, sessionDays: 0 });
  });
  it("excludes posts from counts, core overlap, and sessions", () => {
    expect(detect(matching.map((x) => ({ ...x, kind: "post" })))).toEqual({
      matched: false,
      recentComments: 0,
      coreCount: 0,
      sessionDays: 0,
    });
    expect(
      detect([{ ...matching[0], kind: "post" }, ...matching.slice(1)]),
    ).toMatchObject({ matched: false, recentComments: 5 });
  });
  it("uses inclusive 30-day and five-minute boundaries and excludes later activity", () => {
    const start = NOW - 30 * DAY;
    const history = [
      comment("a", "pcos", start),
      comment("b", "nashville", start + 300_000),
      comment("old", "testosterone", start - 1),
      comment("now", "seattle", NOW),
      comment("later", "testosterone", NOW + 1),
    ];
    expect(detect(history)).toMatchObject({
      recentComments: 3,
      coreCount: 2,
      sessionDays: 1,
    });
    expect(
      detect(
        history.map((x) =>
          x.id === "t1_b" ? { ...x, createdAtMs: x.createdAtMs + 1 } : x,
        ),
      ).sessionDays,
    ).toBe(0);
  });
  it.each([
    ["2026-10-29T23:59:00-07:00", "2026-10-30T00:01:00-07:00", 1],
    ["2026-10-29T23:58:00-07:00", "2026-10-30T00:05:00-07:00", 2],
    ["2026-03-08T01:59:00-08:00", "2026-03-08T03:01:00-07:00", 1],
    ["2026-11-01T01:10:00-07:00", "2026-11-01T01:10:00-08:00", 1],
    ["2026-11-01T23:59:00-08:00", "2026-11-02T00:10:00-08:00", 2],
  ])("counts Pacific dates across midnight and DST: %s / %s", (a, b, days) => {
    const at = Date.parse(b) + 120_000;
    expect(
      detect(
        [...session(Date.parse(a), "a"), ...session(Date.parse(b), "b")],
        at,
      ).sessionDays,
    ).toBe(days);
  });
  it("does not reuse a comment in overlapping windows across midnight", () => {
    const start = Date.parse("2026-10-29T23:59:00-07:00");
    const history = [
      comment("a", "pcos", start),
      comment("b", "nashville", start + 120_000),
      comment("c", "seattle", start + 360_000),
    ];
    expect(detect(history, start + 360_000).sessionDays).toBe(1);
  });
  it("does not match empty history", () => {
    expect(detect([])).toEqual({
      matched: false,
      recentComments: 0,
      coreCount: 0,
      sessionDays: 0,
    });
  });
  it("explains the observed evidence within Reddit's 100-character report limit", () => {
    expect(reportReason(detect())).toBe(
      "SeaBot: possible bot network; 6 comments, 2/3 core subs, 2 burst days (30d sample)",
    );
    expect(
      reportReason({
        matched: true,
        recentComments: 100,
        coreCount: 3,
        sessionDays: 31,
      }).length,
    ).toBeLessThanOrEqual(100);
  });
});
