import type { TriggerContext } from "@devvit/public-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteTriageCase, TriageComment } from "./triageComments.js";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 1, 12);
const PREFIX = "seabot:triage:";
const username = "CustomName";

function history(subs = ["pcos", "testosterone", "nashville"]) {
  return subs.map((subredditName, i) => ({
    id: `t1_history${i}`,
    subredditName,
    createdAt: new Date(NOW - i * 1000),
  }));
}

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
    set: vi.fn(async (
      key: string, value: string, options?: { nx?: boolean; expiration?: Date },
    ) => {
      if (options?.nx && read(key) !== undefined) return "";
      data.set(key, { value, expiresAt: options?.expiration?.getTime() });
      return "OK";
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
    removed: false, spam: false, approved: false,
  };
  const listingGet = vi.fn(async (_limit: number) => history());
  const reddit = {
    getCommentById: vi.fn(async (id: string) => ({ ...comment, id })),
    getUserByUsername: vi.fn(),
    getCommentsAndPostsByUser: vi.fn((_options: unknown) => ({ get: listingGet })),
    report: vi.fn(async (_comment: unknown, _options: { reason: string }) => {}),
  };
  const settings = { get: vi.fn(async (_key: string): Promise<unknown> => undefined) };
  const context = {
    reddit, redis, settings, subredditName: "Seattle", appName: "seattle-bot",
  } as unknown as TriggerContext;
  const create = (id = "t1_first") => TriageComment.onEvent(
    { comment: { id } } as Parameters<typeof TriageComment.onEvent>[0], context,
  );
  const remove = (id = "t1_first") => DeleteTriageCase.onEvent(
    { commentId: id } as Parameters<typeof DeleteTriageCase.onEvent>[0], context,
  );
  return { data, read, redis, reddit, comment, listingGet, context, settings, create, remove };
}

