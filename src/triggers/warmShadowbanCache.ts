import type { ScheduledJobType, TriggerContext } from "@devvit/public-api";
import { SHADOWBAN_CONFIG } from "../settings.js";
import {
  WARMUP_STATE,
  SEEN,
  SEEN_VALUE,
  getRemovalLog,
  qualifyingAuthor,
} from "./shadowbanCache.js";

const WARMUP = "shadowban-warmup";
type Cursor = { ready: boolean; after?: string };

// A one-time bootstrap, continued in batches. It never sends notifications.
export const ShadowbanWarmup: ScheduledJobType<undefined> = {
  name: WARMUP,
  onRun: async (_event, context) => {
    if (!context.subredditName) return;
    // Arrange continuation before I/O; failures resume from the saved cursor.
    const continuation = await context.scheduler.runJob({
      name: WARMUP,
      runAt: new Date(Date.now() + SHADOWBAN_CONFIG.warmupDelayMs),
    });
    let raw = await context.redis.get(WARMUP_STATE);
    let cursor: Cursor = raw ? JSON.parse(raw) : { ready: false };
    if (cursor.ready) {
      await context.scheduler.cancelJob(continuation);
      return;
    }
    for (let page = 0; page < SHADOWBAN_CONFIG.maxPagesPerRun; page++) {
      const listing = getRemovalLog(context, cursor.after);
      await listing.get(1); // Fetch one API page per checkpoint.
      const actions = listing.children;
      const users: Record<string, string> = {};
      for (const action of actions) {
        const author = qualifyingAuthor(action);
        if (author) users[author.toLowerCase()] = SEEN_VALUE;
      }
      const next: Cursor = actions.length
        ? {
            ready: false,
            after: actions[actions.length - 1].id,
          }
        : { ready: true };
      if (!(await checkpoint(context, raw, next, users))) return;
      if (next.ready) {
        await context.scheduler.cancelJob(continuation);
        return;
      }
      raw = JSON.stringify(next);
      cursor = next;
    }
  },
};

// Cache writes and the cursor move together; stale runs cannot overwrite either.
async function checkpoint(
  context: TriggerContext,
  previous: string | undefined,
  cursor: Cursor,
  users?: Record<string, string>,
) {
  const transaction = await context.redis.watch(WARMUP_STATE);
  if ((await context.redis.get(WARMUP_STATE)) !== previous) {
    await transaction.unwatch();
    return false;
  }
  await transaction.multi();
  if (users && Object.keys(users).length) await transaction.hSet(SEEN, users);
  await transaction.set(WARMUP_STATE, JSON.stringify(cursor));
  return (await transaction.exec()).length > 0;
}

export async function startShadowbanWarmup(
  _event: unknown,
  context: TriggerContext,
) {
  const raw = await context.redis.get(WARMUP_STATE);
  if (JSON.parse(raw || "{}").ready) return;
  const jobs = await context.scheduler.listJobs();
  if (!jobs.some((job) => job.name === WARMUP)) {
    await context.scheduler.runJob({ name: WARMUP, runAt: new Date() });
  }
}
