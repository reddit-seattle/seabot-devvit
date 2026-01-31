import { Comment, CommentReportDefinition } from "@devvit/public-api";
import { COMMENT_REPORT_WEBHOOK, Icons } from "../settings.js";
import {
  createDiscordField,
  formatCommentContent,
} from "../utils/discordFormatters.js";
import { createPermalinkLink } from "../utils/reddithelpers.js";
import {
  buildReportReasonFields,
  buildSubmissionDetailsFields,
  getWebhookUrl,
  logIgnoredReport,
  createDiscordEmbed,
} from "../utils/reportHelpers.js";

const LogCommentReports: CommentReportDefinition = {
  event: "CommentReport",
  onEvent: async (evt, ctx) => {
    // if we don't have a webhook, skip
    const discordWebhookUrl = await getWebhookUrl(ctx, COMMENT_REPORT_WEBHOOK);
    if (!discordWebhookUrl) {
      return;
    }

    const { reason, comment } = evt;
    const submission: Comment = await ctx.reddit.getCommentById(
      comment?.id ?? "",
    );

    const {
      ignoringReports,
      modReportReasons,
      userReportReasons,
      authorId,
      permalink,
    } = submission;

    if (ignoringReports) {
      const label = comment?.body || comment?.id || "unknown";
      logIgnoredReport(permalink, label, "comment");
      return;
    }

    const title = `${Icons.COMMENT} New comment reported`;

    // Create description with comment permalink, content, and reason
    const commentPermalink = createPermalinkLink(
      permalink,
      "Direct Comment Link",
    );
    const desc = comment?.body
      ? `${commentPermalink}\n**Comment:**\n${formatCommentContent(
          comment,
          400,
        )}\n**Reason:** ${reason}`
      : `${commentPermalink}\n**Reason:** ${reason}`;

    const post = await ctx.reddit.getPostById(submission.postId);
    const author = await ctx.reddit.getUserById(authorId ?? "");

    // Build fields
    const fields = [
      ...buildSubmissionDetailsFields(author ?? null, comment || submission),
    ];

    // Add post context field
    const postLink = createPermalinkLink(
      post?.permalink || permalink,
      post?.title || "Unknown Post",
    );
    fields.push(createDiscordField("Post", postLink));

    // Add report reason fields
    fields.push(
      ...buildReportReasonFields(modReportReasons, userReportReasons, reason),
    );

    await createDiscordEmbed(discordWebhookUrl, title, desc, fields);
  },
};

export default LogCommentReports;