describe("commenter participation reports", () => {
  let env: ReturnType<typeof setup>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.spyOn(console, "error").mockImplementation(() => {});
    env = setup();
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it.each([
    [[], false],
    [["pcos"], false],
    [["testosterone"], false],
    [["nashville"], false],
    [["pcos", "testosterone"], true],
    [["pcos", "nashville"], true],
    [["testosterone", "nashville"], true],
    [["pcos", "testosterone", "nashville"], true],
    [["pcos", "PCOS", "/r/PCOS", "supplements", "sideprojects", "blooddonors"], false],
    [["r/PCOS", " /r/Nashville "], true],
  ] as [string[], boolean][])("reports %j only when two distinct targets match (%s)", async (subs, report) => {
    env.listingGet.mockResolvedValue(history(subs));
    await env.create();
    expect(env.reddit.report).toHaveBeenCalledTimes(Number(report));
    expect(env.reddit.getUserByUsername).not.toHaveBeenCalled();
    if (report) {
      const reason = env.reddit.report.mock.calls[0][1].reason;
      expect(reason).toMatch(/^SeaBot review: prior activity in r\//);
      expect(reason.length).toBeLessThanOrEqual(100);
    }
  });

  it("reports the matching communities and stores only expiring markers", async () => {
    await env.create();
    expect(env.reddit.report).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "t1_first" }),
      { reason: "SeaBot review: prior activity in r/pcos, r/testosterone, r/nashville" },
    );
    expect(env.reddit.getCommentsAndPostsByUser).toHaveBeenCalledWith({
      username, sort: "new", limit: 100,
    });
    expect(env.listingGet).toHaveBeenCalledWith(100);
    expect(env.data.get(`${PREFIX}case:t1_first`)).toEqual({
      value: "processed", expiresAt: NOW + 14 * DAY,
    });
    expect([...env.data.values()].map((entry) => entry.value).sort()).toEqual(["1", "1", "processed"]);
  });

  it.each([false, "true", null, 1])("does no work for disabled or invalid setting %s", async (value) => {
    env.settings.get.mockResolvedValue(value);
    await env.create();
    expect(env.reddit.getCommentById).not.toHaveBeenCalled();
    expect(env.data.size).toBe(0);
  });

  it("honors enabling the rule immediately", async () => {
    env.settings.get.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await env.create();
    await env.create("t1_second");
    expect(env.reddit.report).toHaveBeenCalledOnce();
  });

  it.each(["removed", "spam", "approved"] as const)("skips %s comments", async (flag) => {
    env.comment[flag] = true;
    await env.create();
    expect(env.listingGet).not.toHaveBeenCalled();
  });

  it.each(["", "[deleted]", "AutoModerator", "Seattle-ModTeam", "SEATTLE-BOT", undefined])(
    "skips author %s", async (authorName) => {
      Object.assign(env.comment, { authorName });
      await env.create();
      expect(env.listingGet).not.toHaveBeenCalled();
    },
  );

  it.each(["elsewhere", undefined])("ignores installation %s for both triggers", async (name) => {
    env.context.subredditName = name;
    await env.create();
    await env.remove();
    expect(env.reddit.getCommentById).not.toHaveBeenCalled();
    expect(env.data.size).toBe(0);
  });

  it("ignores malformed events and comments fetched from other subreddits", async () => {
    for (const event of [{}, { comment: {} }, { comment: { id: "t3_post" } }]) {
      await TriageComment.onEvent(event as Parameters<typeof TriageComment.onEvent>[0], env.context);
    }
    for (const event of [{}, { commentId: "t3_post" }]) {
      await DeleteTriageCase.onEvent(event as Parameters<typeof DeleteTriageCase.onEvent>[0], env.context);
    }
    expect(env.reddit.getCommentById).not.toHaveBeenCalled();
    expect(env.data.size).toBe(0);
    env.comment.subredditName = "elsewhere";
    await env.create();
    expect(env.listingGet).not.toHaveBeenCalled();
  });

  it("throttles simultaneous non-matches and rechecks later comments after 15 minutes", async () => {
    env.listingGet.mockResolvedValueOnce(history(["pcos"]));
    await Promise.all([env.create(), env.create("t1_second"), env.create("t1_third")]);
    expect(env.listingGet).toHaveBeenCalledOnce();
    expect(env.reddit.report).not.toHaveBeenCalled();
    vi.setSystemTime(NOW + 15 * 60_000);
    await env.create("t1_later");
    expect(env.listingGet).toHaveBeenCalledTimes(2);
    expect(env.reddit.report).toHaveBeenCalledOnce();
  });

  it("preserves the case marker and case-insensitive seven-day author cooldown", async () => {
    await env.create();
    env.comment.authorName = "CUSTOMNAME";
    await env.create("t1_second");
    expect(env.listingGet).toHaveBeenCalledOnce();
    expect(env.data.get(`${PREFIX}report:customname`)?.expiresAt).toBe(NOW + 7 * DAY);
    vi.setSystemTime(NOW + 7 * DAY);
    await env.create(); // A replay of the already reported comment still cannot report.
    expect(env.listingGet).toHaveBeenCalledOnce();
    await env.create("t1_nextweek");
    expect(env.reddit.report).toHaveBeenCalledTimes(2);
  });

  it("honors report cooldowns left by the previous implementation", async () => {
    await env.redis.set(`${PREFIX}report:customname`, "1", { expiration: new Date(NOW + DAY) });
    await env.create();
    expect(env.listingGet).not.toHaveBeenCalled();
    expect(env.reddit.report).not.toHaveBeenCalled();
  });

  it("claims reports atomically even when an earlier history request outlives the throttle", async () => {
    const fetch = env.listingGet.getMockImplementation()!;
    env.listingGet.mockImplementationOnce(async (limit) => {
      vi.setSystemTime(NOW + 15 * 60_000);
      await env.create("t1_second");
      return fetch(limit);
    });
    await env.create();
    expect(env.listingGet).toHaveBeenCalledTimes(2);
    expect(env.reddit.report).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "t1_second" }), expect.anything(),
    );
  });

  it("does not impose a daily cap across different qualifying users", async () => {
    env.reddit.getCommentById.mockImplementation(async (id) => ({
      ...env.comment, id, authorName: `user_${id}`,
    }));
    await Promise.all(Array.from({ length: 30 }, (_, i) => env.create(`t1_${i}`)));
    expect(env.reddit.report).toHaveBeenCalledTimes(30);
  });

  it("retries on a later comment two minutes after history failure", async () => {
    env.listingGet.mockRejectedValueOnce(new Error("unavailable"));
    await env.create();
    expect(env.reddit.report).not.toHaveBeenCalled();
    expect(env.read(`${PREFIX}report:customname`)).toBeUndefined();
    vi.setSystemTime(NOW + 119_999);
    await env.create("t1_early");
    expect(env.listingGet).toHaveBeenCalledOnce();
    vi.setSystemTime(NOW + 120_000);
    await env.create("t1_retry");
    expect(env.reddit.report).toHaveBeenCalledOnce();
  });

  it("retains the cooldown after an ambiguous report failure", async () => {
    env.reddit.report.mockRejectedValueOnce(new Error("response lost"));
    await env.create();
    vi.setSystemTime(NOW + 15 * 60_000);
    await env.create("t1_second");
    expect(env.reddit.report).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalled();
  });

  it.each(["settings", "comment", "redis read", "redis claim"])("does not report after a %s failure", async (failure) => {
    const operation = {
      settings: env.settings.get, comment: env.reddit.getCommentById,
      "redis read": env.redis.get, "redis claim": env.redis.set,
    }[failure]!;
    operation.mockRejectedValueOnce(new Error("unavailable"));
    await env.create();
    expect(env.reddit.report).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it("does not claim an author when the final deletion check fails", async () => {
    env.redis.get.mockImplementation(async (key) => {
      if (key === `${PREFIX}case:t1_first` && env.listingGet.mock.calls.length) {
        throw new Error("unavailable");
      }
      return env.read(key);
    });
    await env.create();
    expect(env.reddit.report).not.toHaveBeenCalled();
    expect(env.read(`${PREFIX}report:customname`)).toBeUndefined();
  });

  it("handles deletion before creation and replaces old evidence with a tombstone", async () => {
    await env.redis.set(`${PREFIX}case:t1_first`, '{"assessment":{"score":13}}');
    await env.remove();
    await env.create();
    expect(env.reddit.getCommentById).not.toHaveBeenCalled();
    expect(env.data.get(`${PREFIX}case:t1_first`)).toEqual({
      value: "deleted", expiresAt: NOW + 14 * DAY,
    });
  });

  it("does not report when deletion arrives during history lookup", async () => {
    env.listingGet.mockImplementationOnce(async () => {
      await env.remove();
      return history();
    });
    await env.create();
    expect(env.reddit.report).not.toHaveBeenCalled();
    expect(env.read(`${PREFIX}report:customname`)).toBeUndefined();
  });

  it("cannot overwrite deletion arriving during report submission", async () => {
    env.reddit.report.mockImplementationOnce(async () => { await env.remove(); });
    await env.create();
    expect(env.read(`${PREFIX}case:t1_first`)).toBe("deleted");
  });

  it("propagates deletion storage errors so Devvit can retry", async () => {
    env.redis.set.mockRejectedValueOnce(new Error("unavailable"));
    await expect(env.remove()).rejects.toThrow("unavailable");
  });
});
