import { OnAutomoderatorFilterCommentDefinition } from "@devvit/public-api";
import { AUTOMOD_FILTER_COMMENT_WEBHOOK, Icons } from "../settings.js";
import { createPermalinkLink } from "../utils/reddithelpers.js";
import {
  buildSubmissionDetailsFields,
  getWebhookUrl,
  createDiscordEmbed,
} from "../utils/reportHelpers.js";
import {
  formatCommentContent,
  createDiscordField,
} from "../utils/discordFormatters.js";

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

      const webhookUrl = await getWebhookUrl(
        context,
        AUTOMOD_FILTER_COMMENT_WEBHOOK,
      );
      if (!webhookUrl) {
        return;
      }

      const submission = await context.reddit.getCommentById(comment.id ?? "");
      const { authorId, postId, body, permalink } = submission;

      const title = `${Icons.COMMENT} Automod Filtered Comment`;
      const commentPermalink = createPermalinkLink(
        permalink,
        "Direct Comment Link",
      );
      const desc = body
        ? `${commentPermalink}\n**Comment:**\n${formatCommentContent({ body }, 400)}\n**Reason:** ${reason ?? "No reason provided"}`
        : `${commentPermalink}\n**Reason:** ${reason ?? "No reason provided"}`;

      const author = authorId
        ? await context.reddit.getUserById(authorId).catch(() => null)
        : null;
      const post = await context.reddit
        .getPostById(postId ?? "")
        .catch(() => null);

      const fields = [
        ...buildSubmissionDetailsFields(author ?? null, submission),
      ];

      if (post) {
        const postLink = createPermalinkLink(
          post.permalink,
          post.title || "Unknown Post",
        );
        fields.push(createDiscordField("Post", postLink));
      }

      await createDiscordEmbed(webhookUrl, title, desc, fields);
    } catch (error) {
      console.error("Error in AutomoderatorFilterComment trigger:", error);
    }
  },
};

export default AutomodFilterComment;
