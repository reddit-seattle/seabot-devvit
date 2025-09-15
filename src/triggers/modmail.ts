import { ModMailDefinition } from "@devvit/public-api";
import { MODMAIL_REPORT_WEBHOOK } from "../settings.js";
import { parseConversationType, parseParticipantAuthor } from "../utils/parsers.js";
import { SendContentToWebhook } from "../utils/webhooks.js";

const LogModmailMessage: ModMailDefinition = {
  event: "ModMail",
  onEvent: async (event, context) => {
    try {
      const discordWebhookUrl = (await context.settings.get(
        MODMAIL_REPORT_WEBHOOK
      )) as string;
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

        // Example Message ID: ModmailMessage_2ch154
        const messageId = event.messageId.split("_")[1];
        const message = conversation.messages[messageId];
        const payload = {
          embeds: [
            // https://discord.com/developers/docs/resources/channel#embed-object
            {
              title: `New modmail message from ${message.author?.name}`,
              type: "rich",
              description: `Subject: [${conversation.subject}](https://mod.reddit.com/mail/all/${conversation.id})`,
              fields: [
                {
                  name: `Conversation Type`,
                  value: parseConversationType(conversation.conversationType),
                },
                {
                  name: `Author`,
                  value: parseParticipantAuthor(message.author),
                },
                {
                  name: `Content`,
                  value: message.bodyMarkdown,
                },
                {
                  name: "Participants",
                  value: conversation.authors
                    .map((author) => `- ${parseParticipantAuthor(author)}`)
                    .join("\n"),
                },
              ],
            },
          ],
        };
        await SendContentToWebhook(discordWebhookUrl, payload);
      }
    } catch (error) {
      console.error("Error in modmail handler:", error);
    }
  },
};

export default LogModmailMessage;
