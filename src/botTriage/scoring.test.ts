import { describe, expect, it } from "vitest";
import {
  assessAccount,
  compactReportReason,
  DEFAULT_CONFIG,
  evaluationSignature,
  fingerprintPoints,
  parseCampaignConfig,
  shouldReport,
  type CampaignConfig,
  type ReportOptions,
} from "./scoring.js";

const NOW = Date.UTC(2026, 9, 30);
const DAY_MS = 86_400_000;
const generated = "Silly_Banana_1234";
const options: ReportOptions = {
  reportsEnabled: true,
  reportMedium: false,
  reportLow: false,
  dailyReportCap: 25,
};
function assess(
  subs: string[],
  age: number | null = 900,
  username = "CustomName",
  config: CampaignConfig = DEFAULT_CONFIG,
  historyAvailable = true,
) {
  return assessAccount({
    username,
    createdAtMs: age === null ? null : NOW - age * DAY_MS,
    nowMs: NOW,
    historyAvailable,
    config,
    history: subs.map((subreddit, i) => ({
      id: `t1_${i}`,
      subreddit,
      createdAtMs: NOW - i * 1000,
      kind: "comment",
    })),
  });
}

describe("campaign scoring", () => {
  it.each([
    [0, 0],
    [1, 5],
    [2, 7],
    [3, 9],
    [7, 9],
  ])("scores %i distinct matches as %i", (count, points) => {
    expect(fingerprintPoints(count)).toBe(points);
  });

  it.each([
    [0, 3],
    [29, 3],
    [30, 2],
    [180, 2],
    [181, 1],
    [365, 1],
    [366, 0],
    [null, 0],
  ])("scores an account aged %s days as %i", (age, points) => {
    expect(assess([], age).score).toBe(points);
  });

  it.each([
    [["pcos"], 900, "CustomName", 5, "LOW"],
    [["pcos"], 100, "CustomName", 7, "MEDIUM"],
    [["pcos"], 250, generated, 7, "MEDIUM"],
    [["pcos"], 5, generated, 9, "MEDIUM"],
    [["pcos", "nashville"], 900, "CustomName", 7, "MEDIUM"],
    [["pcos", "nashville"], 5, generated, 11, "HIGH"],
    [["pcos", "testosterone", "nashville"], 900, "CustomName", 9, "MEDIUM"],
    [["pcos", "testosterone", "nashville"], 100, "CustomName", 11, "HIGH"],
    [["pcos", "testosterone", "nashville"], 15, generated, 13, "HIGH"],
  ] as const)(
    "combines overlap, age, and name: %s / %s / %s",
    (subs, age, name, score, tier) => {
      expect(assess([...subs], age, name)).toMatchObject({ score, tier });
    },
  );

  it.each(DEFAULT_CONFIG.campaigns[0].subreddits)(
    "weights r/%s equally",
    (sub) => {
      expect(assess([sub]).score).toBe(5);
    },
  );

  it("normalizes names and counts repeated participation only once", () => {
    const result = assess(["r/SideProjects", "PCOS", "pcos", "/r/PCOS"]);
    expect(result.score).toBe(7);
    expect(result.campaign?.matches).toEqual(["pcos", "sideprojects"]);
    expect(result.observedItems).toBe(4);
  });

  it("deduplicates history IDs and marks a full sample as potentially truncated", () => {
    const history = Array.from({ length: 100 }, () => ({
      id: "t1_same",
      subreddit: "pcos",
      createdAtMs: NOW,
      kind: "comment" as const,
    }));
    expect(
      assessAccount({
        username: "CustomName",
        createdAtMs: null,
        nowMs: NOW,
        historyAvailable: true,
        config: DEFAULT_CONFIG,
        history,
      }),
    ).toMatchObject({
      score: 5,
      observedItems: 1,
      dataQuality: "sample_limit_reached",
    });
    expect(assess([]).dataQuality).toBe("sampled");
  });

  it("chooses the strongest enabled campaign without stacking, with stable ties", () => {
    const config = parseCampaignConfig(
      JSON.stringify({
        campaigns: [
          { id: "first", subreddits: ["pcos", "nashville"] },
          { id: "second", subreddits: ["pcos", "supplements", "blooddonors"] },
          {
            id: "disabled",
            enabled: false,
            subreddits: ["pcos", "other", "third"],
          },
        ],
      }),
    );
    expect(
      assess(["pcos", "other", "third"], 900, "CustomName", config),
    ).toMatchObject({ score: 5, campaign: { id: "first" } });
    expect(
      assess(
        ["pcos", "nashville", "supplements", "blooddonors"],
        900,
        "CustomName",
        config,
      ),
    ).toMatchObject({ score: 9, campaign: { id: "second" } });
  });

  it("supports expanding a campaign and single-subreddit campaigns", () => {
    const config = parseCampaignConfig(
      JSON.stringify({
        campaigns: [
          { id: "single", subreddits: ["newsub"] },
          {
            id: "expanded",
            subreddits: ["pcos", "nashville", "testosterone", "newsub"],
          },
        ],
      }),
    );
    expect(assess(["newsub"], 100, "CustomName", config).score).toBe(7);
    expect(
      assess(config.campaigns[1].subreddits, 5, generated, config).score,
    ).toBe(13);
  });

  it.each([0, -1, NaN, Infinity, NOW + 1])(
    "ignores invalid account timestamps: %s",
    (createdAtMs) => {
      expect(
        assessAccount({
          username: "CustomName",
          createdAtMs,
          nowMs: NOW,
          historyAvailable: true,
          config: DEFAULT_CONFIG,
          history: [],
        }).ageDays,
      ).toBeNull();
    },
  );

  it.each(["Silly_Banana_1234", "Silly-Banana123", "Silly-Banana-12"])(
    "recognizes name shape %s",
    (name) => {
      expect(assess([], 900, name).score).toBe(1);
    },
  );
  it.each([
    "CustomName",
    "Single1234",
    "Silly_Banana_1",
    "Silly_Banana_123456",
  ])("does not match %s", (name) => {
    expect(assess([], 900, name).score).toBe(0);
  });
});

