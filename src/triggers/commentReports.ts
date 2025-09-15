import { Comment, CommentReportDefinition } from "@devvit/public-api";
import { COMMENT_REPORT_WEBHOOK } from "../settings.js";
import { getItemDateString } from "../utils/parsers.js";
import { SendContentToWebhook } from "../utils/webhooks.js";
import { createPermalinkLink, createUserLink } from "../utils/reddithelpers.js";

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

    const title = `New comment reported`;
    let desc = `Reason: ${reason}`;

    const fields: Array<{ name: string; value: string }> = [];
    fields.push({
      name: "Details:",
      value: [
        `Comment: ||${comment?.body}||`,
        createPermalinkLink(permalink, `Permalink`),
        createUserLink(authorName),
        `Created ${getItemDateString(submission)}`,
        `Score: **${score}** [${comment?.upvotes} up | ${comment?.downvotes} down]`,
        `Total Reports: ${submission?.numReports || 0}`,
        `Crowd Control: ${submission?.collapsedBecauseCrowdControl}`,
      ].join("\n"),
    });
    // mod reports
    const modReports = modReportReasons.length
      ? modReportReasons.map((str) => `- ${str}`).join("\n")
      : undefined;

    const userReports = userReportReasons.length
      ? userReportReasons.map((str) => `- ${str}`).join("\n")
      : undefined;

    if (modReports) {
      fields.push({
        name: "Mod Reports",
        value: modReports,
      });
    }
    if (userReports) {
      fields.push({
        name: "User Reports",
        value: userReports,
      });
    }

    const embed = {
      title,
      type: "rich",
      description: desc,
      fields,
    };
    const payload = {
      embeds: [embed],
    };

    await SendContentToWebhook(discordWebhookUrl, payload);
  },
};

export default LogCommentDefinition;
