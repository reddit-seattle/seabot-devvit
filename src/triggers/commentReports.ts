import { Comment, CommentReportDefinition } from "@devvit/public-api";
import { COMMENT_REPORT_WEBHOOK } from "../settings.js";
import { getItemDateString, SendContentToWebhook } from "../utils.js";

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
    const title = `New comment reported`;
    const submission: Comment = await ctx.reddit.getCommentById(
      comment?.id ?? ""
    );
    const {
      modReportReasons,
      userReportReasons,
      score,
      authorName,
      permalink,
    } = submission;

    let desc = `Reason: ${reason}`;

    const fields: Array<{ name: string; value: string }> = [];
    fields.push({
      name: "Details:",
      value: [
        `Comment: ||${comment?.body}||`,
        `Permalink: [${permalink}](https://reddit.com${permalink})`,
        `Author: [${authorName}](https://reddit.com/u/${authorName})`,
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
      ...{ title },
      type: "rich",
      description: desc,
      fields: [...fields],
    };
    const payload = {
      embeds: [embed],
    };

    await SendContentToWebhook(discordWebhookUrl, payload);
  },
};

export default LogCommentDefinition;
