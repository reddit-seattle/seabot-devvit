import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModActionDefinition, TriggerContext } from "@devvit/public-api";
import LogModActions, {
  SetupModerationLog,
} from "../triggers/logModActions.js";
import { MODLOG_IGNORED_ACTIONS, MODLOG_WEBHOOK } from "../settings.js";
import { DiscordDeliveryError, parseWebhook, sendToThread } from "./discord.js";
import { formatAction, groupFor, normalizeAction } from "./events.js";
import {
  deliverPending,
  enqueueAction,
  ensureModlogSchedule,
  MODLOG_JOB,
} from "./queue.js";

type Action = Parameters<ModActionDefinition["onEvent"]>[0];
const WEBHOOK = "https://discord.com/api/webhooks/123456789/SYNTHETIC_TOKEN";
const THREAD = "987654321";

// Persistent fake with expirations, SET NX, WATCH conflict detection and atomic EXEC.
// Tests drive the actual trigger, queue, formatter and HTTP sender together.
function fixture() {
  const values = new Map<string, { value: string; expiry: number }>();
  const sets = new Map<string, Map<string, number>>();
  const versions = new Map<string, number>();
  const touch = (key: string) =>
    versions.set(key, (versions.get(key) || 0) + 1);
  const read = (key: string) => {
    const data = values.get(key);
    if (data && data.expiry <= Date.now()) {
      values.delete(key);
      touch(key);
      return undefined;
    }
    return data?.value;
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
        values.set(key, {
          value,
          expiry: options?.expiration?.getTime() || Infinity,
        });
        touch(key);
        return "OK";
      },
    ),
    del: vi.fn(async (...keys: string[]) => {
      for (const key of keys) {
        values.delete(key);
        touch(key);
      }
    }),
    zAdd: vi.fn(
      async (key: string, ...members: { member: string; score: number }[]) => {
        const set = sets.get(key) || new Map<string, number>();
        members.forEach(({ member, score }) => set.set(member, score));
        sets.set(key, set);
        touch(key);
        return members.length;
      },
    ),
    zRem: vi.fn(async (key: string, members: string[]) => {
      members.forEach((member) => sets.get(key)?.delete(member));
      touch(key);
      return members.length;
    }),
    zRange: vi.fn(
      async (
        key: string,
        min: number,
        max: number,
        options: { limit: { count: number } },
      ) =>
        [...(sets.get(key) || [])]
          .filter(([, score]) => score >= min && score <= max)
          .sort((a, b) => a[1] - b[1])
          .slice(0, options.limit.count)
          .map(([member, score]) => ({ member, score })),
    ),
    watch: vi.fn(async (...keys: string[]) => {
      keys.forEach(read);
      const original = keys.map((key) => versions.get(key) || 0);
      const commands: (() => Promise<unknown>)[] = [];
      return {
        multi: async () => {},
        set: async (...args: Parameters<typeof redis.set>) => {
          commands.push(() => redis.set(...args));
        },
        del: async (...args: string[]) => {
          commands.push(() => redis.del(...args));
        },
        zAdd: async (...args: Parameters<typeof redis.zAdd>) => {
          commands.push(() => redis.zAdd(...args));
        },
        exec: async () => {
          keys.forEach(read);
          if (
            keys.some(
              (key, index) => (versions.get(key) || 0) !== original[index],
            )
          )
            return [];
          const results = [];
          for (const command of commands) results.push(await command());
          return results;
        },
        discard: async () => {},
      };
    }),
  };
  const settings = new Map([[MODLOG_WEBHOOK, WEBHOOK]]);
  const jobs: { name: string; cron: string }[] = [];
  const api = {
    redis,
    subredditName: "Seattle",
    settings: { get: vi.fn(async (name: string) => settings.get(name)) },
    scheduler: {
      listJobs: vi.fn(async () => jobs),
      runJob: vi.fn(async (job: { name: string; cron: string }) => {
        jobs.push(job);
        return "job1";
      }),
    },
    reddit: {
      getPostById: vi.fn(async () => ({ title: "Seattle transit discussion" })),
      getCommentById: vi.fn(async () => ({ postId: "t3_abc" })),
      getModerationLog: vi.fn(() => ({
        all: vi.fn(async () => [
          { id: "ModAction_a1", description: "Removed", details: "Rule 1" },
          { id: "ModAction_other", details: "Unrelated reason" },
        ]),
      })),
    },
  };
  const context = api as unknown as TriggerContext;
  const action = (overrides: Partial<Action> = {}): Action =>
    ({
      id: "ModAction_a1",
      action: "removelink",
      actionedAt: new Date("2026-10-31T12:00:00Z"),
      moderator: { name: "test_mod" },
      subreddit: { name: "Seattle" },
      targetPost: { id: "t3_abc" },
      ...overrides,
    }) as Action;
  return { context, api, redis, settings, action, values, sets };
}

