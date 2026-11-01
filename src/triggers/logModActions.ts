import type {
  ModActionDefinition,
  ModMailDefinition,
  TriggerContext,
} from "@devvit/public-api";
import { MODLOG_IGNORED_ACTIONS, MODLOG_WEBHOOK } from "../settings.js";
import { formatLinkedBan, formatModAction } from "../utils/modlogHelpers.js";
import { sendToDiscordThread } from "../utils/threadedWebhook.js";

async function logToDiscord(
  action: string | undefined,
  context: TriggerContext,
  format: () => ReturnType<typeof formatModAction>,
) {
  try {
    const webhook = await context.settings.get<string>(MODLOG_WEBHOOK);
    if (!webhook?.trim()) return;
    const ignored = (
      (await context.settings.get<string>(MODLOG_IGNORED_ACTIONS)) || ""
    )
      .split(",")
      .map((name) => name.trim().toLowerCase());
    if (ignored.includes((action || "unknown").toLowerCase())) return;
    const message = await format();
    if (message) await sendToDiscordThread(webhook, message, context.redis);
  } catch (error) {
    console.error(
      "Error in moderation log handler:",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

const LogModActions: ModActionDefinition = {
  event: "ModAction",
  onEvent: (event, context) =>
    logToDiscord(event.action, context, () => formatModAction(event, context)),
};

export const LogLinkedBans: ModMailDefinition = {
  event: "ModMail",
  onEvent: (event, context) =>
    logToDiscord("banuser", context, () => formatLinkedBan(event, context)),
};

export default LogModActions;
