import { OnCommentDeleteDefinition } from "@devvit/public-api";
import { COMMENT_DELETE_WEBHOOK, Icons } from "../settings.js";
import { formatDeletedCommentContent, createEmbedFooter } from "../utils/discordFormatters.js";
import { getWebhookUrl } from "../utils/reportHelpers.js";
import { SendContentToWebhook } from "../utils/webhooks.js";

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
      const postTitle = post?.title;
      const content = formatDeletedCommentContent(
        comment.body,
        author,
        postTitle,
      );

      const embed = {
        title: `${Icons.COMMENT} Comment Deleted`,
        type: "rich",
        description: content,
        ...createEmbedFooter(),
      };

      await SendContentToWebhook(webhookUrl, {
        embeds: [embed],
      });
    } catch (error) {
      console.error("Error in CommentDelete trigger:", error);
    }
  },
};

export default LogCommentDelete;
