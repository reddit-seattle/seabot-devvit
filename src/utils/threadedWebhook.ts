import type { TriggerContext } from "@devvit/public-api";
import { SendContentToWebhook } from "./webhooks.js";

export function parseWebhook(value: string): URL {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Invalid Discord forum webhook URL");
  }
  if (
    url.protocol !== "https:" ||
    !["discord.com", "discordapp.com"].includes(url.hostname) ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/api\/(?:v\d+\/)?webhooks\/\d+\/[A-Za-z0-9._-]+\/?$/.test(url.pathname)
  ) {
    throw new Error("Use a Discord forum webhook URL without query parameters");
  }
  url.hostname = "discord.com";
  return url;
}

export async function sendToDiscordThread(
  webhook: string,
  message: {
    group: string;
    actionId?: string;
    threadName: string;
    starter: Record<string, unknown>;
    payload: Parameters<typeof SendContentToWebhook>[1];
  },
  redis: TriggerContext["redis"],
) {
  const url = parseWebhook(webhook);
  const webhookId = url.pathname.match(/webhooks\/(\d+)/)![1];
  const key = `modlog:${webhookId}:${message.group}`;
  const done = message.actionId
    ? `modlog:${webhookId}:done:${message.actionId}`
    : undefined;
  const lock = `${key}:lock`;
  const token = `${Date.now()}:${Math.random()}`;
  const deadline = Date.now() + 10_000;
  const expires = (days: number) => ({
    expiration: new Date(Date.now() + days * 86_400_000),
  });
  // Serialize each group so simultaneous events cannot create separate threads.
  while (
    (await redis.set(lock, token, {
      nx: true,
      expiration: new Date(Date.now() + 120_000),
    })) !== "OK"
  ) {
    if (Date.now() >= deadline)
      throw new Error("Discord moderation thread is busy");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  try {
    if (done && (await redis.get(done))) return;
    let threadId = await redis.get(key);
    const send = async () => {
      url.searchParams.set("wait", "true");
      if (threadId) url.searchParams.set("thread_id", threadId);
      else url.searchParams.delete("thread_id");
      const response = await SendContentToWebhook(url.toString(), {
        ...message.payload,
        ...(!threadId
          ? {
              thread_name: message.threadName,
              embeds: [message.starter, ...message.payload.embeds],
            }
          : {}),
      }).catch(() => {
        throw new Error("Discord moderation webhook request failed");
      });
      const data = (await response.json().catch(() => ({}))) as {
        id?: string;
        channel_id?: string;
        code?: number;
      };
      return { response, data };
    };
    let result = await send();
    if (!result.response.ok && result.data.code === 10003 && threadId) {
      await redis.del(key); // A confirmed deleted thread can be recreated once.
      threadId = undefined;
      result = await send();
    }
    if (!result.response.ok)
      throw new Error(
        `Discord moderation webhook returned HTTP ${result.response.status}`,
      );
    const { id, channel_id: channelId } = result.data;
    // A forum's starter message and thread share an ID. Reject text-channel responses.
    if (
      !id ||
      !channelId ||
      !/^\d+$/.test(channelId) ||
      channelId !== (threadId || id)
    ) {
      throw new Error("Discord did not return the expected forum thread");
    }
    await redis.set(key, channelId, expires(90));
    if (done) await redis.set(done, "1", expires(7));
  } finally {
    // Compare-and-delete: an expired lease must never release a newer sender's lock.
    const transaction = await redis.watch(lock);
    try {
      if ((await redis.get(lock)) === token) {
        await transaction.multi();
        await transaction.del(lock);
        await transaction.exec();
      }
    } finally {
      await transaction.discard().catch(() => {});
    }
  }
}
