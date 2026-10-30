import { describe, expect, it } from "vitest";
import { assessBehavior, assessExpandedName } from "./behavior.js";
import { assessAccount, DEFAULT_CONFIG, type HistoryItem } from "./scoring.js";

const NOW = Date.parse("2026-10-30T20:00:00Z");
const DAY = 86_400_000;
function comment(
  id: string,
  subreddit: string,
  createdAtMs: number,
): HistoryItem {
  return { id: `t1_${id}`, subreddit, createdAtMs, kind: "comment" };
}
function session(
  at: number,
  prefix: string,
  subs = ["pcos", "nashville", "seattle"],
) {
  return subs.map((sub, i) => comment(`${prefix}${i}`, sub, at + i * 60_000));
}
const matching = [...session(NOW - DAY, "a"), ...session(NOW - 2 * DAY, "b")];
function assess(
  history = matching,
  trigger?: HistoryItem,
  evaluatedAtMs = NOW,
) {
  return assessBehavior({
    history,
    historyAvailable: true,
    trigger,
    evaluatedAtMs,
  });
}

describe("fixed network shadow assessment", () => {
  it("requires all three conditions, without requiring B10, age, or a name shape", () => {
    const result = assess([
      ...session(NOW - DAY, "a", ["pcos", "nashville", "pcos"]),
      ...session(NOW - 2 * DAY, "b", ["pcos", "nashville", "pcos"]),
    ]);
    expect(result).toMatchObject({
      matched: true,
      recentComments: 6,
      coreMatches: ["pcos", "nashville"],
      b5Dates: 2,
      b10Dates: 0,
      reasons: ["repeated_cross_sub_sessions"],
      rubricVersion: "network-sessions-v1",
    });
    expect(assess(matching.slice(0, 5))).toMatchObject({
      matched: false,
      reasons: ["insufficient_recent_comments"],
    });
    expect(
      assess(
        matching.map((x) => ({
          ...x,
          subreddit: x.subreddit === "nashville" ? "supplements" : x.subreddit,
        })),
      ),
    ).toMatchObject({
      matched: false,
      coreMatches: ["pcos"],
      supportingMatches: ["supplements"],
      reasons: ["insufficient_core_overlap"],
    });
    expect(
      assess([
        ...session(NOW - DAY, "a"),
        ...session(NOW - DAY + 3_600_000, "b"),
      ]),
    ).toMatchObject({
      matched: false,
      b5Dates: 1,
      reasons: ["insufficient_cross_sub_sessions"],
    });
  });

  it("does not treat posts as comments, overlap, or session evidence", () => {
    expect(
      assess(
        matching.map((x) => ({
          ...x,
          id: x.id.replace("t1_", "t3_"),
          kind: "post",
        })),
      ),
    ).toMatchObject({
      matched: false,
      recentComments: 0,
      coreMatches: [],
      b5Dates: 0,
      sampledItems: 6,
    });
  });

  it("uses inclusive 30-day and five-minute boundaries", () => {
    const start = NOW - 30 * DAY;
    const history = [
      comment("a", "PCOS", start),
      comment("b", "r/Nashville", start + 300_000),
      comment("old", "testosterone", start - 1),
      comment("now", "seattle", NOW),
    ];
    expect(assess(history)).toMatchObject({
      recentComments: 3,
      coreMatches: ["pcos", "nashville"],
      b5Dates: 1,
    });
    expect(
      assess(
        history.map((x) =>
          x.id === "t1_b" ? { ...x, createdAtMs: x.createdAtMs + 1 } : x,
        ),
      ).b5Dates,
    ).toBe(0);
  });

  it("counts B10 separately with an inclusive ten-minute boundary", () => {
    const history = [
      comment("a", "pcos", NOW - 600_000),
      comment("b", "nashville", NOW - 300_000),
      comment("c", "seattle", NOW),
    ];
    expect(assess(history).b10Dates).toBe(1);
    expect(
      assess(
        history.map((x) =>
          x.id === "t1_a" ? { ...x, createdAtMs: x.createdAtMs - 1 } : x,
        ),
      ).b10Dates,
    ).toBe(0);
  });

  it("merges the fetched trigger once and prefers it over an indexed copy", () => {
    const trigger = comment("trigger", "seattle", NOW - DAY + 120_000);
    const history = [
      ...session(NOW - DAY, "a", ["pcos", "nashville"]),
      ...session(NOW - 2 * DAY, "b"),
    ];
    expect(assess(history).matched).toBe(false);
    const result = assess(history, trigger);
    expect(result).toMatchObject({
      matched: true,
      recentComments: 6,
      sampledItems: 6,
      triggerAtMs: trigger.createdAtMs,
    });
    expect(
      assess(
        [
          ...history,
          { ...trigger, subreddit: "supplements", createdAtMs: NOW },
        ],
        trigger,
      ),
    ).toEqual(result);
  });

  it("excludes activity after the trigger even when evaluation is delayed", () => {
    const trigger = comment("trigger", "seattle", NOW - DAY);
    const result = assess(
      [
        ...session(NOW - DAY - 120_000, "a"),
        ...session(NOW - DAY + 60_000, "later"),
      ],
      trigger,
    );
    expect(result).toMatchObject({
      matched: false,
      recentComments: 4,
      b5Dates: 1,
    });
    expect(
      assess(
        [
          ...session(NOW - DAY - 120_000, "a"),
          ...session(NOW - DAY + 60_000, "later"),
        ],
        trigger,
        NOW + DAY,
      ),
    ).toEqual(result);
  });

  it("bounds the combined sample, and preserves truncation after filtering future activity", () => {
    const history = Array.from({ length: 100 }, (_, i) =>
      comment(String(i), "elsewhere", NOW - (i + 1) * 1000),
    );
    const trigger = comment("trigger", "seattle", NOW);
    expect(assess(history, trigger)).toMatchObject({
      sampledItems: 100,
      oldestSampleAtMs: NOW - 99_000,
      dataQuality: "sample_limit_reached",
    });
    expect(
      assess(history, { ...trigger, createdAtMs: NOW - 200_000 }),
    ).toMatchObject({ sampledItems: 1, dataQuality: "sample_limit_reached" });
    expect(assess([...matching, ...matching])).toEqual(assess(matching));
  });

  it.each([
    ["2026-10-29T23:59:00-07:00", "2026-10-30T00:01:00-07:00", 1],
    ["2026-10-29T23:58:00-07:00", "2026-10-30T00:05:00-07:00", 2],
    ["2026-03-08T01:59:00-08:00", "2026-03-08T03:01:00-07:00", 1],
    ["2026-11-01T01:10:00-07:00", "2026-11-01T01:10:00-08:00", 1],
    ["2026-11-01T23:59:00-08:00", "2026-11-02T00:10:00-08:00", 2],
  ])(
    "counts Pacific start dates across midnight/DST: %s, %s",
    (a, b, dates) => {
      const start = Date.parse(a),
        later = Date.parse(b);
      const history = [
        ...session(start, "a", ["pcos", "nashville"]),
        ...session(later, "b", ["seattle", "elsewhere"]),
      ];
      expect(assess(history, undefined, later + 60_000).b5Dates).toBe(dates);
    },
  );

  it("does not reuse a comment in overlapping windows across midnight", () => {
    const start = Date.parse("2026-10-29T23:59:00-07:00");
    const history = [
      comment("a", "pcos", start),
      comment("b", "nashville", start + 120_000),
      comment("c", "seattle", start + 360_000),
    ];
    expect(assess(history, undefined, start + 360_000).b5Dates).toBe(1);
  });

  it.each([NaN, 0, NOW + 1])(
    "fails closed on invalid trigger time %s",
    (createdAtMs) => {
      expect(
        assess(matching, comment("trigger", "seattle", createdAtMs)),
      ).toMatchObject({
        matched: false,
        dataQuality: "history_unavailable",
        triggerAtMs: null,
        sampledItems: 0,
        reasons: ["history_unavailable"],
      });
    },
  );

  it("retains uncertainty for unavailable and sparse samples", () => {
    expect(
      assessBehavior({
        history: matching,
        historyAvailable: false,
        evaluatedAtMs: NOW,
      }),
    ).toMatchObject({
      matched: false,
      dataQuality: "history_unavailable",
      sampledItems: 0,
    });
    expect(assess([])).toMatchObject({
      matched: false,
      dataQuality: "sampled",
      oldestSampleAtMs: null,
      reasons: [
        "insufficient_recent_comments",
        "insufficient_core_overlap",
        "insufficient_cross_sub_sessions",
      ],
    });
  });
});

describe("independent CamelCase name diagnostic", () => {
  it.each([
    ["InitialLess9326", true],
    ["Silly_Banana_1234", true],
    ["initialless9326", false],
    ["INITIALLESS9326", false],
    ["InitialLESS9326", false],
    ["InitialLess1", false],
    ["InitialLess123456", false],
    ["CustomName", false],
  ])("tests the case-sensitive boundary for %s", (username, matches) => {
    const baseline = assessAccount({
      username,
      history: matching,
      historyAvailable: true,
      config: DEFAULT_CONFIG,
      createdAtMs: null,
      nowMs: NOW,
    });
    const original = structuredClone(baseline);
    expect(assessExpandedName(username, baseline)).toMatchObject({
      matches,
      score:
        baseline.score + Number(matches && !baseline.autogeneratedNameShape),
    });
    expect(baseline).toEqual(original);
  });
});
