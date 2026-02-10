import { PostReportDefinition } from "@devvit/public-api";
import { Icons, POST_REPORT_WEBHOOK } from "../settings.js";
import { createPermalinkLink } from "../utils/reddithelpers.js";
import {
  buildReportReasonFields,
  buildSubmissionDetailsFields,
  getWebhookUrl,
  logIgnoredReport,
  createDiscordEmbed,
} from "../utils/reportHelpers.js";

const LogPostReport: PostReportDefinition = {
  event: "PostReport",
  onEvent: async (evt, ctx) => {
    try {
      const discordWebhookUrl = await getWebhookUrl(ctx, POST_REPORT_WEBHOOK);
      if (!discordWebhookUrl) {
        return;
      }

      const { reason, post } = evt;

      const submission = await ctx.reddit.getPostById(post?.id ?? "");
      const {
        ignoringReports,
        modReportReasons,
        userReportReasons,
        title: postTitle,
        permalink,
      } = submission;

      if (ignoringReports) {
        logIgnoredReport(permalink, postTitle, "post");
        return;
      }

      const title = `${Icons.POST} New post reported`;
      const postLink = createPermalinkLink(permalink, postTitle);
      const desc = `**Post:** ${postLink}\n**Reason:** ${reason}`;

      // Get author information for karma stats
      let author = null;
      try {
        author = await ctx.reddit.getUserById(submission.authorId ?? "");
      } catch (error) {
        console.error("Failed to get user by ID:", error);
      }

      // Build fields
      const fields = [
        ...buildSubmissionDetailsFields(author ?? null, post || submission),
        ...buildReportReasonFields(modReportReasons, userReportReasons, reason),
      ];

      await createDiscordEmbed(discordWebhookUrl, title, desc, fields);
    } catch (error) {
      console.error("Error in post reports handler:", error);
    }
  },
};
export default LogPostReport;
