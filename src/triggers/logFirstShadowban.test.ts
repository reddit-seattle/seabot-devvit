import { beforeEach, expect, it, vi } from "vitest";
import { action, fixture } from "./shadowban.testUtils.js";

vi.mock("../utils/webhooks.js", () => ({ SendContentToWebhook: vi.fn() }));
beforeEach(() => vi.restoreAllMocks());

it("alerts only on the first matching shadowban event, respecting history and cutoff", async () => {
  const f = fixture();
  await f.warm();
  expect(f.send).not.toHaveBeenCalled();
  const events = [
    action(-1, "Early"),
    action(0, "Description", {
      details: "remove",
      description: "Removed for negative karma",
    }),
    action(1, "KNOWN"),
    action(2),
    action(3),
    action(4, "Other", { details: "Removed for negative karma extra" }),
    action(5, "Human", { moderatorName: "OtherMod" }),
    action(6, "early"),
  ];
  for (const event of events) {
    f.prepend(event);
    await f.run(event);
  }
  expect(f.send).toHaveBeenCalledTimes(2);
  expect(f.send.mock.calls.map(([, payload]) => payload.embeds[0].url)).toEqual(
    [
      "https://www.reddit.com/r/Seattle/comments/post/_/0/",
      "https://www.reddit.com/r/Seattle/comments/post/_/2/",
    ],
  );
});

it("looks up the triggering action and stops at its timestamp when it is missing", async () => {
  const f = fixture(
    Array.from({ length: 1000 }, (_, i) => action(-i - 1, "Known")),
  );
  while (!f.state().ready) await f.warm();
  f.prepend(
    ...Array.from({ length: 101 }, (_, i) => action(200 - i, "Other")),
    action(10),
  );
  f.pages.mockClear();
  await f.run(action(10));
  expect(f.pages).toHaveBeenCalledTimes(2);
  expect(f.send).toHaveBeenCalledTimes(1);
  expect(f.send.mock.calls[0][1].embeds[0].url).toContain("/_/10/");
  f.pages.mockClear();
  await expect(f.run(action(9))).rejects.toThrow(
    "Shadowban event missing from moderation log",
  );
  expect(f.pages).toHaveBeenCalledTimes(2);
});

it("prevents duplicate notifications from concurrent and repeated trigger deliveries", async () => {
  const f = fixture();
  await Promise.all([f.warm(), f.warm()]);
  f.prepend(action(1));
  await Promise.all([f.run(action(1)), f.run(action(1))]);
  f.prepend(action(2));
  await f.run(action(2));
  expect(f.send).toHaveBeenCalledTimes(1);
  expect(f.send.mock.calls[0][1].embeds[0].title).toBe(
    "First shadowban for u/New",
  );
  expect(f.seen.has("new")).toBe(true);
});

it("logs failed deliveries without retrying claimed users", async () => {
  const f = fixture();
  await f.warm();
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  f.send
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockRejectedValueOnce(new Error("response lost"));
  for (const event of [
    action(1, "First"),
    action(2, "Second"),
    action(3, "Third"),
  ]) {
    f.prepend(event);
    await f.run(event);
    await f.run(event);
  }
  expect(errors).toHaveBeenCalledTimes(2);
  expect(f.send).toHaveBeenCalledTimes(3);
});
