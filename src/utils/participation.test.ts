import { Devvit } from "@devvit/public-api";
import { RedditAPIClient } from "@devvit/public-api/apis/reddit/RedditAPIClient.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getParticipationMatches } from "./participation.js";

const NOW = Date.UTC(2026, 10, 1) / 1000;
const comment = { authorName: "example", createdAt: new Date(NOW * 1000) };
function item(
  id: number,
  kind = "t1",
  createdUtc = NOW - id,
  subreddit = kind === "t1" ? "pcos" : "nashville",
) {
  return {
    kind,
    data: {
      id: String(id),
      author: "example",
      createdUtc,
      subreddit,
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

describe("participation through the installed Devvit SDK", () => {
  const client = new RedditAPIClient({});
  const userWhere = vi.fn(async (_request: unknown, _metadata: unknown) => ({
    data: { children: [item(1), item(2, "t3")], after: "", before: "" },
  }));
  const pluginDescriptor = Object.getOwnPropertyDescriptor(
    Devvit,
    "redditAPIPlugins",
  )!;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW * 1000);
    userWhere.mockClear();
    // Mock transport only: exercise SDK request construction, pagination, and models.
    Object.defineProperty(Devvit, "redditAPIPlugins", {
      configurable: true,
      get: () => ({ Users: { UserWhere: userWhere } }),
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(Devvit, "redditAPIPlugins", pluginDescriptor);
  });

  it("counts both posts and comments without retaining their contents", async () => {
    expect(await getParticipationMatches(client, comment)).toEqual([
      "pcos",
      "nashville",
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
    expect(await getParticipationMatches(client, comment)).toEqual(["pcos"]);
    expect(userWhere).toHaveBeenCalledOnce();
  });

  it("finds evidence in the last slot of the sample", async () => {
    userWhere.mockResolvedValueOnce({
      data: {
        children: [
          ...Array.from({ length: 99 }, (_, i) => item(i)),
          item(99, "t3"),
        ],
        after: "t1_next",
        before: "",
      },
    });
    expect(await getParticipationMatches(client, comment)).toEqual([
      "pcos",
      "nashville",
    ]);
    expect(userWhere).toHaveBeenCalledOnce();
  });

  it("accepts unsorted history since order does not change participation", async () => {
    userWhere.mockResolvedValueOnce({
      data: { children: [item(2, "t3"), item(1)], after: "", before: "" },
    });
    expect(await getParticipationMatches(client, comment)).toEqual([
      "pcos",
      "nashville",
    ]);
    // This pinned SDK drops sort; do not claim that the sample is necessarily the newest 100.
    expect(userWhere.mock.calls[0][0]).not.toHaveProperty("sort");
  });

  it.each([0, NaN, NOW + 1])(
    "excludes invalid or future history timestamp %s",
    async (time) => {
      userWhere.mockResolvedValueOnce({
        data: {
          children: [item(1), item(2, "t3", time)],
          after: "",
          before: "",
        },
      });
      expect(await getParticipationMatches(client, comment)).toEqual(["pcos"]);
    },
  );

  it("excludes activity after a delayed triggering comment", async () => {
    userWhere.mockResolvedValueOnce({
      data: { children: [item(1, "t3"), item(3)], after: "", before: "" },
    });
    expect(
      await getParticipationMatches(client, {
        ...comment,
        createdAt: new Date((NOW - 2) * 1000),
      }),
    ).toEqual(["pcos"]);
  });

  it("has no lookback-age cutoff and accepts equal timestamps", async () => {
    userWhere.mockResolvedValueOnce({
      data: {
        children: [item(1, "t1", NOW), item(2, "t3", NOW)],
        after: "",
        before: "",
      },
    });
    expect(await getParticipationMatches(client, comment)).toEqual([
      "pcos",
      "nashville",
    ]);
    userWhere.mockResolvedValueOnce({
      data: {
        children: [item(1), item(2, "t3", NOW - 800 * 86_400)],
        after: "",
        before: "",
      },
    });
    expect(await getParticipationMatches(client, comment)).toEqual([
      "pcos",
      "nashville",
    ]);
  });

  it("accepts empty history", async () => {
    userWhere.mockResolvedValueOnce({
      data: { children: [], after: "", before: "" },
    });
    expect(await getParticipationMatches(client, comment)).toEqual([]);
  });

  it.each([0, NaN, NOW + 1])(
    "rejects invalid triggering comment timestamp %s before fetching",
    async (time) => {
      await expect(
        getParticipationMatches(client, {
          ...comment,
          createdAt: new Date(time * 1000),
        }),
      ).rejects.toThrow("Invalid comment timestamp");
      expect(userWhere).not.toHaveBeenCalled();
    },
  );
});
