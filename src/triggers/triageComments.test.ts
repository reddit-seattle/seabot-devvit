import type { TriggerContext } from "@devvit/public-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteTriageComment, TriageComment } from "./triageComments.js";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 30, 12);
const PREFIX = "seabot:triage:";
const username = "OrdinaryName";
const reportKey = `${PREFIX}report:${username.toLowerCase()}`;
const budgetKey = `${PREFIX}daily:2026-10-30`;
const commentKey = `${PREFIX}comment:t1_first`;

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
    body: "LOCAL BODY",
  };
  // Five indexed comments plus the trigger make six, with sessions on two dates.
  const history = [
    ["pcos", NOW - 60_000],
    ["nashville", NOW - DAY + 120_000],
    ["pcos", NOW - DAY + 60_000],
    ["seattle", NOW - DAY],
    ["elsewhere", NOW - 2 * DAY],
  ].map(([subredditName, at], i) => ({
    id: `t1_history${i}`,
    subredditName: String(subredditName),
    createdAt: new Date(Number(at)),
    body: "EXTERNAL BODY",
  }));
  const listingGet = vi.fn(async (_limit: number) => history);
  const reddit = {
    getCommentById: vi.fn(async (id: string) => ({ ...comment, id })),
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
    DeleteTriageComment.onEvent(
      { commentId: id } as Parameters<typeof DeleteTriageComment.onEvent>[0],
      context,
    );
  const distinctAuthors = () =>
    reddit.getCommentById.mockImplementation(async (id) => ({
      ...comment,
      id,
      authorName: `User${id.slice(3)}`,
    }));
  return {
    data,
    read,
    redis,
    reddit,
    comment,
    history,
    listingGet,
    values,
    context,
    settings,
    create,
    remove,
    distinctAuthors,
  };
}

