import { Devvit, type Comment } from "@devvit/public-api";
import { RedditAPIClient } from "@devvit/public-api/apis/reddit/RedditAPIClient.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRecentHistory } from "./history.js";

const NOW = Date.UTC(2026, 9, 30) / 1000;
function item(id: number, kind = "t1", createdUtc = NOW - id) {
  return {
    kind,
    data: {
      id: String(id),
      author: "example",
      createdUtc,
      subreddit: kind === "t1" ? "PCOS" : "Nashville",
      subredditId: "t5_example",
      body: "not retained",
      title: "not retained",
      parentId: "t3_post",
      linkId: "t3_post",
      permalink: "/r/example/comments/post/title/comment/",
      url: "https://example.com",
    },
  };
}

describe("history through the installed Devvit SDK", () => {
  const client = new RedditAPIClient({});
  const userWhere = vi.fn(async (_request: unknown, _metadata: unknown) => ({
    data: { children: [item(1), item(2, "t3")], after: "", before: "" },
  }));
  const pluginDescriptor = Object.getOwnPropertyDescriptor(
    Devvit,
    "redditAPIPlugins",
  )!;
  const trigger = {
    id: "t1_trigger",
    authorName: "example",
    subredditName: "Seattle",
    createdAt: new Date(NOW * 1000),
  } satisfies Pick<
    Comment,
    "id" | "authorName" | "subredditName" | "createdAt"
  >;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW * 1000);
    userWhere.mockClear();
    // Mock only RPC transport; exercise the installed SDK's request and model conversion.
    Object.defineProperty(Devvit, "redditAPIPlugins", {
      configurable: true,
      get: () => ({ Users: { UserWhere: userWhere } }),
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(Devvit, "redditAPIPlugins", pluginDescriptor);
  });

  it("preserves only detection inputs and merges the fetched trigger", async () => {
    expect(await getRecentHistory(client, trigger)).toEqual([
      {
        id: "t1_trigger",
        subreddit: "seattle",
        createdAtMs: NOW * 1000,
        kind: "comment",
      },
      {
        id: "t1_1",
        subreddit: "pcos",
        createdAtMs: (NOW - 1) * 1000,
        kind: "comment",
      },
      {
        id: "t3_2",
        subreddit: "nashville",
        createdAtMs: (NOW - 2) * 1000,
        kind: "post",
      },
    ]);
    expect(userWhere).toHaveBeenCalledOnce();
    expect(userWhere.mock.calls[0][0]).toMatchObject({
      username: "example",
      where: "overview",
      limit: 100,
    });
  });
  it("bounds the combined sample at 100 without another page request", async () => {
    userWhere.mockResolvedValueOnce({
      data: {
        children: Array.from({ length: 100 }, (_, i) => item(i + 1)),
        after: "t1_next",
        before: "",
      },
    });
    const result = await getRecentHistory(client, trigger);
    expect(result).toHaveLength(100);
    expect(result[0].id).toBe(trigger.id);
    expect(result[99].id).toBe("t1_99");
    expect(userWhere).toHaveBeenCalledOnce();
  });
  it("rejects out-of-order history before merging and sorting", async () => {
    userWhere.mockResolvedValueOnce({
      data: { children: [item(2), item(1)], after: "", before: "" },
    });
    await expect(getRecentHistory(client, trigger)).rejects.toThrow(
      "out-of-order",
    );
    // This pinned SDK drops sort even when the caller requests newest first.
    expect(userWhere.mock.calls[0][0]).not.toHaveProperty("sort");
  });
  it.each([0, NaN, NOW + 1])(
    "rejects invalid history time %s",
    async (time) => {
      userWhere.mockResolvedValueOnce({
        data: { children: [item(1, "t1", time)], after: "", before: "" },
      });
      await expect(getRecentHistory(client, trigger)).rejects.toThrow(
        "account history",
      );
    },
  );
  it.each([undefined, new Date(NaN), new Date(0), new Date((NOW + 1) * 1000)])(
    "rejects invalid trigger time %s",
    async (createdAt) => {
      await expect(
        getRecentHistory(client, { ...trigger, createdAt: createdAt as Date }),
      ).rejects.toThrow("trigger timestamp");
      expect(userWhere).not.toHaveBeenCalled();
    },
  );
  it("accepts empty history and equal timestamps", async () => {
    userWhere.mockResolvedValueOnce({
      data: { children: [], after: "", before: "" },
    });
    expect(await getRecentHistory(client, trigger)).toHaveLength(1);
    userWhere.mockResolvedValueOnce({
      data: {
        children: [item(1, "t1", NOW), item(2, "t3", NOW)],
        after: "",
        before: "",
      },
    });
    expect(await getRecentHistory(client, trigger)).toHaveLength(3);
  });
  it("deduplicates the trigger, prefers its fetched data, and excludes later activity", async () => {
    userWhere.mockResolvedValueOnce({
      data: {
        children: [item(1), item(2), item(3), item(3)],
        after: "",
        before: "",
      },
    });
    const olderTrigger = {
      ...trigger,
      id: "t1_2" as const,
      createdAt: new Date((NOW - 2) * 1000),
    };
    expect(await getRecentHistory(client, olderTrigger)).toEqual([
      {
        id: "t1_2",
        subreddit: "seattle",
        createdAtMs: (NOW - 2) * 1000,
        kind: "comment",
      },
      {
        id: "t1_3",
        subreddit: "pcos",
        createdAtMs: (NOW - 3) * 1000,
        kind: "comment",
      },
    ]);
  });
});
