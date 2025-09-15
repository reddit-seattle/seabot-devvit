import { PostReportDefinition } from "@devvit/public-api";
import { POST_REPORT_WEBHOOK } from "../settings.js";
import { getItemDateString } from "../utils/parsers.js";
import { SendContentToWebhook } from "../utils/webhooks.js";
import { createPermalinkLink, createUserLink } from "../utils/reddithelpers.js";

const LogPostReport: PostReportDefinition = {
  event: "PostReport",
  onEvent: async (evt, ctx) => {
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

    const title = `New post reported`;
    let truncatedTitle =
      postTitle.length > 100 ? `${postTitle.slice(0, 97)}...` : postTitle;
    let desc = [`${truncatedTitle}`, `Reason: ${reason}`].join("\n");
    const fields: Array<{ name: string; value: string }> = [
      {
        name: "Details:",
        value: [
          createPermalinkLink(permalink, `Permalink`),
          createUserLink(authorName),
          `Created ${getItemDateString(submission)}`,
          `Score: **${score}** [${post?.upvotes} up | ${post?.downvotes} down]`,
          `Comments: ${submission.numberOfComments}`,
          `Total Reports: ${post?.numReports || 0}`,
        ].join("\n"),
      },
    ];
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
    // https://discord.com/developers/docs/resources/webhook#execute-webhook-jsonform-params
    const payload = {
      embeds: [
        {
          title,
          type: "rich",
          description: desc,
          fields,
        },
      ],
    };
    await SendContentToWebhook(discordWebhookUrl, payload);
  },
};
export default LogPostReport;
