import type { ScheduledJobType, TriggerContext } from "@devvit/public-api";
import { MODLOG_WEBHOOK } from "../settings.js";
import { DiscordDeliveryError, parseWebhook, sendToThread } from "./discord.js";
import {
  formatAction,
  groupFor,
  loadActionDetails,
  type LogEntry,
} from "./events.js";

export const MODLOG_JOB = "deliver-moderation-log";
const QUEUE = "modlog:pending";
const LOCK = "modlog:worker";
const DAY = 86_400_000;
interface Pending {
  entry: LogEntry;
  destination: string;
  queuedAt: number;
  attempts: number;
}

const recordKey = (id: string) => `modlog:entry:${id}`;
const doneKey = (id: string) => `modlog:done:${id}`;
const expiration = (ms: number) => ({ expiration: new Date(Date.now() + ms) });

export async function enqueueAction(
  entry: LogEntry,
  destination: string,
  context: TriggerContext,
) {
  const id = `${destination}:${encodeURIComponent(entry.id)}`;
  const key = recordKey(id);
  const transaction = await context.redis.watch(key, doneKey(id));
  try {
    if (
      (await context.redis.get(key)) ||
      (await context.redis.get(doneKey(id)))
    )
      return;
    await transaction.multi();
    await transaction.set(
      key,
      JSON.stringify({
        entry,
        destination,
        queuedAt: Date.now(),
        attempts: 0,
      } satisfies Pending),
      expiration(DAY),
    );
    await transaction.zAdd(QUEUE, { member: id, score: Date.now() });
    if (!(await transaction.exec()).length)
      throw new Error("Modlog enqueue transaction conflicted; retry event");
  } finally {
    // DISCARD is only needed for the early-return path; completed transactions are closed.
    await transaction.discard().catch(() => {});
  }
}

async function removePending(id: string, context: TriggerContext) {
  // Remove the index first; a leftover record is bounded by the explicit expiry below.
  await context.redis.zRem(QUEUE, [id]);
  await context.redis.del(recordKey(id));
}

async function releaseLock(token: string, context: TriggerContext) {
  const transaction = await context.redis.watch(LOCK);
  try {
    if ((await context.redis.get(LOCK)) !== token) return;
    await transaction.multi();
    await transaction.del(LOCK);
    await transaction.exec();
  } finally {
    await transaction.discard().catch(() => {});
  }
}

export async function deliverPending(context: TriggerContext) {
  const token = `${Date.now()}:${Math.random()}`;
  // Devvit 0.12's fetch polyfill ignores AbortSignal; allow for its 30-second
  // HTTP timeout plus the 20-second batch-start budget before this lease expires.
  if (
    (await context.redis.set(LOCK, token, {
      nx: true,
      ...expiration(120_000),
    })) !== "OK"
  )
    return;
  const deadline = Date.now() + 20_000;
  try {
    const setting = await context.settings.get<string>(MODLOG_WEBHOOK);
    let webhook: ReturnType<typeof parseWebhook> | undefined;
    try {
      webhook = setting?.trim() ? parseWebhook(setting) : undefined;
    } catch {
      console.error("Moderation log: invalid forum webhook configuration");
      return;
    }
    const cooldownKey = `modlog:cooldown:${webhook?.id}`;
    if (Number(await context.redis.get(cooldownKey)) > Date.now()) return;
    const pending = await context.redis.zRange(QUEUE, 0, Date.now(), {
      by: "score",
      limit: { offset: 0, count: 30 },
    });
    let details: Map<string, string> | undefined;
    for (const { member: id } of pending) {
      if (Date.now() >= deadline || (await context.redis.get(LOCK)) !== token)
        break;
      const raw = await context.redis.get(recordKey(id));
      if (!raw || (await context.redis.get(doneKey(id)))) {
        await removePending(id, context);
        continue;
      }
      const item = JSON.parse(raw) as Pending;
      if (
        !webhook ||
        webhook.id !== item.destination ||
        Date.now() - item.queuedAt >= DAY
      ) {
        console.warn(
          "Moderation log: discarded pending action (disabled, destination changed, or older than 24 hours)",
        );
        await removePending(id, context);
        continue;
      }
      const mappingKey = `modlog:thread:${webhook.id}:${groupFor(item.entry)}`;
      const threadId = await context.redis.get(mappingKey);
      details ??= await loadActionDetails(item.entry.subreddit, context);
      const { payload, threadName } = await formatAction(
        item.entry,
        context,
        details.get(item.entry.id),
        !threadId,
      );
      // Enrichment can be slow. Re-check ownership/budget before any Discord side effect.
      if (Date.now() >= deadline || (await context.redis.get(LOCK)) !== token)
        break;
      try {
        const deliveredThread = await sendToThread(
          webhook.url,
          payload,
          threadId ? { id: threadId } : { name: threadName },
        );
        await context.redis.set(
          mappingKey,
          deliveredThread,
          expiration(90 * DAY),
        );
        await context.redis.set(doneKey(id), "1", expiration(7 * DAY));
        await removePending(id, context);
      } catch (error) {
        // Only a confirmed missing channel invalidates a stored mapping. Keep it
        // for ambiguous network failures, missing webhooks, and locked threads.
        if (
          error instanceof DiscordDeliveryError &&
          error.code === 10003 &&
          threadId
        ) {
          await context.redis.del(mappingKey);
        }
        const discordError =
          error instanceof DiscordDeliveryError ? error : undefined;
        const permanent =
          discordError &&
          discordError.status >= 400 &&
          discordError.status < 500 &&
          discordError.status !== 429 &&
          discordError.code !== 10003;
        const delay = Math.max(
          permanent
            ? 900_000
            : Math.min(900_000, 60_000 * 2 ** Math.min(item.attempts, 4)),
          (discordError?.retryAfter || 0) * 1000,
        );
        item.attempts++;
        await context.redis.set(
          recordKey(id),
          JSON.stringify(item),
          expiration(Math.max(1000, DAY - (Date.now() - item.queuedAt))),
        );
        await context.redis.zAdd(QUEUE, {
          member: id,
          score: Date.now() + delay,
        });
        await context.redis.set(
          cooldownKey,
          String(Date.now() + delay),
          expiration(delay),
        );
        console.warn(
          `Moderation log: delivery deferred (HTTP ${discordError?.status ?? "unknown"}, code ${discordError?.code ?? "unknown"})`,
        );
        break; // Respect the webhook/global rate limit for the entire batch.
      }
    }
  } finally {
    await releaseLock(token, context);
  }
}

export async function ensureModlogSchedule(context: TriggerContext) {
  const jobs = await context.scheduler.listJobs();
  if (!jobs.some((job) => job.name === MODLOG_JOB)) {
    await context.scheduler.runJob({ name: MODLOG_JOB, cron: "* * * * *" });
  }
}

export const DeliverModerationLog: ScheduledJobType<undefined> = {
  name: MODLOG_JOB,
  onRun: async (_event, context) => deliverPending(context),
};
