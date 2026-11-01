export function parseWebhook(value: string): { url: string; id: string } {
  // Don't include the supplied URL in errors: its path contains a credential.
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Invalid moderation log webhook URL");
  }
  const match = url.pathname.match(
    /^\/api\/(?:v\d+\/)?webhooks\/(\d+)\/([A-Za-z0-9._-]+)\/?$/,
  );
  if (
    url.protocol !== "https:" ||
    !["discord.com", "discordapp.com"].includes(url.hostname) ||
    url.port ||
    url.username ||
    url.password ||
    !match ||
    url.search ||
    url.hash
  ) {
    throw new Error("Use a Discord forum webhook URL without query parameters");
  }
  url.hostname = "discord.com";
  return { url: url.toString().replace(/\/$/, ""), id: match[1] };
}

export class DiscordDeliveryError extends Error {
  constructor(
    public status: number,
    public code?: number,
    public retryAfter = 0,
  ) {
    super(
      `Discord moderation log delivery failed (HTTP ${status}, code ${code ?? "unknown"})`,
    );
  }
}

export async function sendToThread(
  webhook: string,
  payload: Record<string, unknown>,
  thread: { id: string } | { name: string },
): Promise<string> {
  const url = new URL(webhook);
  url.searchParams.set("wait", "true");
  if ("id" in thread) url.searchParams.set("thread_id", thread.id);
  try {
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        ...("name" in thread ? { thread_name: thread.name } : {}),
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      id?: string;
      channel_id?: string;
      code?: number;
      retry_after?: number;
    };
    if (!response.ok) {
      const retryAfter = Math.max(
        Number(response.headers.get("retry-after")) || 0,
        Number(data.retry_after) || 0,
      );
      throw new DiscordDeliveryError(
        response.status,
        data.code,
        Number.isFinite(retryAfter) ? retryAfter : 0,
      );
    }
    // In a forum, the starter message ID is also the newly created thread ID.
    // Reject a normal text-channel response instead of storing its parent channel.
    if (
      !data.id ||
      !data.channel_id ||
      !/^\d+$/.test(data.channel_id) ||
      data.channel_id !== ("id" in thread ? thread.id : data.id)
    ) {
      throw new DiscordDeliveryError(400, undefined);
    }
    return data.channel_id;
  } catch (error) {
    if (error instanceof DiscordDeliveryError) throw error;
    // Fetch exceptions can include the secret URL. Never propagate those messages.
    throw new DiscordDeliveryError(0);
  }
}
