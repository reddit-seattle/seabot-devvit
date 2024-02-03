import { PostReportDefinition } from "@devvit/public-api";
import { POST_REPORT_WEBHOOK } from "../settings.js";
import { getItemDateString } from "../utils.js";

const LogPostReport: PostReportDefinition = {
    event: 'PostReport',
    onEvent: async (evt, ctx) => {
        console.log(`Received Post Report:\n${JSON.stringify(evt)}`);

        const discordWebhookUrl = await ctx.settings.get(POST_REPORT_WEBHOOK);
        if (!discordWebhookUrl) {
            return;
        }

        const { reason, subreddit, post } = evt;

        const title = `New post reported`;
        const submission = await ctx.reddit.getPostById(post?.id ?? '');
        const { modReportReasons, userReportReasons, title: postTitle, score, authorName, permalink } = submission;

        let truncatedTitle = postTitle.length > 100 ? `${postTitle.slice(0, 97)}...` : postTitle;
        let desc = [`${truncatedTitle}`, `Reason: ${reason}`].join('\n');
        console.log(desc)

        const fields: Array<{ name: string, value: string }> = [
            {
                name: 'Details:',
                value: [
                    `Permalink: [${permalink}](https://reddit.com${permalink})`,
                    `Author: [${authorName}](https://reddit.com/u/${authorName})`,
                    `Created ${getItemDateString(submission)}`,
                    `Score: **${score}** [${post?.upvotes} up | ${post?.downvotes} down]`,
                    `Comments: ${submission.numberOfComments}`,
                    `Total Reports: ${post?.numReports || 0}`,
                ].join('\n')
            },
        ];
        // mod reports
        const modReports = modReportReasons.length
            ? modReportReasons.map(str => `- ${str}`).join('\n')
            : undefined;

        const userReports = userReportReasons.length
            ? userReportReasons.map(str => `- ${str}`).join('\n')
            : undefined;


        if (modReports) {
            fields.push({
                name: 'Mod Reports',
                value: modReports
            });
        }
        if (userReports) {
            fields.push({
                name: 'User Reports',
                value: userReports
            });
        }


        // https://discord.com/developers/docs/resources/webhook#execute-webhook-jsonform-params
        const payload = {
            embeds: [
                // https://discord.com/developers/docs/resources/channel#embed-object
                {
                    ...{ title },
                    'type': 'rich',
                    'description': desc,
                    fields: [
                        ...fields
                    ],
                },
            ],
            //  'thread_name': {}  // maybe this is a bad idea? like the forum channel idea tho
        };
        console.log(`Sending webhook:\n${JSON.stringify(payload)}`);
        await fetch(
            `${discordWebhookUrl}`,
            {
                method: 'post',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            }
        );
    }
};
export default LogPostReport;