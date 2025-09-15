import { Comment, CommentReportDefinition } from "@devvit/public-api";
import {
  COMMENT_REPORT_WEBHOOK,
  EMOJI_COMMENT,
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
  formatCommentContent,
  formatReportReasons,
  createDiscordField,
  createEmbedFooter,
  type UserInfo,
  type ScoreInfo,
  type CommentInfo,
  type PostInfo,
} from "../utils/discordFormatters.js";

const LogCommentDefinition: CommentReportDefinition = {
  event: "CommentReport",
  onEvent: async (evt, ctx) => {
    // if we don't have a webhook, skip
    const discordWebhookUrl = (await ctx.settings.get(
      COMMENT_REPORT_WEBHOOK
    )) as string;
    if (!discordWebhookUrl) {
      return;
    }

    const { reason, comment } = evt;
    const submission: Comment = await ctx.reddit.getCommentById(
      comment?.id ?? ""
    );
    const {
      ignoringReports,
      modReportReasons,
      userReportReasons,
      score,
      authorName,
      authorId,
      permalink,
    } = submission;
    if (ignoringReports) {
      if (!comment?.body) {
        console.log("Ignoring report for comment with no body:", createPermalinkLink(permalink, comment?.id || "unknown"));
        return; // don't log ignored reports
      } else {
        // if the comment body is too long, truncate it
        const truncatedBody = comment.body.length > 100
          ? `${comment.body.slice(0, 97)}...`
          : comment.body;
        console.log("Ignoring report for comment:", createPermalinkLink(permalink, truncatedBody));
      }
    }

    const title = `${EMOJI_COMMENT} New comment reported`;

    // Create description with comment in markdown code blocks first, then reason
    let desc = `**Reason:** ${reason}`;
    if (comment?.body) {
      const commentInfo: CommentInfo = {
        body: comment.body,
        maxLength: 400 // Shorter for description
      };

      desc = `**Comment:**\n${formatCommentContent(commentInfo)}\n**Reason:** ${reason}`;
    }

    const post = await ctx.reddit.getPostById(submission.postId);
    const author = await ctx.reddit.getUserById(authorId ?? "");

    const fields: Array<{ name: string; value: string }> = [];

    // User information field
    const userInfo: UserInfo = {
      authorName,
      authorId,
      linkKarma: author?.linkKarma,
      commentKarma: author?.commentKarma,
      createdAt: author?.createdAt,
    };

    fields.push(createDiscordField(
      "User",
      formatUserInfo(userInfo, submission)
    ));

    // Post context field
    const postInfo: PostInfo = {
      title: post?.title || "Unknown Post",
      permalink: createPermalinkLink(post?.permalink || permalink, post?.title || "Unknown Post"),
      numberOfComments: post?.numberOfComments,
    };

    fields.push(createDiscordField(
      "Post",
      postInfo.permalink
    ));

    // Comment statistics field (includes consolidated karma)
    const scoreInfo: ScoreInfo = {
      score,
      upvotes: comment?.upvotes,
      downvotes: comment?.downvotes,
      numReports: submission?.numReports,
      collapsedBecauseCrowdControl: submission?.collapsedBecauseCrowdControl,
    };

    fields.push(createDiscordField(
      `${EMOJI_STATS} Statistics`,
      formatScoreInfo(scoreInfo)
    ));

    // Mod reports field
    if (modReportReasons.length > 0) {
      fields.push(createDiscordField(
        `${EMOJI_WARNING} Mod Reports`,
        formatReportReasons(modReportReasons, EMOJI_DIAMOND_ORANGE)
      ));
    }

    // User reports field
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
  },
};

export default LogCommentDefinition;