const response = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, headers });
const calls = () =>
  vi
    .mocked(fetch)
    .mock.calls.map(([url, init]) => ({
      url: String(url),
      body: JSON.parse(String(init?.body)),
    }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-31T12:00:00Z"));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response({ id: THREAD, channel_id: THREAD })),
  );
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("moderation log pipeline", () => {
  it("stays disabled without a destination and filters configured actions", async () => {
    const f = fixture();
    f.settings.delete(MODLOG_WEBHOOK);
    await LogModActions.onEvent(f.action(), f.context);
    f.settings.set(MODLOG_WEBHOOK, WEBHOOK);
    f.settings.set(MODLOG_IGNORED_ACTIONS, " approvelink, REMOVElink ");
    await LogModActions.onEvent(f.action(), f.context);
    expect(f.redis.watch).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("creates one thread for a post and appends its comments, with matched reasons and no mentions", async () => {
    const f = fixture();
    await LogModActions.onEvent(f.action(), f.context);
    await LogModActions.onEvent(
      f.action({
        id: "a2",
        action: "removecomment",
        targetPost: undefined,
        targetComment: {
          id: "t1_def",
          postId: "t3_abc",
        } as Action["targetComment"],
      }),
      f.context,
    );
    await deliverPending(f.context);
    expect(calls()[0].body.thread_name).toBe(
      "abc — Seattle transit discussion",
    );
    expect(calls()[0].url).toContain("wait=true");
    expect(calls()[0].body.allowed_mentions).toEqual({ parse: [] });
    expect(JSON.stringify(calls()[0].body)).toContain("Rule 1");
    expect(JSON.stringify(calls()[1].body)).not.toContain("Rule 1");
    expect(calls()[1].url).toContain(`thread_id=${THREAD}`);
    expect(calls()[1].body.thread_name).toBeUndefined();
    expect(calls()[1].body.embeds[0].url).toContain(
      "/comments/abc/comment/def/",
    );
    expect(f.sets.get("modlog:pending")?.size).toBe(0);
  });

  it("deduplicates repeated events both before and after delivery", async () => {
    const f = fixture();
    await LogModActions.onEvent(f.action(), f.context);
    await LogModActions.onEvent(f.action(), f.context);
    await deliverPending(f.context);
    await LogModActions.onEvent(f.action({ id: "a1" }), f.context);
    await deliverPending(f.context);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("serializes overlapping workers so they cannot create duplicate threads", async () => {
    const f = fixture();
    await LogModActions.onEvent(f.action(), f.context);
    await LogModActions.onEvent(f.action({ id: "a2" }), f.context);
    await Promise.all([deliverPending(f.context), deliverPending(f.context)]);
    expect(calls()).toHaveLength(2);
    expect(calls().filter((call) => call.body.thread_name)).toHaveLength(1);
  });

  it("honors rate limits across the entire queue and retries the same event", async () => {
    const f = fixture();
    await LogModActions.onEvent(f.action(), f.context);
    await LogModActions.onEvent(f.action({ id: "a2" }), f.context);
    vi.mocked(fetch).mockResolvedValueOnce(
      response({ retry_after: 120.5 }, 429),
    );
    await deliverPending(f.context);
    await deliverPending(f.context);
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(121_000);
    await deliverPending(f.context);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(f.sets.get("modlog:pending")?.size).toBe(0);
  });

  it.each([500, 502, 503])(
    "retries HTTP %i without marking delivery successful",
    async (status) => {
      const f = fixture();
      await LogModActions.onEvent(f.action(), f.context);
      vi.mocked(fetch).mockResolvedValueOnce(response({}, status));
      await deliverPending(f.context);
      expect(
        [...f.values.keys()].some((key) => key.startsWith("modlog:done:")),
      ).toBe(false);
      vi.advanceTimersByTime(60_000);
      await deliverPending(f.context);
      expect(fetch).toHaveBeenCalledTimes(2);
    },
  );

  it("replaces a deleted thread but preserves mappings for locked/missing-webhook failures", async () => {
    const f = fixture();
    await LogModActions.onEvent(f.action(), f.context);
    await deliverPending(f.context);
    await LogModActions.onEvent(f.action({ id: "a2" }), f.context);
    vi.mocked(fetch).mockResolvedValueOnce(response({ code: 10003 }, 404));
    await deliverPending(f.context);
    vi.advanceTimersByTime(60_000);
    await deliverPending(f.context);
    expect(calls()[2].body.thread_name).toBeDefined();
    await LogModActions.onEvent(f.action({ id: "a3" }), f.context);
    vi.mocked(fetch).mockResolvedValueOnce(response({ code: 50083 }, 403));
    await deliverPending(f.context);
    vi.advanceTimersByTime(900_000);
    await deliverPending(f.context);
    expect(calls()[4].url).toContain(`thread_id=${THREAD}`);
  });

  it("drops old-destination events and uses a fresh mapping after changing webhooks", async () => {
    const f = fixture();
    await LogModActions.onEvent(f.action(), f.context);
    f.settings.set(MODLOG_WEBHOOK, WEBHOOK.replace("123456789", "222222222"));
    await LogModActions.onEvent(f.action({ id: "a2" }), f.context);
    await deliverPending(f.context);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(calls()[0].url).toContain("222222222");
    expect(calls()[0].body.thread_name).toBeDefined();
  });

  it("discards pending events on disable and expires undelivered events after 24 hours", async () => {
    const f = fixture();
    await LogModActions.onEvent(f.action(), f.context);
    f.settings.delete(MODLOG_WEBHOOK);
    await deliverPending(f.context);
    f.settings.set(MODLOG_WEBHOOK, WEBHOOK);
    await LogModActions.onEvent(f.action({ id: "a2" }), f.context);
    vi.advanceTimersByTime(86_400_001);
    await deliverPending(f.context);
    expect(fetch).not.toHaveBeenCalled();
    expect(f.sets.get("modlog:pending")?.size).toBe(0);
  });

  it("doesn't send after losing its worker lease during enrichment", async () => {
    const f = fixture();
    await LogModActions.onEvent(f.action(), f.context);
    f.api.reddit.getPostById.mockImplementationOnce(async () => {
      await f.redis.set("modlog:worker", "another-worker");
      return { title: "test" };
    });
    await deliverPending(f.context);
    expect(fetch).not.toHaveBeenCalled();
    expect(await f.redis.get("modlog:worker")).toBe("another-worker");
  });

  it("sets up one recurring job on install/upgrade", async () => {
    const f = fixture();
    await ensureModlogSchedule(f.context);
    await ensureModlogSchedule(f.context);
    expect(SetupModerationLog.events).toEqual(["AppInstall", "AppUpgrade"]);
    expect(f.api.scheduler.runJob).toHaveBeenCalledExactlyOnceWith({
      name: MODLOG_JOB,
      cron: "* * * * *",
    });
  });
});

describe("action formatting and grouping", () => {
  it("groups account actions by stable user ID and community actions by UTC date", async () => {
    const f = fixture();
    const entry = await normalizeAction(
      f.action({
        targetPost: undefined,
        action: "banuser",
        targetUser: { id: "t2_user", name: "Example" } as Action["targetUser"],
      }),
      f.context,
    );
    expect(groupFor(entry)).toBe("user:t2_user");
    expect((await formatAction(entry, f.context)).threadName).toBe(
      "u/Example — moderation",
    );
    const community = await normalizeAction(
      f.action({ targetPost: undefined, action: "editsettings" }),
      f.context,
    );
    expect(groupFor(community)).toBe("community:2026-10-31");
  });

  it("resolves a missing comment post ID and survives unavailable targets/reasons", async () => {
    const f = fixture();
    const entry = await normalizeAction(
      f.action({
        targetPost: undefined,
        targetComment: { id: "t1_def" } as Action["targetComment"],
      }),
      f.context,
    );
    expect(entry.postId).toBe("t3_abc");
    f.api.reddit.getPostById.mockRejectedValueOnce(new Error("deleted"));
    f.api.reddit.getModerationLog.mockImplementationOnce(() => {
      throw new Error("unavailable");
    });
    expect((await formatAction(entry, f.context)).threadName).toBe(
      "Post abc — r/Seattle",
    );
  });

  it("bounds and escapes untrusted text and never queues bodies or tokens", async () => {
    const f = fixture();
    f.api.reddit.getPostById.mockResolvedValue({
      title: "@everyone\n" + "a".repeat(500),
    });
    const entry = await normalizeAction(
      f.action({
        moderator: { name: "@everyone [link](evil)" } as Action["moderator"],
      }),
      f.context,
    );
    const formatted = await formatAction(entry, f.context);
    expect(formatted.threadName.length).toBeLessThanOrEqual(100);
    expect(JSON.stringify(formatted.payload)).not.toContain("@everyone");
    expect(formatted.payload.embeds[0].fields[0].value).toContain("\\[link\\]");
    await enqueueAction(entry, "123456789", f.context);
    const stored = JSON.stringify([...f.values.values()]);
    expect(stored).not.toContain("SYNTHETIC_TOKEN");
    expect(stored).not.toContain("selftext");
  });

  it("keeps distinct fallback actions when an ID and timestamp are unavailable", async () => {
    const f = fixture();
    const event = f.action({ id: undefined, actionedAt: undefined });
    const first = await normalizeAction(event, f.context);
    const second = await normalizeAction(event, f.context);
    expect(first.id).not.toBe(second.id);
  });
});

describe("Discord transport", () => {
  it.each([
    "https://evil.example/api/webhooks/1/token",
    `${WEBHOOK}?thread_id=1`,
    "http://discord.com/api/webhooks/1/token",
    "invalid",
  ])("rejects unsupported destination %s", (url) => {
    expect(() => parseWebhook(url)).toThrow();
  });

  it("redacts network errors and does not treat a text-channel response as a thread", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error(WEBHOOK));
    await expect(sendToThread(WEBHOOK, {}, { name: "test" })).rejects.toThrow(
      "HTTP 0",
    );
    vi.mocked(fetch).mockResolvedValueOnce(
      response({ id: "111", channel_id: "222" }),
    );
    await expect(
      sendToThread(WEBHOOK, {}, { name: "test" }),
    ).rejects.toBeInstanceOf(DiscordDeliveryError);
  });
});
