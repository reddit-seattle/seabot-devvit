import type { TriggerContext } from "@devvit/public-api";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import trigger from "./reportCommenterParticipation.js";

const NOW = Date.UTC(2026, 10, 1);
const history = (subs: string[]) =>
  subs.map((subredditName) => ({
    subredditName,
    createdAt: new Date(NOW),
  }));

function setup() {
  const comment = {
    id: "t1_first",
    authorName: "Example",
    subredditName: "Seattle",
    createdAt: new Date(NOW),
    removed: false,
    spam: false,
    approved: false,
    ignoringReports: false,
  };
  const listing = vi.fn().mockResolvedValue(history(["pcos", "nashville"]));
  const reddit = {
    getCommentById: vi.fn().mockResolvedValue(comment),
    getCommentsAndPostsByUser: vi.fn(() => ({ get: listing })),
    report: vi.fn().mockResolvedValue(undefined),
  };
  const redis = {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn(),
  };
  const settings = { get: vi.fn() };
  const ctx = {
    reddit,
    redis,
    settings,
    subredditName: "Seattle",
    appName: "seattle-bot",
  };
  const run = () =>
    trigger.onEvent(
      { comment: { id: comment.id } } as Parameters<typeof trigger.onEvent>[0],
      ctx as unknown as TriggerContext,
    );
  return { comment, listing, reddit, redis, settings, ctx, run };
}
let env: ReturnType<typeof setup>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.spyOn(console, "error").mockImplementation(() => {});
  env = setup();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it.each([
  [[], 0],
  [["pcos"], 0],
  [["testosterone"], 0],
  [["nashville"], 0],
  [["pcos", "testosterone"], 1],
  [["pcos", "nashville"], 1],
  [["testosterone", "nashville"], 1],
  [["pcos", "testosterone", "nashville"], 1],
  [["pcos", "PCOS", "supplements", "sideprojects"], 0],
] as [string[], number][])(
  "reports distinct target combinations: %j",
  async (subs, count) => {
    env.listing.mockResolvedValue(history(subs));
    await env.run();
    expect(env.reddit.report).toHaveBeenCalledTimes(count);
  },
);

it("bounds the sample, lists matches, and claims one week atomically", async () => {
  const items = history(Array(99).fill("PCOS"));
  items.push(...history(["Nashville"]));
  env.listing.mockResolvedValue(items);
  env.settings.get.mockResolvedValue(true);
  await env.run();
  expect(env.reddit.getCommentsAndPostsByUser).toHaveBeenCalledWith({
    username: "example",
    sort: "new",
    limit: 100,
  });
  expect(env.listing).toHaveBeenCalledWith(100);
  expect(env.reddit.report).toHaveBeenCalledWith(env.comment, {
    reason: "SeaBot review: prior activity in r/pcos, r/nashville",
  });
  expect(env.redis.set).toHaveBeenCalledExactlyOnceWith(
    "seabot:triage:report:example",
    "1",
    {
      nx: true,
      expiration: new Date(NOW + 7 * 86_400_000),
    },
  );
});

it.each([false, null, "true"])(
  "skips disabled/invalid setting %s",
  async (value) => {
    env.settings.get.mockResolvedValue(value);
    await env.run();
    expect(env.reddit.getCommentById).not.toHaveBeenCalled();
  },
);

it.each([
  { removed: true },
  { spam: true },
  { approved: true },
  { ignoringReports: true },
  { subredditName: "elsewhere" },
  { authorName: "" },
  { authorName: "[deleted]" },
  { authorName: "AutoModerator" },
  { authorName: "Seattle-ModTeam" },
  { authorName: "SEATTLE-BOT" },
])("skips ineligible comments: %j", async (changes) => {
  Object.assign(env.comment, changes);
  await env.run();
  expect(env.listing).not.toHaveBeenCalled();
});

it("ignores other installations and events without a comment", async () => {
  env.ctx.subredditName = "elsewhere";
  await env.run();
  await trigger.onEvent({} as never, {} as TriggerContext);
  await trigger.onEvent(
    {} as never,
    { subredditName: "Seattle" } as TriggerContext,
  );
  expect(env.reddit.getCommentById).not.toHaveBeenCalled();
});

it.each([0, NaN, NOW + 1])(
  "rejects invalid comment timestamp %s",
  async (time) => {
    env.comment.createdAt = new Date(time);
    await env.run();
    expect(env.listing).not.toHaveBeenCalled();
  },
);

it.each([
  [0, 0],
  [NaN, 0],
  [NOW + 1, 0],
  [NOW, 1],
  [NOW - 800 * 86_400_000, 1],
])("counts prior history only: %s", async (time, count) => {
  const items = history(["pcos", "nashville"]);
  items[1].createdAt = new Date(time);
  env.listing.mockResolvedValue(items);
  await env.run();
  expect(env.reddit.report).toHaveBeenCalledTimes(count);
});

it.each([{ removed: true }, { approved: true }, { authorName: "[deleted]" }])(
  "rechecks status after history: %j",
  async (changes) => {
    env.reddit.getCommentById
      .mockResolvedValueOnce(env.comment)
      .mockResolvedValueOnce({ ...env.comment, ...changes });
    await env.run();
    expect(env.redis.set).not.toHaveBeenCalled();
    expect(env.reddit.report).not.toHaveBeenCalled();
  },
);

it("skips authors in cooldown and prevents concurrent duplicate reports", async () => {
  env.redis.get.mockResolvedValueOnce("1");
  await env.run();
  expect(env.listing).not.toHaveBeenCalled();
  env.redis.set.mockResolvedValueOnce("OK").mockResolvedValue("");
  await Promise.all([env.run(), env.run()]);
  expect(env.reddit.report).toHaveBeenCalledOnce();
});

it("retries a history failure on the next comment without claiming a report", async () => {
  env.listing.mockRejectedValueOnce(new Error("unavailable"));
  await env.run();
  expect(env.redis.set).not.toHaveBeenCalled();
  expect(env.reddit.report).not.toHaveBeenCalled();
  await env.run();
  expect(env.reddit.report).toHaveBeenCalledOnce();
});

it("retains the claim after an ambiguous report failure", async () => {
  env.reddit.report.mockRejectedValueOnce(new Error("response lost"));
  await env.run();
  env.redis.get.mockResolvedValue("1");
  await env.run();
  expect(env.redis.set).toHaveBeenCalledOnce();
  expect(env.redis.del).not.toHaveBeenCalled();
  expect(env.reddit.report).toHaveBeenCalledOnce();
  expect(console.error).toHaveBeenCalled();
});

it("does not report when Redis cannot claim the author", async () => {
  env.redis.set.mockRejectedValue(new Error("unavailable"));
  await env.run();
  expect(env.reddit.report).not.toHaveBeenCalled();
});
