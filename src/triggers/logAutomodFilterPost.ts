import {
  OnAutomoderatorFilterPostDefinition,
} from "@devvit/public-api";
import {
  AUTOMOD_FILTER_POST_WEBHOOK,
} from "../settings.js";
import { SendContentToWebhook } from "../utils/webhooks.js";
import { getWebhookUrl } from "../utils/reportHelpers.js";

/**
 * Logs when automod filters a post.
 * Logs to the Automod Post Webhook with the post URL and the reason for filtering.
 */
const AutomodFilterPost: OnAutomoderatorFilterPostDefinition = {
  event: "AutomoderatorFilterPost",
  onEvent: async (event, context) => {
    try {
      const { post, reason } = event;
      if (!post) {
        console.warn("AutomoderatorFilterPost event missing post data.");
        return;
      }
      const webhookUrl = await getWebhookUrl(context, AUTOMOD_FILTER_POST_WEBHOOK);
      if (webhookUrl) {
        await SendContentToWebhook(webhookUrl, {
          content: `Automoderator filtered https://www.reddit.com${post.permalink}. Reason: ${reason ?? 'No reason provided'}`,
        });
      }
      return;
    } catch (error) {
      console.error("Error in AutomoderatorFilterPost trigger:", error);
    }
  },
};

export default AutomodFilterPost;
