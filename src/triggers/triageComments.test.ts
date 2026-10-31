import type { TriggerContext } from "@devvit/public-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteTriageCase, TriageComment } from "./triageComments.js";

const DAY_MS = 86_400_000;
const NOW = Date.UTC(2026, 9, 30, 12);
const PREFIX = "seabot:triage:";
const username = "Silly_Banana_1234";

function setup() {
  const data = new Map<string, { value: string; expiresAt?: number }>();
  const read = (key: string) => {
    const entry = data.get(key);
    if (entry?.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      data.delete(key);
      return undefined;
    }
    return entry?.value;
  };
  const redis = {
    get: vi.fn(async (key: string) => read(key)),
    set: vi.fn(
      async (
        key: string,
        value: string,
        options?: { nx?: boolean; expiration?: Date },
      ) => {
        if (options?.nx && read(key) !== undefined) return "";
        data.set(key, { value, expiresAt: options?.expiration?.getTime() });
        return "OK";
      },
    ),
    incrBy: vi.fn(async (key: string, amount: number) => {
      const value = Number(read(key) ?? 0) + amount;
      data.set(key, { ...data.get(key), value: String(value) });
      return value;
    }),
    expire: vi.fn(async (key: string, seconds: number) => {
      const entry = data.get(key);
      if (entry) entry.expiresAt = Date.now() + seconds * 1000;
    }),
  };
  const comment = {
    id: "t1_first",
    subredditName: "Seattle",
    authorName: username,
    createdAt: new Date(NOW),
    removed: false,
    spam: false,
    approved: false,
    body: "LOCAL COMMENT BODY",
    permalink: "/r/Seattle/comments/post/title/first/",
  };
  const history = ["pcos", "testosterone", "nashville"].map(
    (subredditName, i) => ({
      id: `t1_history${i}`,
      subredditName,
      body: "EXTERNAL COMMENT BODY",
      createdAt: new Date(NOW - i * 1000),
    }),
  );
  const listingGet = vi.fn(async (_limit: number) => history);
  const reddit = {
    getCommentById: vi.fn(async (id: string) => ({ ...comment, id })),
    getUserByUsername: vi.fn(async (_name: string) => ({
      createdAt: new Date(NOW - 5 * DAY_MS),
    })),
    getCommentsAndPostsByUser: vi.fn((_options: unknown) => ({
      get: listingGet,
    })),
    report: vi.fn(async (_comment: unknown, _options: unknown) => {}),
  };
  const values: Record<string, unknown> = {};
  const settings = { getAll: vi.fn(async () => ({ ...values })) };
  const context = {
    reddit,
    redis,
    settings,
    subredditName: "Seattle",
    appName: "seattle-bot",
  } as unknown as TriggerContext;
  const create = (id = "t1_first") =>
    TriageComment.onEvent(
      { comment: { id } } as Parameters<typeof TriageComment.onEvent>[0],
      context,
    );
  const remove = (id = "t1_first") =>
    DeleteTriageCase.onEvent(
      { commentId: id } as Parameters<typeof DeleteTriageCase.onEvent>[0],
      context,
    );
  const record = (id = "t1_first") =>
    JSON.parse(read(`${PREFIX}case:${id}`) ?? "null");
  return {
    data,
    read,
    redis,
    reddit,
    comment,
    listingGet,
    values,
    context,
    settings,
    create,
    remove,
    record,
  };
}