describe("configuration", () => {
  it("returns independent bundled defaults for blank settings", () => {
    const config = parseCampaignConfig(" ");
    config.campaigns[0].subreddits.push("extra");
    expect(parseCampaignConfig(undefined)).toEqual(DEFAULT_CONFIG);
    expect(parseCampaignConfig("")).toEqual(DEFAULT_CONFIG);
  });

  it.each([
    "{",
    "null",
    "[]",
    "{}",
    "42",
    '{"campaigns":[]}',
    JSON.stringify({ campaigns: DEFAULT_CONFIG.campaigns, extra: true }),
    ...[
      null,
      [],
      { id: "bad" },
      { id: "bad", subreddits: [] },
      { id: "Bad ID", subreddits: ["pcos"] },
      { id: "bad", enabled: "false", subreddits: ["pcos"] },
      { id: "bad", enabled: false, subreddits: ["pcos"] },
      { id: "bad", subreddits: ["PCOS", "r/PCOS"] },
      { id: "bad", subreddits: ["/r/Seattle"] },
      { id: "bad", subreddits: [5] },
      { id: "bad", subreddits: ["invalid name"] },
      { id: "bad", subreddits: ["pcos"], weights: [1] },
      {
        id: "bad",
        subreddits: Array.from({ length: 21 }, (_, i) => `sub${i}`),
      },
    ].map((campaign) => JSON.stringify({ campaigns: [campaign] })),
    JSON.stringify({
      campaigns: [DEFAULT_CONFIG.campaigns[0], DEFAULT_CONFIG.campaigns[0]],
    }),
    JSON.stringify({
      campaigns: Array.from({ length: 13 }, (_, i) => ({
        id: `campaign-${i}`,
        subreddits: ["pcos"],
      })),
    }),
  ])("rejects invalid configuration: %s", (raw) => {
    expect(() => parseCampaignConfig(raw)).toThrow();
  });
  it("rejects a non-text setting", () =>
    expect(() => parseCampaignConfig(false)).toThrow());

  it("invalidates throttling for campaign and each reporting setting change", () => {
    const signature = evaluationSignature(DEFAULT_CONFIG, options);
    expect(
      evaluationSignature(parseCampaignConfig(undefined), { ...options }),
    ).toBe(signature);
    const changed = parseCampaignConfig(undefined);
    changed.campaigns[0].subreddits.push("newsub");
    expect(evaluationSignature(changed, options)).not.toBe(signature);
    for (const change of [
      { reportsEnabled: false },
      { reportMedium: true },
      { reportLow: true },
      { dailyReportCap: 26 },
    ]) {
      expect(
        evaluationSignature(DEFAULT_CONFIG, { ...options, ...change }),
      ).not.toBe(signature);
    }
  });
});

describe("report routing", () => {
  const high = assess(["pcos", "testosterone", "nashville"], 5, generated);
  const medium = assess(["pcos"], 100);
  const low = assess(["pcos"]);
  it("defaults to HIGH only and requires separate tier opt-ins", () => {
    expect(shouldReport(high, options)).toBe(true);
    expect(shouldReport(medium, options)).toBe(false);
    expect(shouldReport(low, options)).toBe(false);
    expect(shouldReport(medium, { ...options, reportMedium: true })).toBe(true);
    expect(shouldReport(low, { ...options, reportLow: true })).toBe(true);
    expect(shouldReport(medium, { ...options, reportLow: true })).toBe(false);
  });
  it("never reports in shadow mode, without matches, or with unavailable history", () => {
    const allTiers = { ...options, reportMedium: true, reportLow: true };
    expect(shouldReport(high, { ...allTiers, reportsEnabled: false })).toBe(
      false,
    );
    expect(shouldReport(assess(["seattle"], 2, generated), allTiers)).toBe(
      false,
    );
    const failed = assess(
      ["pcos", "testosterone", "nashville"],
      5,
      generated,
      DEFAULT_CONFIG,
      false,
    );
    expect(failed).toMatchObject({
      tier: "LOW",
      score: 4,
      dataQuality: "history_unavailable",
      observedItems: 0,
    });
    expect(shouldReport(failed, allTiers)).toBe(false);
  });
  it("includes tier and score in a report of at most 100 characters", () => {
    expect(compactReportReason(high)).toMatch(/^SeaBot HIGH 13\/13/);
    expect(
      compactReportReason({
        ...high,
        campaign: {
          id: "example",
          matches: Array(20).fill("longsubredditname"),
        },
      }).length,
    ).toBeLessThanOrEqual(100);
  });

  it("keeps only the winning campaign and reason codes in the assessment", () => {
    expect(high).toEqual({
      rubricVersion: "campaign-overlap-v1",
      score: 13,
      tier: "HIGH",
      campaign: {
        id: "pcos-testosterone-nashville",
        matches: ["pcos", "testosterone", "nashville"],
      },
      reasons: ["campaign_overlap", "age_lt30", "name_shape"],
      observedItems: 3,
      dataQuality: "sampled",
      ageDays: 5,
      autogeneratedNameShape: true,
    });
  });
});
