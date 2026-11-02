import type { SetOptions, TriggerContext } from "@devvit/public-api";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import trigger, {
  ApproveCommenterParticipation,
} from "./reportCommenterParticipation.js";

const NOW = Date.UTC(2026, 10, 1);
const item = (subredditName: string, at = NOW) => ({
  subredditName,
  createdAt: new Date(at),
});
const comment = {
  id: "t1_first",
  authorId: "t2_author",
  authorName: "Example",
  ...item("Seattle"),
};
const authorKey = "seabot:review:t2_author";
const commentKey = "seabot:review:t1_first";
const listing = vi.fn();
const reddit = {
  getCommentById: vi.fn(),
  getCommentsAndPostsByUser: vi.fn(),
  report: vi.fn(),
};
const settings = { get: vi.fn() };
const redis = { get: vi.fn(), set: vi.fn(), del: vi.fn() };
const context = {
  reddit,
  settings,
  redis,
  subredditName: "Seattle",
  appName: "seattle-bot",
} as unknown as TriggerContext;
const run = (overrides: Partial<TriggerContext> = {}, event = { comment }) =>
  trigger.onEvent(event as never, { ...context, ...overrides });
const approve = (
  event = { action: "approvecomment", targetComment: { id: comment.id } },
  ctx = context,
) => ApproveCommenterParticipation.onEvent(event as never, ctx);
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  vi.spyOn(console, "error").mockImplementation(() => {});
  reddit.getCommentById.mockResolvedValue(comment);
  reddit.getCommentsAndPostsByUser.mockReturnValue({ get: listing });
  listing.mockResolvedValue([item("pcos"), item("nashville")]);
  redis.set.mockResolvedValue("OK");
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
    for (const [, options] of reddit.report.mock.calls) {
      expect(options.reason.length).toBeLessThanOrEqual(100);
    }
  },
);

it("bounds history and atomically reports one matching comment", async () => {
  const claim = vi.fn().mockResolvedValueOnce("OK").mockResolvedValue("");
  redis.set.mockImplementation((key) =>
    key === authorKey ? claim() : Promise.resolve("OK"),
  );
  listing.mockResolvedValue(
    [...Array(99).fill("PCOS"), "Nashville"].map((sub) => item(sub)),
  );
  settings.get.mockResolvedValue(true);
  await Promise.all([run(), run()]);
  expect(reddit.report).toHaveBeenCalledOnce();
  expect(reddit.getCommentsAndPostsByUser).toHaveBeenCalledWith({
    username: "example",
    sort: "new",
    limit: 100,
  });
  expect(listing).toHaveBeenCalledWith(100);
  expect(reddit.report).toHaveBeenCalledWith(comment, {
    reason:
      "Possible bot detected; active in at least 2 flagged subreddits: r/pcos, r/nashville",
  });
  expect(redis.set).toHaveBeenCalledWith(authorKey, "reported", {
    nx: true,
    expiration: new Date(NOW + 7 * 86_400_000),
  });
  expect(redis.set).toHaveBeenCalledWith(commentKey, comment.authorId);
  expect(redis.set.mock.invocationCallOrder.slice(-1)[0]).toBeLessThan(
    reddit.report.mock.invocationCallOrder[0],
  );
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
  [{ authorId: undefined }],
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
    if (recheck && "approved" in changes)
      expect(redis.set).toHaveBeenLastCalledWith(authorKey, "approved");
  },
);

it("ignores other installations and missing comments", async () => {
  await run({ subredditName: "elsewhere" });
  await run({ subredditName: undefined });
  await run({}, {} as never);
  expect(reddit.getCommentById).not.toHaveBeenCalled();
});

it.each([null, 1, 8])(
  "persists review decisions; approval on day %s",
  async (approvalDay) => {
    const stored = new Map<string, { value: string; until: number }>();
    const read = (key: string) => {
      const entry = stored.get(key);
      return entry && entry.until > Date.now() ? entry.value : undefined;
    };
    redis.get.mockImplementation(async (key) => read(key));
    redis.set.mockImplementation(
      async (key, value, options: SetOptions = {}) => {
        if (options.nx && read(key)) return "";
        stored.set(key, {
          value,
          until: options.expiration?.getTime() ?? Infinity,
        });
        return "OK";
      },
    );
    reddit.getCommentById.mockImplementation(async (id) => ({
      ...comment,
      id,
    }));
    const next = { comment: { ...comment, id: "t1_next" } };
    await run();
    await run({}, next);
    expect(reddit.report).toHaveBeenCalledOnce();
    if (approvalDay !== null) {
      vi.mocked(Date.now).mockReturnValue(NOW + approvalDay * 86_400_000);
      settings.get.mockResolvedValue(false);
      await approve();
      settings.get.mockResolvedValue(true);
    }
    vi.mocked(Date.now).mockReturnValue(NOW + 30 * 86_400_000);
    await run();
    expect(reddit.report).toHaveBeenCalledOnce();
    expect(listing).toHaveBeenCalledOnce();
    await run({}, next);
    expect(reddit.report).toHaveBeenCalledTimes(approvalDay === null ? 2 : 1);
  },
);

it("honors an approval arriving while a report is being prepared", async () => {
  let authorReads = 0;
  redis.get.mockImplementation(async (key) =>
    key === authorKey && ++authorReads > 1 ? "approved" : undefined,
  );
  await run();
  expect(redis.set).toHaveBeenCalledWith(commentKey, comment.authorId);
  expect(reddit.report).not.toHaveBeenCalled();
});

it("ignores unrelated approvals, other actions, and missing targets", async () => {
  await approve();
  await approve({ action: "removecomment", targetComment: { id: comment.id } });
  await approve({ action: "approvecomment" } as never);
  await approve(undefined, { ...context, subredditName: "elsewhere" });
  await approve(undefined, { ...context, subredditName: undefined });
  expect(redis.set).not.toHaveBeenCalled();
  expect(redis.get).toHaveBeenCalledOnce();
});

it("surfaces approval storage failures instead of acknowledging success", async () => {
  redis.get.mockResolvedValue(comment.authorId);
  redis.set.mockRejectedValue(new Error("unavailable"));
  await expect(approve()).rejects.toThrow("unavailable");
});

it.each([
  ["history", listing, 0],
  ["claim", redis.set, 0],
  ["report", reddit.report, 1],
] as const)("handles %s failure", async (_, method, reports) => {
  const error = new Error("unavailable");
  method.mockRejectedValueOnce(error);
  await run();
  expect(console.error).toHaveBeenCalledWith(
    "SeaBot commenter review failed",
    error,
  );
  expect(reddit.report).toHaveBeenCalledTimes(reports);
  expect(redis.del).not.toHaveBeenCalled();
  if (!reports) {
    await run();
    expect(reddit.report).toHaveBeenCalledOnce();
  }
});