describe("comment bot triage", () => {
  let env: ReturnType<typeof setup>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    env = setup();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("reports HIGH assessments by default without requiring a behavioral match", async () => {
    await env.create();
    expect(env.record()).toMatchObject({
      action: "reported",
      assessment: { score: 13, tier: "HIGH" },
      behaviorShadow: { matched: false },
    });
    expect(env.reddit.report).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "t1_first" }),
      { reason: expect.stringContaining("SeaBot HIGH 13/13") },
    );
    expect(env.read(`${PREFIX}daily:2026-10-30`)).toBe("1");
  });

  it("supports shadow mode with bounded history and expiring, minimal diagnostics", async () => {
    env.values.botTriageReportsEnabled = false;
    await env.create();
    expect(env.reddit.getCommentsAndPostsByUser).toHaveBeenCalledWith({
      username,
      sort: "new",
      limit: 100,
    });
    expect(env.listingGet).toHaveBeenCalledWith(100);
    expect(env.record()).toMatchObject({
      action: "evaluated",
      assessment: { score: 13, tier: "HIGH" },
    });
    expect(env.data.get(`${PREFIX}case:t1_first`)?.expiresAt).toBe(
      NOW + 14 * DAY_MS,
    );
    expect(env.reddit.report).not.toHaveBeenCalled();
    const saved = env.read(`${PREFIX}case:t1_first`)!;
    for (const text of [
      username,
      "LOCAL COMMENT BODY",
      "EXTERNAL COMMENT BODY",
      "t1_history",
      env.comment.permalink,
    ]) {
      expect(saved).not.toContain(text);
    }
    expect(console.log).toHaveBeenCalledWith(
      "SeaBot triage",
      JSON.stringify({
        tier: "HIGH",
        score: 13,
        dataQuality: "sampled",
        behaviorMatched: false,
        behaviorDataQuality: "sampled",
        expandedNameScore: 13,
        action: "evaluated",
      }),
    );
  });

  it("evaluates old accounts with custom names", async () => {
    env.comment.authorName = "CustomName";
    env.reddit.getUserByUsername.mockResolvedValue({
      createdAt: new Date(NOW - 900 * DAY_MS),
    });
    await env.create();
    expect(env.listingGet).toHaveBeenCalledOnce();
    expect(env.record().assessment).toMatchObject({ score: 9, tier: "MEDIUM" });
  });

  it("includes the eligible trigger in behavioral evidence without allowing shadow matches to report", async () => {
    env.comment.authorName = "CustomName";
    env.values.botTriageReportsEnabled = true;
    env.reddit.getUserByUsername.mockResolvedValue({
      createdAt: new Date(NOW - 900 * DAY_MS),
    });
    env.listingGet.mockResolvedValue(
      [
        ["pcos", NOW - 60_000],
        ["nashville", NOW - DAY_MS + 120_000],
        ["pcos", NOW - DAY_MS + 60_000],
        ["seattle", NOW - DAY_MS],
        ["elsewhere", NOW - 2 * DAY_MS],
      ].map(([subredditName, at], i) => ({
        id: `t1_evidence${i}`,
        subredditName: String(subredditName),
        createdAt: new Date(Number(at)),
        body: "EXTERNAL COMMENT BODY",
      })),
    );
    await env.create();
    expect(env.record()).toMatchObject({
      assessedAt: new Date(NOW).toISOString(),
      assessment: {
        score: 7,
        tier: "MEDIUM",
        rubricVersion: "campaign-overlap-v1",
      },
      behaviorShadow: {
        matched: true,
        recentComments: 6,
        b5Dates: 2,
        triggerAtMs: NOW,
        oldestSampleAtMs: NOW - 2 * DAY_MS,
        dataQuality: "sampled",
      },
      action: "evaluated",
    });
    expect(env.reddit.report).not.toHaveBeenCalled();
    expect(env.read(`${PREFIX}report:customname`)).toBeUndefined();
    expect(env.read(`${PREFIX}daily:2026-10-30`)).toBeUndefined();
    expect(env.read(`${PREFIX}case:t1_first`)).not.toContain("t1_evidence");
  });

  it("keeps a CamelCase-only HIGH score separate from report eligibility", async () => {
    env.comment.authorName = "InitialLess9326";
    env.values.botTriageReportsEnabled = true;
    env.reddit.getUserByUsername.mockResolvedValue({
      createdAt: new Date(NOW - 250 * DAY_MS),
    });
    await env.create();
    expect(env.record()).toMatchObject({
      assessment: { score: 10, tier: "MEDIUM" },
      nameShadow: {
        rubricVersion: "camelcase-name-v1",
        matches: true,
        score: 11,
      },
    });
    expect(env.reddit.report).not.toHaveBeenCalled();
  });

  it.each([undefined, new Date(NaN), new Date(0), new Date(NOW + 1)])(
    "suppresses both assessments and reporting for invalid trigger time %s",
    async (createdAt) => {
      Object.assign(env.comment, { createdAt });
      env.values.botTriageReportsEnabled = true;
      await env.create();
      expect(env.record()).toMatchObject({
        assessment: { dataQuality: "history_unavailable" },
        behaviorShadow: {
          matched: false,
          dataQuality: "history_unavailable",
          triggerAtMs: null,
        },
      });
      expect(env.reddit.report).not.toHaveBeenCalled();
      expect(env.listingGet).not.toHaveBeenCalled();
    },
  );

  it.each(["removed", "spam", "approved"] as const)(
    "skips %s comments",
    async (flag) => {
      env.comment[flag] = true;
      await env.create();
      expect(env.listingGet).not.toHaveBeenCalled();
    },
  );
  it.each(["", "[deleted]", "AutoModerator", "Seattle-ModTeam", "seattle-bot"])(
    "skips author %s",
    async (name) => {
      env.comment.authorName = name;
      await env.create();
      expect(env.listingGet).not.toHaveBeenCalled();
    },
  );
  it("ignores other installations, other-sub comments, and malformed events", async () => {
    await env.create("t3_post");
    env.context.subredditName = "elsewhere";
    await env.create();
    expect(env.reddit.getCommentById).not.toHaveBeenCalled();
    env.context.subredditName = "Seattle";
    env.comment.subredditName = "elsewhere";
    await env.create();
    expect(env.listingGet).not.toHaveBeenCalled();
  });

  it.each([{ botTriageCampaignsJson: "{" }, { botTriageDailyReportCap: -1 }])(
    "fails closed on invalid settings: %s",
    async (invalid) => {
      Object.assign(env.values, invalid, { botTriageReportsEnabled: true });
      await env.create();
      expect(env.listingGet).not.toHaveBeenCalled();
      expect(env.reddit.report).not.toHaveBeenCalled();
      expect(env.data.size).toBe(0);
    },
  );

  it("throttles simultaneous evaluations for one author and permits later comments after 15 minutes", async () => {
    await Promise.all([
      env.create(),
      env.create("t1_second"),
      env.create("t1_third"),
    ]);
    expect(env.listingGet).toHaveBeenCalledOnce();
    vi.setSystemTime(NOW + 15 * 60_000);
    await env.create("t1_later");
    expect(env.listingGet).toHaveBeenCalledTimes(2);
    await env.create();
    expect(env.listingGet).toHaveBeenCalledTimes(2);
  });

  it("applies report setting and campaign changes immediately to subsequent comments", async () => {
    env.values.botTriageReportsEnabled = false;
    await env.create();
    env.values.botTriageReportsEnabled = true;
    await env.create("t1_second");
    expect(env.reddit.report).toHaveBeenCalledOnce();
    env.values.botTriageCampaignsJson = JSON.stringify({
      campaigns: [{ id: "new-campaign", subreddits: ["other"] }],
    });
    await env.create("t1_third");
    expect(env.listingGet).toHaveBeenCalledTimes(3);
    expect(env.record("t1_third").assessment.campaign).toBeNull();
  });

  it("keeps the seven-day report cooldown across configuration changes", async () => {
    env.values.botTriageReportsEnabled = true;
    await env.create();
    env.values.botTriageReportMedium = true;
    await env.create("t1_second");
    expect(env.record("t1_second").action).toBe("cooldown");
    expect(env.reddit.report).toHaveBeenCalledOnce();
    expect(
      env.data.get(`${PREFIX}report:${username.toLowerCase()}`)?.expiresAt,
    ).toBe(NOW + 7 * DAY_MS);
    vi.setSystemTime(NOW + 7 * DAY_MS);
    await env.create("t1_nextweek");
    expect(env.reddit.report).toHaveBeenCalledTimes(2);
  });

  it("uses an atomic report claim even if differently configured evaluations race", async () => {
    env.settings.getAll
      .mockResolvedValueOnce({ botTriageReportsEnabled: true })
      .mockResolvedValueOnce({
        botTriageReportsEnabled: true,
        botTriageReportMedium: true,
      });
    await Promise.all([env.create(), env.create("t1_second")]);
    expect(env.listingGet).toHaveBeenCalledTimes(2);
    expect(env.reddit.report).toHaveBeenCalledOnce();
    expect(
      [env.record().action, env.record("t1_second").action].sort(),
    ).toEqual(["cooldown", "reported"]);
    expect(env.read(`${PREFIX}daily:2026-10-30`)).toBe("1");
  });

  it("caps concurrent reports across users and resets the budget on a new UTC day", async () => {
    Object.assign(env.values, {
      botTriageReportsEnabled: true,
      botTriageDailyReportCap: 2,
    });
    env.reddit.getCommentById.mockImplementation(async (id) => ({
      ...env.comment,
      id,
      authorName: `Silly_Banana_${id.slice(3)}`,
    }));
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => env.create(`t1_${1000 + i}`)),
    );
    expect(env.reddit.report).toHaveBeenCalledTimes(2);
    expect(env.read(`${PREFIX}daily:2026-10-30`)).toBe("2");
    expect(
      [...env.data.values()].filter(({ value }) =>
        value.includes('"suppressed_daily_cap"'),
      ),
    ).toHaveLength(8);
    expect(env.data.get(`${PREFIX}daily:2026-10-30`)?.expiresAt).toBe(
      NOW + 2 * DAY_MS,
    );
    vi.setSystemTime(Date.UTC(2026, 9, 31));
    await env.create("t1_2000");
    expect(env.reddit.report).toHaveBeenCalledTimes(3);
  });

  it("a zero budget submits no report and claims no user cooldown", async () => {
    Object.assign(env.values, {
      botTriageReportsEnabled: true,
      botTriageDailyReportCap: 0,
    });
    await env.create();
    expect(env.record().action).toBe("suppressed_daily_cap");
    expect(env.reddit.report).not.toHaveBeenCalled();
    expect(
      env.read(`${PREFIX}report:${username.toLowerCase()}`),
    ).toBeUndefined();
    expect(env.redis.incrBy).not.toHaveBeenCalled();
  });

  it("honors an increased cap after previous evaluations were rejected", async () => {
    Object.assign(env.values, {
      botTriageReportsEnabled: true,
      botTriageDailyReportCap: 1,
    });
    env.reddit.getCommentById.mockImplementation(async (id) => ({
      ...env.comment,
      id,
      authorName: `Silly_Banana_${id.slice(3)}`,
    }));
    for (let i = 1000; i < 1005; i++) await env.create(`t1_${i}`);
    expect(env.reddit.report).toHaveBeenCalledOnce();
    expect(env.read(`${PREFIX}daily:2026-10-30`)).toBe("1");
    env.values.botTriageDailyReportCap = 2;
    await env.create("t1_2000");
    expect(env.reddit.report).toHaveBeenCalledTimes(2);
    expect(env.read(`${PREFIX}daily:2026-10-30`)).toBe("2");
  });

  it("releases budget without starting a cooldown when the final case read fails", async () => {
    env.values.botTriageReportsEnabled = true;
    let failRead = true;
    env.redis.get.mockImplementation(async (key) => {
      if (
        failRead &&
        key === `${PREFIX}case:t1_first` &&
        env.read(`${PREFIX}daily:2026-10-30`) === "1"
      ) {
        failRead = false;
        throw new Error("temporary Redis failure");
      }
      return env.read(key);
    });
    await env.create();
    expect(env.reddit.report).not.toHaveBeenCalled();
    expect(
      env.read(`${PREFIX}report:${username.toLowerCase()}`),
    ).toBeUndefined();
    expect(env.read(`${PREFIX}daily:2026-10-30`)).toBe("0");
    vi.setSystemTime(NOW + 16 * 60_000);
    await env.create("t1_later");
    expect(env.reddit.report).toHaveBeenCalledOnce();
  });

  it("retains cooldown and budget after an ambiguous report failure", async () => {
    env.values.botTriageReportsEnabled = true;
    env.reddit.report.mockRejectedValue(new Error("response lost"));
    await env.create();
    expect(env.record().action).toBe("report_failed");
    vi.setSystemTime(NOW + 15 * 60_000);
    await env.create("t1_second");
    expect(env.record("t1_second").action).toBe("cooldown");
    expect(env.reddit.report).toHaveBeenCalledOnce();
  });

  it("records unavailable history without reporting and allows retry after two minutes", async () => {
    Object.assign(env.values, {
      botTriageReportsEnabled: true,
      botTriageReportMedium: true,
      botTriageReportLow: true,
    });
    env.listingGet.mockRejectedValueOnce(new Error("history unavailable"));
    await env.create();
    expect(env.record().assessment).toMatchObject({
      dataQuality: "history_unavailable",
      observedItems: 0,
    });
    expect(env.reddit.report).not.toHaveBeenCalled();
    vi.setSystemTime(NOW + 120_000);
    await env.create("t1_second");
    expect(env.reddit.report).toHaveBeenCalledOnce();
  });

  it("continues the history assessment when account age cannot be fetched", async () => {
    env.reddit.getUserByUsername.mockRejectedValue(
      new Error("user unavailable"),
    );
    await env.create();
    expect(env.listingGet).toHaveBeenCalledOnce();
    expect(env.record().assessment).toMatchObject({
      ageDays: null,
      score: 10,
      tier: "MEDIUM",
    });
  });

  it("never reports zero overlap even with every tier enabled", async () => {
    Object.assign(env.values, {
      botTriageReportsEnabled: true,
      botTriageReportMedium: true,
      botTriageReportLow: true,
    });
    env.listingGet.mockResolvedValue([]);
    await env.create();
    expect(env.record().assessment.score).toBe(4);
    expect(env.reddit.report).not.toHaveBeenCalled();
  });

  it("marks a full 100-item listing as potentially truncated", async () => {
    env.listingGet.mockResolvedValue(
      Array.from({ length: 100 }, (_, i) => ({
        id: `t1_${i}`,
        subredditName: "pcos",
        body: "body",
        createdAt: new Date(NOW - i * 1000),
      })),
    );
    await env.create();
    expect(env.record().assessment.dataQuality).toBe("sample_limit_reached");
  });

  it("fails closed when Redis cannot reserve a budget slot", async () => {
    env.values.botTriageReportsEnabled = true;
    env.redis.incrBy.mockRejectedValue(new Error("Redis unavailable"));
    await env.create();
    expect(env.reddit.report).not.toHaveBeenCalled();
  });

  it("replaces a deleted comment's case with an expiring content-free tombstone", async () => {
    await env.create();
    await env.remove();
    expect(env.read(`${PREFIX}case:t1_first`)).toBe("deleted");
    expect(env.data.get(`${PREFIX}case:t1_first`)?.expiresAt).toBe(
      NOW + 14 * DAY_MS,
    );
    vi.setSystemTime(NOW + 16 * 60_000);
    await env.create();
    expect(env.listingGet).toHaveBeenCalledOnce();
  });

  it("handles deletion before the create event", async () => {
    await env.remove();
    await env.create();
    expect(env.reddit.getCommentById).not.toHaveBeenCalled();
    expect(env.read(`${PREFIX}case:t1_first`)).toBe("deleted");
  });

  it("suppresses reporting when deletion arrives while history is being fetched", async () => {
    env.values.botTriageReportsEnabled = true;
    env.listingGet.mockImplementationOnce(async () => {
      await env.remove();
      return [
        {
          id: "t1_history",
          subredditName: "pcos",
          body: "body",
          createdAt: new Date(NOW),
        },
      ];
    });
    env.values.botTriageReportMedium = true;
    await env.create();
    expect(env.reddit.report).not.toHaveBeenCalled();
    expect(env.read(`${PREFIX}case:t1_first`)).toBe("deleted");
  });

  it("does not restore a case when deletion arrives during the report call", async () => {
    env.values.botTriageReportsEnabled = true;
    env.reddit.report.mockImplementationOnce(async () => {
      await env.remove();
    });
    await env.create();
    expect(env.read(`${PREFIX}case:t1_first`)).toBe("deleted");
  });

  it("suppresses a report when deletion arrives during budget reservation", async () => {
    env.values.botTriageReportsEnabled = true;
    const increment = env.redis.incrBy.getMockImplementation()!;
    env.redis.incrBy.mockImplementationOnce(async (key, amount) => {
      const result = await increment(key, amount);
      await env.remove();
      return result;
    });
    await env.create();
    expect(env.reddit.report).not.toHaveBeenCalled();
    expect(env.read(`${PREFIX}case:t1_first`)).toBe("deleted");
    expect(
      env.read(`${PREFIX}report:${username.toLowerCase()}`),
    ).toBeUndefined();
    expect(env.read(`${PREFIX}daily:2026-10-30`)).toBe("0");
  });

  it("suppresses reporting when history is not newest-first", async () => {
    Object.assign(env.values, {
      botTriageReportsEnabled: true,
      botTriageReportMedium: true,
      botTriageReportLow: true,
    });
    const ordered = await env.listingGet(100);
    env.listingGet.mockResolvedValue([...ordered].reverse());
    await env.create();
    expect(env.record().assessment).toMatchObject({
      dataQuality: "history_unavailable",
      observedItems: 0,
    });
    expect(env.reddit.report).not.toHaveBeenCalled();
  });

  it("propagates deletion storage failures for retry", async () => {
    env.redis.set.mockRejectedValueOnce(new Error("Redis unavailable"));
    await expect(env.remove()).rejects.toThrow("Redis unavailable");
  });
});
