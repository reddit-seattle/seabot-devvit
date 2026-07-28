import { OnCommentDeleteDefinition } from "@devvit/public-api";
import { COMMENT_DELETE_WEBHOOK, Icons } from "../settings.js";
import {
  formatCommentContent,
  createDiscordField,
} from "../utils/discordFormatters.js";
import {
  getWebhookUrl,
  buildSubmissionDetailsFields,
  createDiscordEmbed,
} from "../utils/reportHelpers.js";

/**
 * Logs when a comment is deleted.
 * Captures comment body, author, and post context to track deletions that may evade moderation.
 */
const LogCommentDelete: OnCommentDeleteDefinition = {
  event: "CommentDelete",
  onEvent: async (event, context) => {
    try {
      const { comment, post } = event;
      if (!comment) {
        console.warn("CommentDelete event missing comment data.");
        return;
      }

      const webhookUrl = await getWebhookUrl(context, COMMENT_DELETE_WEBHOOK);
      if (!webhookUrl) {
        return;
      }

      const author = comment.authorName || "unknown";
      const title = `${Icons.COMMENT} Comment Deleted`;
      const commentPreview = comment.body
        ? comment.body.length > 500
          ? `${comment.body.slice(0, 497)}...`
          : comment.body
        : "No content";

      const desc = [
        `**Author:** ${author}`,
        `**Comment:**`,
        `\`\`\``,
        `${commentPreview}`,
        `\`\`\``,
      ].join("\n");

      const fields: Array<{ name: string; value: string }> = [];

      // Add post context
      if (post) {
        const postLink = `[${post.title}](https://www.reddit.com${post.permalink})`;
        fields.push(createDiscordField("Post", postLink));
      }

      await createDiscordEmbed(webhookUrl, title, desc, fields);
    } catch (error) {
      console.error("Error in CommentDelete trigger:", error);
    }
  },
};

export default LogCommentDelete;
