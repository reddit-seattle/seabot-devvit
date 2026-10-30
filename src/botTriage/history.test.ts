import { Devvit } from "@devvit/public-api";
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
      subreddit: kind === "t1" ? "pcos" : "nashville",
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

  beforeEach(() => {
    userWhere.mockClear();
    // Mock only the RPC transport, preserving the SDK's request construction and model conversion.
    Object.defineProperty(Devvit, "redditAPIPlugins", {
      configurable: true,
      get: () => ({ Users: { UserWhere: userWhere } }),
    });
  });
  afterEach(() =>
    Object.defineProperty(Devvit, "redditAPIPlugins", pluginDescriptor),
  );

  it("returns minimal evidence from newest-first comments and posts", async () => {
    expect(await getRecentHistory(client, "example")).toEqual([
      { id: "t1_1", subreddit: "pcos" },
      { id: "t3_2", subreddit: "nashville" },
    ]);
    expect(userWhere).toHaveBeenCalledOnce();
    expect(userWhere.mock.calls[0][0]).toMatchObject({
      username: "example",
      where: "overview",
      limit: 100,
    });
  });

  it("stops at 100 items even when more history is available", async () => {
    userWhere.mockResolvedValueOnce({
      data: {
        children: Array.from({ length: 100 }, (_, i) => item(i)),
        after: "t1_next",
        before: "",
      },
    });
    expect(await getRecentHistory(client, "example")).toHaveLength(100);
    expect(userWhere).toHaveBeenCalledOnce();
  });

  it("rejects out-of-order history instead of trusting the SDK's sort option", async () => {
    userWhere.mockResolvedValueOnce({
      data: { children: [item(2), item(1)], after: "", before: "" },
    });
    await expect(getRecentHistory(client, "example")).rejects.toThrow(
      "not newest-first",
    );
    // This pinned SDK drops sort. The timestamp guard is required even though callers request 'new'.
    expect(userWhere.mock.calls[0][0]).not.toHaveProperty("sort");
  });

  it.each([0, NaN])(
    "rejects an invalid history timestamp: %s",
    async (time) => {
      userWhere.mockResolvedValueOnce({
        data: { children: [item(1, "t1", time)], after: "", before: "" },
      });
      await expect(getRecentHistory(client, "example")).rejects.toThrow(
        "not newest-first",
      );
    },
  );

  it("accepts empty history and equal timestamps", async () => {
    userWhere.mockResolvedValueOnce({
      data: { children: [], after: "", before: "" },
    });
    expect(await getRecentHistory(client, "example")).toEqual([]);
    userWhere.mockResolvedValueOnce({
      data: {
        children: [item(1, "t1", NOW), item(2, "t3", NOW)],
        after: "",
        before: "",
      },
    });
    expect(await getRecentHistory(client, "example")).toHaveLength(2);
  });
});
