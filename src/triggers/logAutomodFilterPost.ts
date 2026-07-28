import { OnAutomoderatorFilterPostDefinition } from "@devvit/public-api";
import { AUTOMOD_FILTER_POST_WEBHOOK, Icons } from "../settings.js";
import { createPermalinkLink } from "../utils/reddithelpers.js";
import {
  buildSubmissionDetailsFields,
  getWebhookUrl,
  createDiscordEmbed,
} from "../utils/reportHelpers.js";
import { formatCommentContent } from "../utils/discordFormatters.js";

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

      const webhookUrl = await getWebhookUrl(
        context,
        AUTOMOD_FILTER_POST_WEBHOOK,
      );
      if (!webhookUrl) {
        return;
      }

      const submission = await context.reddit.getPostById(post.id ?? "");
      const { authorId, title: postTitle, permalink, body } = submission;

      const title = `${Icons.POST} Automod Filtered Post`;
      const postLink = createPermalinkLink(permalink, postTitle);
      const desc = body
        ? `${postLink}\n**Post Content:**\n${formatCommentContent({ body }, 400)}\n**Reason:** ${reason ?? "No reason provided"}`
        : `${postLink}\n**Reason:** ${reason ?? "No reason provided"}`;

      const author = authorId
        ? await context.reddit.getUserById(authorId).catch(() => null)
        : null;

      const fields = [
        ...buildSubmissionDetailsFields(author ?? null, submission),
      ];

      await createDiscordEmbed(webhookUrl, title, desc, fields);
    } catch (error) {
      console.error("Error in AutomoderatorFilterPost trigger:", error);
    }
  },
};

export default AutomodFilterPost;