describe("comment bot detection", () => {
  let env: ReturnType<typeof setup>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    for (const method of ["log", "warn", "error"] as const)
      vi.spyOn(console, method).mockImplementation(() => {});
    env = setup();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("reports a behavioral match by default and stores only expiring control markers", async () => {
    await env.create();
    expect(env.reddit.report).toHaveBeenCalledExactlyOnceWith(env.comment, {
      reason:
        "SeaBot: possible bot network; 6 comments, 2/3 core subs, 2 burst days (30d sample)",
    });
    expect(env.listingGet).toHaveBeenCalledWith(100);
    expect(env.read(commentKey)).toBe("processed");
    expect(env.data.get(commentKey)?.expiresAt).toBe(NOW + 14 * DAY);
    expect([...env.data.values()].map((x) => x.value).sort()).toEqual([
      "1",
      "1",
      "1",
      "processed",
    ]);
    expect(console.log).toHaveBeenCalledExactlyOnceWith(
      "SeaBot triage",
      "reported",
    );
  });
  it("does not report a non-match", async () => {
    env.listingGet.mockResolvedValue([]);
    await env.create();
    expect(env.reddit.report).not.toHaveBeenCalled();
    expect(env.read(commentKey)).toBe("processed");
    expect(env.read(reportKey)).toBeUndefined();
    expect(env.redis.incrBy).not.toHaveBeenCalled();
  });
  it("stops all evaluation when disabled", async () => {
    env.values.botTriageEnabled = false;
    await env.create();
    expect(env.reddit.getCommentById).not.toHaveBeenCalled();
    expect(env.data.size).toBe(0);
  });
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
    async (author) => {
      env.comment.authorName = author;
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
  it.each([{ botTriageEnabled: "yes" }, { botTriageDailyReportCap: -1 }])(
    "fails closed on invalid controls: %s",
    async (values) => {
      Object.assign(env.values, values);
      await env.create();
      expect(env.listingGet).not.toHaveBeenCalled();
      expect(env.reddit.report).not.toHaveBeenCalled();
      expect(env.data.size).toBe(0);
    },
  );
  it("throttles simultaneous author evaluations and deduplicates completed comments", async () => {
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
    expect(env.reddit.report).toHaveBeenCalledOnce();
  });
  it("preserves the seven-day report cooldown across cap changes", async () => {
    await env.create();
    env.values.botTriageDailyReportCap = 30;
    await env.create("t1_second");
    expect(env.reddit.report).toHaveBeenCalledOnce();
    expect(env.data.get(reportKey)?.expiresAt).toBe(NOW + 7 * DAY);
    vi.setSystemTime(NOW + 7 * DAY);
    await env.create("t1_nextweek");
    expect(env.reddit.report).toHaveBeenCalledTimes(2);
  });
  it("claims reports atomically when evaluations with different caps race", async () => {
    env.settings.getAll
      .mockResolvedValueOnce({ botTriageDailyReportCap: 25 })
      .mockResolvedValueOnce({ botTriageDailyReportCap: 30 });
    await Promise.all([env.create(), env.create("t1_second")]);
    expect(env.listingGet).toHaveBeenCalledTimes(2);
    expect(env.reddit.report).toHaveBeenCalledOnce();
    expect(env.read(budgetKey)).toBe("1");
  });
  it("caps concurrent reports across authors and resets the budget on the next UTC day", async () => {
    env.values.botTriageDailyReportCap = 2;
    env.distinctAuthors();
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => env.create(`t1_${i}`)),
    );
    expect(env.reddit.report).toHaveBeenCalledTimes(2);
    expect(env.read(budgetKey)).toBe("2");
    expect(env.data.get(budgetKey)?.expiresAt).toBe(NOW + 2 * DAY);
    vi.setSystemTime(Date.UTC(2026, 9, 31));
    await env.create("t1_tomorrow");
    expect(env.reddit.report).toHaveBeenCalledTimes(3);
  });
  it("reserves no cooldown for zero cap and applies an increased cap immediately", async () => {
    env.values.botTriageDailyReportCap = 0;
    await env.create();
    expect(env.reddit.report).not.toHaveBeenCalled();
    expect(env.read(reportKey)).toBeUndefined();
    expect(env.redis.incrBy).not.toHaveBeenCalled();
    env.values.botTriageDailyReportCap = 1;
    await env.create("t1_later");
    expect(env.reddit.report).toHaveBeenCalledOnce();
  });
  it("refunds denied reservations so raising the cap provides extra capacity", async () => {
    env.values.botTriageDailyReportCap = 1;
    env.distinctAuthors();
    for (let i = 0; i < 5; i++) await env.create(`t1_${i}`);
    expect(env.reddit.report).toHaveBeenCalledOnce();
    expect(env.read(budgetKey)).toBe("1");
    env.values.botTriageDailyReportCap = 2;
    await env.create("t1_extra");
    expect(env.reddit.report).toHaveBeenCalledTimes(2);
    expect(env.read(budgetKey)).toBe("2");
  });
  it("releases budget without starting a cooldown when the cancellation read fails", async () => {
    env.redis.get.mockImplementation(async (key) => {
      if (key === commentKey && env.read(budgetKey) === "1")
        throw new Error("Redis unavailable");
      return env.read(key);
    });
    await env.create();
    expect(env.reddit.report).not.toHaveBeenCalled();
    expect(env.read(reportKey)).toBeUndefined();
    expect(env.read(budgetKey)).toBe("0");
  });
  it("retains cooldown and budget after an ambiguous report failure", async () => {
    env.reddit.report.mockRejectedValue(new Error("response lost"));
    await env.create();
    expect(env.read(budgetKey)).toBe("1");
    expect(env.read(reportKey)).toBe("1");
    expect(console.log).toHaveBeenCalledWith("SeaBot triage", "report_failed");
    vi.setSystemTime(NOW + 15 * 60_000);
    await env.create("t1_later");
    expect(env.reddit.report).toHaveBeenCalledOnce();
  });
  it("suppresses reports after history failure and retries on a later comment after two minutes", async () => {
    env.listingGet.mockRejectedValueOnce(new Error("history unavailable"));
    await env.create();
    expect(env.reddit.report).not.toHaveBeenCalled();
    expect(env.read(commentKey)).toBeUndefined();
    vi.setSystemTime(NOW + 120_000);
    await env.create("t1_later");
    expect(env.reddit.report).toHaveBeenCalledOnce();
  });
  it("suppresses reports for out-of-order history", async () => {
    env.listingGet.mockResolvedValue([...env.history].reverse());
    await env.create();
    expect(env.reddit.report).not.toHaveBeenCalled();
  });
  it("fails closed when Redis cannot reserve budget", async () => {
    env.redis.incrBy.mockRejectedValue(new Error("Redis unavailable"));
    await env.create();
    expect(env.reddit.report).not.toHaveBeenCalled();
    expect(env.read(reportKey)).toBeUndefined();
  });
  it("retains deletion tombstones before and after processing", async () => {
    await env.remove();
    await env.create();
    expect(env.reddit.getCommentById).not.toHaveBeenCalled();
    await env.create("t1_second");
    await env.remove("t1_second");
    expect(env.read(`${PREFIX}comment:t1_second`)).toBe("deleted");
    expect(env.data.get(commentKey)?.expiresAt).toBe(NOW + 14 * DAY);
  });
  it("suppresses reporting when deletion arrives during history fetching", async () => {
    env.listingGet.mockImplementationOnce(async () => {
      await env.remove();
      return env.history;
    });
    await env.create();
    expect(env.reddit.report).not.toHaveBeenCalled();
    expect(env.read(commentKey)).toBe("deleted");
  });
  it("cannot overwrite deletion during a report", async () => {
    env.reddit.report.mockImplementationOnce(async () => {
      await env.remove();
    });
    await env.create();
    expect(env.read(commentKey)).toBe("deleted");
  });
  it("cancels and refunds if deletion arrives during budget reservation", async () => {
    const increment = env.redis.incrBy.getMockImplementation()!;
    env.redis.incrBy.mockImplementationOnce(async (key, amount) => {
      const result = await increment(key, amount);
      await env.remove();
      return result;
    });
    await env.create();
    expect(env.reddit.report).not.toHaveBeenCalled();
    expect(env.read(commentKey)).toBe("deleted");
    expect(env.read(reportKey)).toBeUndefined();
    expect(env.read(budgetKey)).toBe("0");
  });
  it("propagates deletion storage failures for retry", async () => {
    env.redis.set.mockRejectedValueOnce(new Error("Redis unavailable"));
    await expect(env.remove()).rejects.toThrow("Redis unavailable");
  });
});
