import { Devvit, SettingScope, Post, Comment, PostReport, CommentReport, TriggerEvent, Participant } from '@devvit/public-api';
// import { Client  } from 'discord.js';
// import { config } from 'dotenv';

// config();
// import { PostReport, CommentReport } from '@devvit/protos'

Devvit.configure({ redditAPI: true, modLog: true, http: true });

/**
 * Modmail trigger
 */
Devvit.addTrigger({
  event: 'ModMail',
  onEvent: async (event, context) => {
    console.log(`Received modmail trigger event:\n${JSON.stringify(event)}`);
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
            description: `
            Subject: [${conversation.subject}](https://mod.reddit.com/mail/all/${conversation.id})

            `,
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
      const discordWebhookUrl = `${await context.settings.get('discordWebhook')}`;
      const response = await fetch(
        discordWebhookUrl,
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
});

/**
 * Post report trigger
 */
Devvit.addTrigger({
  event: 'PostReport',
  onEvent: async (evt, ctx) => {
    console.log(JSON.stringify(evt))
    const { reason, subreddit, post } = evt;
    const title = `New post reported`;
    console.log(title);
    const submission = await ctx.reddit.getPostById(post?.id ?? '');
    const {modReportReasons, userReportReasons, title: postTitle, score,  authorName, permalink} = submission;
    let truncatedTitle = postTitle.length > 100 ? `${postTitle.slice(0,97)}...` : postTitle;
    let desc = `
    ${truncatedTitle}
    Report: ${reason}
    `;

    console.log(desc)

    const fields: Array<{ name: string, value: string }> = [];
    fields.push(
        {
          name: 'Details:',
          value: `
          Permalink: [${permalink}](https://reddit.com${permalink})
          Author: [${authorName}](https://reddit.com/u/${authorName})
          Score: **${score}** [${post?.upvotes} up | ${post?.downvotes} down]
          Comments: ${submission.numberOfComments}
          Total Reports: ${post?.numReports || 0}
          `
        },
    );
    // mod reports
    const modReports = modReportReasons.length
      ? modReportReasons.map(str => `- ${str}`).join('\n')
      : undefined;

    const userReports = userReportReasons.length
      ? modReportReasons.map(str => `- ${str}`).join('\n')
      : undefined;


    if (modReports) {
      fields.push({
        name: 'ModReports',
        value: modReports
      });
    }
    if (userReports) {
      fields.push({
        name: 'UserReports',
        value: userReports
      });
    }
    // post to discord webhook url
    const discordWebhookUrl = `${await ctx.settings.get('discordWebhook')}`;

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
      discordWebhookUrl,
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

});
Devvit.addTrigger({
  event: 'CommentReport',
  onEvent: async (evt, ctx) => {
    console.log(JSON.stringify(evt))
    const { reason, subreddit, comment } = evt;
    const title = `New comment reported`;
    console.log(title);
    const submission = await ctx.reddit.getCommentById(comment?.id ?? '');
    const {modReportReasons, userReportReasons, body, score,  authorName, permalink} = submission;
    let desc = `Report: ${reason}`;
    console.log(desc)

    const fields: Array<{ name: string, value: string }> = [];
    fields.push(
        {
          name: 'Details:',
          value: `
          Comment: ||${comment?.body}||
          Permalink: [${permalink}](https://reddit.com${permalink})
          Author: [${authorName}](https://reddit.com/u/${authorName})
          Score: **${score}** [${comment?.upvotes} up | ${comment?.downvotes} down]
          Replies: ${submission.replies}
          Total Reports: ${submission?.numReports || 0}
          Crowd Control: ${submission?.collapsedBecauseCrowdControl}
          `
        },
    )
    // mod reports
    const modReports = modReportReasons.length
      ? modReportReasons.map(str => `- ${str}`).join('\n')
      : undefined;

    const userReports = userReportReasons.length
      ? modReportReasons.map(str => `- ${str}`).join('\n')
      : undefined;


    if (modReports) {
      fields.push({
        name: 'ModReports',
        value: modReports
      });
    }
    if (userReports) {
      fields.push({
        name: 'UserReports',
        value: userReports
      });
    }
    // post to discord webhook url
    const discordWebhookUrl = `${await ctx.settings.get('discordWebhook')}`;

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
      discordWebhookUrl,
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

});

Devvit.addSettings([
  {
    type: 'string',
    name: 'discordWebhook',
    label: 'enter your discord webhook url',
    scope: SettingScope.Installation,
    onValidate: async ({ value }) => {
      if (!value /* check for url or some shit eventually */) {
        return 'that link looks weird';
      }
    },
  },
]);


const parseConversationType = (type: string | undefined) => {
  switch(type) {
    case 'internal': return 'Mod Discussion';
    case 'sr_user': return 'User Modmail';
    case 'sr_sr': return 'Subreddit Modmail';
    default: return 'Unknown';
  }
}

const parseParticipantAuthor = (author: Participant | undefined) => {
  let output = '';
  if(author?.isMod){
    output+=`[MOD] `;
  }
  else if(author?.isAdmin){
    output+=`[ADMIN] `;
  }
  output+=`[${author?.name}](https://reddit.com/u/${author?.name})`
  if(author?.isOp){
    output+=' [OP]'
  }
  return output;
}

export default Devvit;
