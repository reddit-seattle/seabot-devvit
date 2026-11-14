import type { ModActionDefinition } from "@devvit/public-api";
import { SHADOWBAN_CONFIG, MODMAIL_REPORT_WEBHOOK } from "../settings.js";
import { SendContentToWebhook } from "../utils/webhooks.js";
import {
  SEEN,
  WARMUP_STATE,
  SEEN_VALUE,
  getRemovalLog,
  qualifyingAuthor,
} from "./shadowbanCache.js";

const REDDIT_ORIGIN = "https://www.reddit.com";
const MILLISECONDS_PER_SECOND = 1000;
const actionId = (id: string) => id.replace(/^ModAction_/i, "");

const LogFirstShadowban: ModActionDefinition = {
  event: "ModAction",
  onEvent: async (event, context) => {
    const removedAt = event.actionedAt?.getTime();
    const moderator = event.moderator?.name?.toLowerCase();
    if (
      event.action !== "removecomment" ||
      !event.id ||
      removedAt === undefined ||
      !Number.isFinite(removedAt) ||
      !context.subredditName ||
      (moderator && moderator !== SHADOWBAN_CONFIG.moderatorName.toLowerCase())
    )
      return;
    const webhook = await context.settings.get<string>(MODMAIL_REPORT_WEBHOOK);
    if (!webhook?.trim()) return;

    // The trigger omits the rule reason. Look up this event, not the user's history.
    const eventSecond =
      Math.floor(removedAt / MILLISECONDS_PER_SECOND) * MILLISECONDS_PER_SECOND;
    for await (const action of getRemovalLog(context)) {
      if (action.createdAt.getTime() < eventSecond) break;
      if (actionId(action.id) !== actionId(event.id)) continue;
      const author = qualifyingAuthor(action);
      if (!author) return;

      // During bootstrap, matching events seed the cache without sending alerts.
      const state = await context.redis.get(WARMUP_STATE);
      if (!(await context.redis.hSetNX(SEEN, author.toLowerCase(), SEEN_VALUE)))
        return;
      if (
        !JSON.parse(state || "{}").ready ||
        removedAt < SHADOWBAN_CONFIG.alertsStartAtMs
      )
        return;
      const permalink = action.target?.permalink;
      if (!permalink) return;
      // Best effort: claim before sending, and log failures without retrying.
      try {
        const response = await SendContentToWebhook(webhook.trim(), {
          embeds: [
            {
              title: `First shadowban for u/${author}`,
              url: new URL(permalink, REDDIT_ORIGIN).href,
            },
          ],
        });
        if (!response.ok) throw new Error(`Discord HTTP ${response.status}`);
      } catch (error) {
        console.error(
          `Shadowban alert failed for u/${author}, ${action.id}`,
          error,
        );
      }
      return;
    }
    throw new Error(`Shadowban event missing from moderation log: ${event.id}`);
  },
};
export default LogFirstShadowban;
