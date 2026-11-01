import type {
  ModActionDefinition,
  MultiTriggerDefinition,
} from "@devvit/public-api";
import { MODLOG_IGNORED_ACTIONS, MODLOG_WEBHOOK } from "../settings.js";
import { parseWebhook } from "../modlog/discord.js";
import { normalizeAction } from "../modlog/events.js";
import { enqueueAction, ensureModlogSchedule } from "../modlog/queue.js";

export const SetupModerationLog: MultiTriggerDefinition<
  "AppInstall" | "AppUpgrade"
> = {
  events: ["AppInstall", "AppUpgrade"],
  onEvent: async (_event, context) => ensureModlogSchedule(context),
};

const LogModActions: ModActionDefinition = {
  event: "ModAction",
  onEvent: async (event, context) => {
    const setting = await context.settings.get<string>(MODLOG_WEBHOOK);
    if (!setting?.trim()) return;
    const ignored = (
      (await context.settings.get<string>(MODLOG_IGNORED_ACTIONS)) || ""
    )
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    if (ignored.includes((event.action || "unknown").toLowerCase())) return;
    const webhook = parseWebhook(setting);
    const entry = await normalizeAction(event, context);
    // Don't swallow storage errors: the action isn't acknowledged until it is queued.
    await enqueueAction(entry, webhook.id, context);
  },
};

export default LogModActions;
