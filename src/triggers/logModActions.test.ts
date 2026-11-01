import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModActionDefinition, TriggerContext } from "@devvit/public-api";
import { MODLOG_IGNORED_ACTIONS, MODLOG_WEBHOOK } from "../settings.js";
import LogModActions from "./logModActions.js";

type Action = Parameters<ModActionDefinition["onEvent"]>[0];
const WEBHOOK = "https://discord.com/api/webhooks/123/SYNTHETIC_TOKEN";
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const calls = () =>
  vi.mocked(fetch).mock.calls.map(([url, options]) => ({
    url: String(url),
    body: JSON.parse(String(options?.body)),
  }));

function fixture() {
  const settings = new Map([[MODLOG_WEBHOOK, WEBHOOK]]);
  const stored = new Map<string, string>();
  const redis = {
    get: async (key: string) => stored.get(key),
    set: async (key: string, value: string, options?: { nx?: boolean }) => {
      if (options?.nx && stored.has(key)) return "";
      stored.set(key, value);
      return "OK";
    },
    del: async (key: string) => {
      stored.delete(key);
    },
    watch: async (key: string) => {
      const original = stored.get(key);
      return {
        multi: async () => {},
        del: async () => {},
        discard: async () => {},
        exec: async () => {
          if (stored.get(key) === original) stored.delete(key);
          return [1];
        },
      };
    },
  };
  const reddit = {
    getCommentById: vi.fn(async () => ({ postId: "t3_abc" })),
    getPostById: vi.fn(async () => ({ title: "Seattle transit discussion" })),
    getModerationLog: vi.fn(() => ({
      all: async () => [
        { id: "ModAction_one", details: "Rule 1" },
        { id: "other", details: "Unrelated reason" },
      ],
    })),
  };
  const context = {
    redis,
    reddit,
    subredditName: "Seattle",
    settings: { get: async (name: string) => settings.get(name) },
  } as unknown as TriggerContext;
  const event = (overrides: Partial<Action> = {}): Action =>
    ({
      id: "ModAction_one",
      action: "removelink",
      actionedAt: new Date("2026-11-01T12:00:00Z"),
      moderator: { name: "test_mod" },
      targetPost: { id: "t3_abc" },
      ...overrides,
    }) as Action;
  const send = (overrides: Partial<Action> = {}) =>
    LogModActions.onEvent(event(overrides), context);
  return { settings, stored, reddit, send };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => reply({ id: "999", channel_id: "999" })),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("LogModActions", () => {
  it("skips disabled destinations and excluded actions", async () => {
    const f = fixture();
    f.settings.delete(MODLOG_WEBHOOK);
    await f.send();
    f.settings.set(MODLOG_WEBHOOK, WEBHOOK);
    f.settings.set(MODLOG_IGNORED_ACTIONS, " approvelink, REMOVElink ");
    await f.send();
    expect(fetch).not.toHaveBeenCalled();
    expect(f.reddit.getPostById).not.toHaveBeenCalled();
  });

  it("creates a post thread, appends comments, suppresses duplicates and matches reasons by ID", async () => {
    const f = fixture();
    await f.send();
    await f.send({
      id: "two",
      action: "removecomment",
      targetPost: undefined,
      targetComment: {
        id: "t1_def",
        postId: "t3_abc",
      } as Action["targetComment"],
    });
    await f.send({ id: "one" });
    expect(calls()).toHaveLength(2);
    expect(calls()[0].body.thread_name).toBe(
      "abc — Seattle transit discussion",
    );
    expect(calls()[0].url).toContain("wait=true");
    expect(calls()[1].url).toContain("thread_id=999");
    expect(calls()[1].body.thread_name).toBeUndefined();
    expect(calls()[1].body.embeds[0].url).toContain(
      "/comments/abc/comment/def/",
    );
    expect(JSON.stringify(calls()[0].body)).toContain("Rule 1");
    expect(JSON.stringify(calls()[1].body)).not.toContain("Rule 1");
    expect(JSON.stringify(calls())).not.toContain("Unrelated reason");
  });

  it.each([true, false])(
    "serializes simultaneous events (duplicate=%s)",
    async (duplicate) => {
      const f = fixture();
      const sending = Promise.all([
        f.send(),
        f.send({ id: duplicate ? "one" : "two" }),
      ]);
      await vi.advanceTimersByTimeAsync(250);
      await sending;
      expect(calls()).toHaveLength(duplicate ? 1 : 2);
      expect(calls().filter((call) => call.body.thread_name)).toHaveLength(1);
    },
  );

  it("groups bans/unbans by user and community actions by UTC date", async () => {
    const f = fixture();
    const user = { id: "t2_abc", name: "Example" } as Action["targetUser"];
    await f.send({
      action: "banuser",
      targetPost: undefined,
      targetUser: user,
    });
    await f.send({
      id: "two",
      action: "unbanuser",
      targetPost: undefined,
      targetUser: user,
    });
    await f.send({
      id: "three",
      action: "editsettings",
      targetPost: undefined,
    });
    expect(calls()[0].body.thread_name).toBe("u/Example — moderation");
    expect(calls()[1].url).toContain("thread_id=999");
    expect(calls()[2].body.thread_name).toBe("r/Seattle — 2026-11-01 UTC");
  });

  it("resolves comment parents and still logs masked/deleted targets when enrichment fails", async () => {
    const f = fixture();
    f.reddit.getPostById.mockRejectedValue(new Error("deleted"));
    f.reddit.getModerationLog.mockImplementation(() => {
      throw new Error("unavailable");
    });
    await f.send({
      targetPost: undefined,
      moderator: undefined,
      targetComment: { id: "t1_def" } as Action["targetComment"],
    });
    expect(calls()[0].body.thread_name).toBe("abc — r/Seattle");
    expect(JSON.stringify(calls()[0].body)).toContain("Unavailable / masked");
  });

  it("bounds/escapes text, disables mentions and stores only IDs and locks", async () => {
    const f = fixture();
    f.reddit.getPostById.mockResolvedValue({
      title: "@everyone " + "a".repeat(500),
    });
    await f.send({
      moderator: { name: "@everyone [link](evil)" } as Action["moderator"],
    });
    expect(calls()[0].body.thread_name.length).toBeLessThanOrEqual(100);
    expect(calls()[0].body.allowed_mentions).toEqual({ parse: [] });
    expect(calls()[0].body.embeds[0].fields[0].value).toContain("\\[link\\]");
    expect(JSON.stringify(calls())).not.toContain("@everyone");
    expect([...f.stored.values()]).toEqual(
      expect.arrayContaining(["999", "1"]),
    );
    expect([...f.stored.values()].every((value) => /^\d+$/.test(value))).toBe(
      true,
    );
  });

  it.each([429, 500, 403, 404])(
    "logs HTTP %i with no background retry or success marker",
    async (status) => {
      const f = fixture();
      vi.mocked(fetch).mockResolvedValueOnce(reply({ code: 10015 }, status));
      await f.send();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(f.stored.size).toBe(0);
      expect(console.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(String(status)),
      );
      await f.send();
      expect(fetch).toHaveBeenCalledTimes(2);
    },
  );

  it("recreates a confirmed deleted thread once, but keeps a locked thread mapping", async () => {
    const f = fixture();
    await f.send();
    vi.mocked(fetch).mockResolvedValueOnce(reply({ code: 10003 }, 404));
    await f.send({ id: "two" });
    expect(calls()[2].body.thread_name).toBeDefined();
    vi.mocked(fetch).mockResolvedValueOnce(reply({ code: 50083 }, 403));
    await f.send({ id: "three" });
    await f.send({ id: "four" });
    expect(calls()[4].url).toContain("thread_id=999");
  });

  it("preserves threads on token rotation and starts fresh for a different webhook", async () => {
    const f = fixture();
    await f.send();
    f.settings.set(
      MODLOG_WEBHOOK,
      WEBHOOK.replace("SYNTHETIC_TOKEN", "NEW_TOKEN"),
    );
    await f.send({ id: "two" });
    expect(calls()[1].url).toContain("thread_id=999");
    f.settings.set(MODLOG_WEBHOOK, WEBHOOK.replace("123", "456"));
    await f.send();
    expect(calls()[2].body.thread_name).toBeDefined();
  });

  it("bounds lock waits and doesn't release another sender's lock", async () => {
    const f = fixture();
    f.stored.set("modlog:123:t3_abc:lock", "another-sender");
    const pending = f.send();
    await vi.advanceTimersByTimeAsync(10_000);
    await pending;
    expect(fetch).not.toHaveBeenCalled();
    expect(f.stored.get("modlog:123:t3_abc:lock")).toBe("another-sender");
    expect(console.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("busy"),
    );
  });

  it("redacts transport exceptions and rejects a text-channel response", async () => {
    const f = fixture();
    vi.mocked(fetch).mockRejectedValueOnce(new Error(WEBHOOK));
    await f.send();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      "SYNTHETIC_TOKEN",
    );
    vi.mocked(fetch).mockResolvedValueOnce(
      reply({ id: "999", channel_id: "111" }),
    );
    await f.send();
    expect(f.stored.size).toBe(0);
  });

  it.each([
    "https://evil.example/api/webhooks/123/token",
    `${WEBHOOK}?thread_id=1`,
  ])("rejects unsupported destination %s", async (url) => {
    const f = fixture();
    f.settings.set(MODLOG_WEBHOOK, url);
    await f.send();
    expect(fetch).not.toHaveBeenCalled();
  });
});
