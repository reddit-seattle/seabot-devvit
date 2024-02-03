import { Comment, CommentReportDefinition } from "@devvit/public-api";
import { COMMENT_REPORT_WEBHOOK } from "../settings";
import { getItemDateString } from "../utils";

const LogCommentDefinition: CommentReportDefinition = {
    event: 'CommentReport',
    onEvent: async (evt, ctx) => {

        // if we don't have a webhook, skip
        const discordWebhookUrl = await ctx.settings.get(COMMENT_REPORT_WEBHOOK);
        if (!discordWebhookUrl) {
            return;
        }

        console.log(JSON.stringify(evt))
        const { reason, subreddit, comment } = evt;
        const title = `New comment reported`;
        console.log(title);
        const submission: Comment = await ctx.reddit.getCommentById(comment?.id ?? '');
        const { modReportReasons, userReportReasons, body, score, authorName, permalink } = submission;
        let desc = `Report: ${reason}`;
        console.log(desc)

        const fields: Array<{ name: string, value: string }> = [];
        fields.push(
            {
                name: 'Details:',
                value: [
                    `Comment: ||${comment?.body}||`,
                    `Permalink: [${permalink}](https://reddit.com${permalink})`,
                    `Author: [${authorName}](https://reddit.com/u/${authorName})`,
                    `Created ${getItemDateString(submission)}`,
                    `Score: **${score}** [${comment?.upvotes} up | ${comment?.downvotes} down]`,
                    `Replies: ${submission.replies}`,
                    `Total Reports: ${submission?.numReports || 0}`,
                    `Crowd Control: ${submission?.collapsedBecauseCrowdControl}`,
                ].join('\n')
            },
        )
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
        console.dir(payload);

        const response = await fetch(
            `${discordWebhookUrl}`,
            {
                method: 'post',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            }
        );
        console.log(await response.json());
    }
}

export default LogCommentDefinition;