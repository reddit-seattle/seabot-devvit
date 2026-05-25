import {
  OnAutomoderatorFilterCommentDefinition,
} from "@devvit/public-api";
import {
  AUTOMOD_FILTER_COMMENT_WEBHOOK,
} from "../settings.js";
import { SendContentToWebhook } from "../utils/webhooks.js";
import { getWebhookUrl } from "../utils/reportHelpers.js";

/**
 * Logs when automod filters a comment.
 * Logs to the Automod Comment Webhook with the comment URL and the reason for filtering.
 */
const AutomodFilterComment: OnAutomoderatorFilterCommentDefinition = {
  event: "AutomoderatorFilterComment",
  onEvent: async (event, context) => {
    try {
      const { comment, reason } = event;
      if (!comment) {
        console.warn("AutomoderatorFilterComment event missing comment data.");
        return;
      }
      const webhookUrl = await getWebhookUrl(context, AUTOMOD_FILTER_COMMENT_WEBHOOK);
      if (webhookUrl) {
        await SendContentToWebhook(webhookUrl, {
          content: `Automoderator filtered https://www.reddit.com${comment.permalink}. Reason: ${reason ?? 'No reason provided'}`,
        });
      }
      return;
    } catch (error) {
      console.error("Error in AutomoderatorFilterComment trigger:", error);
    }
  },
};

export default AutomodFilterComment;
