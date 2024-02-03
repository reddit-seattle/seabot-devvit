import { ModMailDefinition } from "@devvit/public-api";
import { parseConversationType, parseParticipantAuthor } from "../utils";
import { MODMAIL_REPORT_WEBHOOK } from "../settings";

const LogModmailMessage: ModMailDefinition = {
    event: 'ModMail',
    onEvent: async (event, context) => {
        console.log(`Received modmail trigger event:\n${JSON.stringify(event)}`);

        const discordWebhookUrl = await context.settings.get(MODMAIL_REPORT_WEBHOOK);
        if (!discordWebhookUrl) {
            return;
        }
        const conversationId = event.conversationId;
        const result = await context.reddit.modMail.getConversation({
            conversationId: conversationId,
            markRead: false,
        });

        if (result.conversation) {
            const { conversation } = result;
            console.log(`Received conversation with subject: ${result.conversation.subject}`);

            // Example Message ID: ModmailMessage_2ch154
            const messageId = event.messageId.split('_')[1];
            const message = conversation.messages[messageId];
            const payload = {
                embeds: [
                    // https://discord.com/developers/docs/resources/channel#embed-object
                    {
                        title: `New modmail message from ${message.author?.name}`,
                        type: 'rich',
                        description: `Subject: [${conversation.subject}](https://mod.reddit.com/mail/all/${conversation.id})`,
                        fields: [
                            {
                                name: `Conversation Type`,
                                value: parseConversationType(conversation.conversationType),
                            },
                            {
                                name: `Author`,
                                value: parseParticipantAuthor(message.author)
                            },
                            {
                                name: `Content`,
                                value: message.bodyMarkdown
                            },
                            {
                                name: 'Participants',
                                value: conversation.authors.map(author =>
                                    `- ${parseParticipantAuthor(author)}`
                                ).join('\n')
                            }

                        ]
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
    },
};

export default LogModmailMessage;