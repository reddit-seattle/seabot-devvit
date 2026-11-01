import type { ModActionDefinition } from "@devvit/public-api";
import { MODLOG_IGNORED_ACTIONS, MODLOG_WEBHOOK } from "../settings.js";
import { formatModAction } from "../utils/modlogHelpers.js";
import { sendToDiscordThread } from "../utils/threadedWebhook.js";

const LogModActions: ModActionDefinition = {
  event: "ModAction",
  onEvent: async (event, context) => {
    try {
      const webhook = await context.settings.get<string>(MODLOG_WEBHOOK);
      if (!webhook?.trim()) return;
      const ignored = (
        (await context.settings.get<string>(MODLOG_IGNORED_ACTIONS)) || ""
      )
        .split(",")
        .map((action) => action.trim().toLowerCase());
      if (ignored.includes((event.action || "unknown").toLowerCase())) return;
      const message = await formatModAction(event, context);
      await sendToDiscordThread(webhook, message, context.redis);
    } catch (error) {
      console.error(
        "Error in moderation log handler:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
};

export default LogModActions;
