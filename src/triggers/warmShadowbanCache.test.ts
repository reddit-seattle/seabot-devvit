import { beforeEach, expect, it, vi } from "vitest";
import { startShadowbanWarmup } from "./warmShadowbanCache.js";
import { action, fixture } from "./shadowban.testUtils.js";

vi.mock("../utils/webhooks.js", () => ({ SendContentToWebhook: vi.fn() }));
beforeEach(() => vi.restoreAllMocks());

it("resumes bootstrap batches while incoming events seed the cache without alerts", async () => {
  const f = fixture(
    Array.from({ length: 501 }, (_, i) => action(-i - 1, "Known")),
  );
  await f.warm();
  expect(f.state()).toEqual({ ready: false, after: "ModAction_-500" });
  expect(f.context.scheduler.runJob).toHaveBeenCalledWith({
    name: "shadowban-warmup",
    runAt: expect.any(Date),
  });
  f.prepend(action(1, "DuringWarmup"));
  await f.run(action(1, "DuringWarmup"));
  expect(f.send).not.toHaveBeenCalled();
  expect(f.seen.has("duringwarmup")).toBe(true);
  f.pages.mockRejectedValueOnce(new Error("Reddit unavailable"));
  await expect(f.warm()).rejects.toThrow("Reddit unavailable");
  expect(f.state().after).toBe("ModAction_-500");
  await f.warm();
  expect(f.state()).toEqual({ ready: true });
  expect(f.context.scheduler.cancelJob).toHaveBeenLastCalledWith("job");
  expect(f.send).not.toHaveBeenCalled();
  f.prepend(action(2, "DuringWarmup"));
  await f.run(action(2, "DuringWarmup"));
  f.prepend(action(3));
  await f.run(action(3));
  expect(f.send).toHaveBeenCalledTimes(1);
  expect(f.send.mock.calls[0][1].embeds[0].url).toContain("/_/3/");
});

it("starts only the one-time bootstrap and retains the warmed cache on upgrade", async () => {
  const f = fixture();
  await startShadowbanWarmup({}, f.ctx);
  expect(f.context.scheduler.runJob.mock.calls.map(([job]) => job)).toEqual([
    { name: "shadowban-warmup", runAt: expect.any(Date) },
  ]);
  f.context.scheduler.listJobs.mockResolvedValue([
    { name: "shadowban-warmup" },
  ]);
  await startShadowbanWarmup({}, f.ctx);
  expect(f.context.scheduler.runJob).toHaveBeenCalledTimes(1);
  f.context.settings.get.mockResolvedValue("");
  await f.warm();
  expect(f.state().ready).toBe(true);
  f.context.scheduler.runJob.mockClear();
  f.context.scheduler.listJobs.mockResolvedValue([]);
  await startShadowbanWarmup({}, f.ctx);
  expect(f.context.scheduler.runJob).not.toHaveBeenCalled();
  f.pages.mockClear();
  await f.run(action(1));
  expect(f.pages).not.toHaveBeenCalled();
});
