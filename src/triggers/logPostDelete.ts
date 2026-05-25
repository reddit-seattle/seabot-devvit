import { OnPostDeleteDefinition } from "@devvit/public-api";
import { POST_DELETE_WEBHOOK, Icons } from "../settings.js";
import { formatDeletedPostContent, createEmbedFooter } from "../utils/discordFormatters.js";
import { getWebhookUrl } from "../utils/reportHelpers.js";
import { SendContentToWebhook } from "../utils/webhooks.js";

/**
 * Logs when a post is deleted.
 * Captures post title, author, and content preview to track deletions that may evade moderation.
 */
const LogPostDelete: OnPostDeleteDefinition = {
  event: "PostDelete",
  onEvent: async (event, context) => {
    try {
      const { post } = event;
      if (!post) {
        console.warn("PostDelete event missing post data.");
        return;
      }

      const webhookUrl = await getWebhookUrl(context, POST_DELETE_WEBHOOK);
      if (!webhookUrl) {
        return;
      }

      const author = post.authorName || "unknown";
      const title = post.title || "Untitled Post";
      const content = formatDeletedPostContent(
        title,
        author,
        post.body,
      );

      const embed = {
        title: `${Icons.POST} Post Deleted`,
        type: "rich",
        description: content,
        ...createEmbedFooter(),
      };

      await SendContentToWebhook(webhookUrl, {
        embeds: [embed],
      });
    } catch (error) {
      console.error("Error in PostDelete trigger:", error);
    }
  },
};

export default LogPostDelete;
