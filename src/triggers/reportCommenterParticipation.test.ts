import type { TriggerContext } from "@devvit/public-api";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import trigger from "./reportCommenterParticipation.js";

const NOW = Date.UTC(2026, 10, 1);
const item = (subredditName: string, at = NOW) => ({
  subredditName,
  createdAt: new Date(at),
});
const comment = { id: "t1_first", authorName: "Example", ...item("Seattle") };
const listing = vi.fn();
const reddit = {
  getCommentById: vi.fn(),
  getCommentsAndPostsByUser: vi.fn(),
  report: vi.fn(),
};
const settings = { get: vi.fn() };
const context = {
  reddit,
  settings,
  subredditName: "Seattle",
  appName: "seattle-bot",
} as unknown as TriggerContext;
const run = (overrides: Partial<TriggerContext> = {}, event = { comment }) =>
  trigger.onEvent(event as never, { ...context, ...overrides });
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  vi.spyOn(console, "error").mockImplementation(() => {});
  reddit.getCommentById.mockResolvedValue(comment);
  reddit.getCommentsAndPostsByUser.mockReturnValue({ get: listing });
  listing.mockResolvedValue([item("pcos"), item("nashville")]);
});
afterEach(() => vi.restoreAllMocks());

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
  [["pcos", "nashville"], 0, 0],
  [["pcos", "nashville"], 0, NaN],
  [["pcos", "nashville"], 0, NOW + 1],
  [["pcos", "nashville"], 1, NOW - 800 * 86_400_000],
] as [string[], number, number?][])(
  "matches distinct prior communities: %j / %s / %s",
  async (subs, count, at = NOW) => {
    listing.mockResolvedValue(
      subs.map((sub, i) => item(sub, i === subs.length - 1 ? at : NOW)),
    );
    await run();
    expect(reddit.report).toHaveBeenCalledTimes(count);
  },
);

it("bounds history and reports the matching communities", async () => {
  listing.mockResolvedValue(
    [...Array(99).fill("PCOS"), "Nashville"].map((sub) => item(sub)),
  );
  settings.get.mockResolvedValue(true);
  await run();
  expect(reddit.getCommentsAndPostsByUser).toHaveBeenCalledWith({
    username: "example",
    sort: "new",
    limit: 100,
  });
  expect(listing).toHaveBeenCalledWith(100);
  expect(reddit.report).toHaveBeenCalledWith(comment, {
    reason: "SeaBot review: prior activity in r/pcos, r/nashville",
  });
});

it.each([false, null, "true"])("skips disabled setting %s", async (value) => {
  settings.get.mockResolvedValue(value);
  await run();
  expect(reddit.getCommentById).not.toHaveBeenCalled();
});

it.each([
  [{ removed: true }],
  [{ spam: true }],
  [{ approved: true }],
  [{ ignoringReports: true }],
  [{ subredditName: "elsewhere" }],
  [{ authorName: "" }],
  [{ authorName: "[deleted]" }],
  [{ authorName: "AutoModerator" }],
  [{ authorName: "Seattle-ModTeam" }],
  [{ authorName: "SEATTLE-BOT" }],
  ...[0, NaN, NOW + 1].map((at) => [{ createdAt: new Date(at) }]),
  [{ removed: true }, true],
  [{ approved: true }, true],
  [{ authorName: "[deleted]" }, true],
] as [object, boolean?][])(
  "skips %j; after history: %s",
  async (changes, recheck = false) => {
    if (recheck) reddit.getCommentById.mockResolvedValueOnce(comment);
    reddit.getCommentById.mockResolvedValue({ ...comment, ...changes });
    await run();
    expect(listing).toHaveBeenCalledTimes(recheck ? 1 : 0);
    expect(reddit.report).not.toHaveBeenCalled();
  },
);

it("ignores other installations and missing comments", async () => {
  await run({ subredditName: "elsewhere" });
  await run({ subredditName: undefined });
  await run({}, {} as never);
  expect(reddit.getCommentById).not.toHaveBeenCalled();
});

it("reports each eligible comment from the same author", async () => {
  const second = { ...comment, id: "t1_second" };
  await run();
  reddit.getCommentById.mockResolvedValue(second);
  await run({}, { comment: second });
  expect(reddit.report).toHaveBeenCalledTimes(2);
  expect(reddit.report).toHaveBeenNthCalledWith(2, second, expect.anything());
});

it.each([
  ["history", listing, 0],
  ["report", reddit.report, 1],
] as const)("handles %s failure", async (_, method, reports) => {
  method.mockRejectedValueOnce(new Error("unavailable"));
  await run();
  expect(reddit.report).toHaveBeenCalledTimes(reports);
  if (!reports) {
    await run();
    expect(reddit.report).toHaveBeenCalledOnce();
  }
});
