import { OnPostDeleteDefinition } from "@devvit/public-api";
import { POST_DELETE_WEBHOOK, Icons } from "../settings.js";
import { SendContentToWebhook } from "../utils/webhooks.js";
import { getWebhookUrl } from "../utils/reportHelpers.js";

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
      const title = `${Icons.POST} Post Deleted`;

      // Create content preview if body exists
      const contentPreview = post.body
        ? post.body.length > 500
          ? `${post.body.slice(0, 497)}...`
          : post.body
        : "No content";

      const desc = [
        `**Post:** ${post.title}`,
        `**Author:** ${author}`,
        `**Content:**`,
        `\`\`\``,
        `${contentPreview}`,
        `\`\`\``,
      ].join("\n");

      const embed = {
        title,
        type: "rich",
        description: desc,
        footer: {
          text: new Date().toLocaleString("en-US", {
            timeZone: "America/Los_Angeles",
          }),
        },
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
