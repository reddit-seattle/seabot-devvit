import { PostReportDefinition } from "@devvit/public-api";
import {
  POST_REPORT_WEBHOOK,
  EMOJI_POST,
  EMOJI_STATS,
  EMOJI_WARNING,
  EMOJI_MEGAPHONE,
  EMOJI_DIAMOND_ORANGE,
  EMOJI_DIAMOND_BLUE
} from "../settings.js";
import { SendContentToWebhook } from "../utils/webhooks.js";
import { createPermalinkLink } from "../utils/reddithelpers.js";
import {
  formatUserInfo,
  formatScoreInfo,
  formatReportReasons,
  createDiscordField,
  createEmbedFooter,
  type UserInfo,
  type ScoreInfo,
  type PostInfo
} from "../utils/discordFormatters.js";

const LogPostReport: PostReportDefinition = {
  event: "PostReport",
  onEvent: async (evt, ctx) => {
    try {
      const discordWebhookUrl = (await ctx.settings.get(
        POST_REPORT_WEBHOOK
      )) as string;
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
        score,
        authorName,
        permalink,
      } = submission;
      if (ignoringReports) {
        const truncatedTitle = postTitle.length > 100 ? `${postTitle.slice(0, 97)}...` : postTitle;
        console.log("Ignoring report for post:", createPermalinkLink(permalink, truncatedTitle));
        return; // don't log ignored reports
      }

      const title = `${EMOJI_POST} New post reported`;
      const postInfo: PostInfo = {
        title: postTitle,
        permalink: createPermalinkLink(permalink, postTitle)
      };
      const desc = `**Post:** ${postInfo.permalink}\n**Reason:** ${reason}`;

      const fields: Array<{ name: string; value: string }> = [];

      // Get author information for karma stats
      let author = null;
      try {
        author = await ctx.reddit.getUserById(submission.authorId ?? "");
      } catch (error) {
        console.error("Failed to get user by ID:", error);
        // Continue with null author data
      }
      
      const userInfo: UserInfo = {
        authorName,
        linkKarma: author?.linkKarma,
        commentKarma: author?.commentKarma,
        createdAt: author?.createdAt,
      };

      // User field
      fields.push(createDiscordField(
        "User",
        formatUserInfo(userInfo, submission)
      ));

      // Post statistics field (includes consolidated karma)
      const scoreInfo: ScoreInfo = {
        score,
        upvotes: post?.upvotes,
        downvotes: post?.downvotes,
        numReports: post?.numReports,
      };

      fields.push(createDiscordField(
        `${EMOJI_STATS} Statistics`,
        formatScoreInfo(scoreInfo, submission.numberOfComments)
      ));

      // Report reasons fields
      if (modReportReasons.length > 0) {
        fields.push(createDiscordField(
          `${EMOJI_WARNING} Mod Reports`,
          formatReportReasons(modReportReasons, EMOJI_DIAMOND_ORANGE)
        ));
      }

      if (userReportReasons.length > 0) {
        fields.push(createDiscordField(
          `${EMOJI_MEGAPHONE} User Reports`,
          formatReportReasons(userReportReasons, EMOJI_DIAMOND_BLUE)
        ));
      }

      // If no categorized reports but we have a direct reason, show it as a user report
      if (modReportReasons.length === 0 && userReportReasons.length === 0 && reason) {
        fields.push(createDiscordField(
          `${EMOJI_MEGAPHONE} User Reports`,
          formatReportReasons([reason], EMOJI_DIAMOND_BLUE)
        ));
      }

      const footerData = createEmbedFooter();
      // https://discord.com/developers/docs/resources/webhook#execute-webhook-jsonform-params
      const embed = {
        title,
        type: "rich",
        description: desc,
        fields,
        ...footerData,
      };
      const payload = {
        embeds: [embed],
      };
      await SendContentToWebhook(discordWebhookUrl, payload);
    } catch (error) {
      console.error("Error in post reports handler:", error);
    }
  },
};
export default LogPostReport;
