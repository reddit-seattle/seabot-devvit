import {
  Comment,
  OnValidateHandler,
  Participant,
  Post,
} from "@devvit/public-api";

export const parseParticipantAuthor = (author: Participant | undefined) => {
  let output = "";
  if (author?.isMod) {
    output += `[MOD] `;
  } else if (author?.isAdmin) {
    output += `[ADMIN] `;
  }
  output += `[${author?.name}](https://reddit.com/u/${author?.name})`;
  if (author?.isOp) {
    output = `**${output}**`;
  }
  return output;
};

export const parseConversationType = (type: string | undefined) => {
  switch (type) {
    case "internal":
      return "Mod Discussion";
    case "sr_user":
      return "User Modmail";
    case "sr_sr":
      return "Subreddit Modmail";
    default:
      return "Unknown";
  }
};

/**
 * TODO
 * @param param0 idk
 * @returns a string if the value's untruthyish
 */
export const validateURL: OnValidateHandler<string> = async ({ value }) => {
  if (!value) {
    return "that link looks weird";
  }
};

export const getItemDateString: (
  submission: Post | Comment
) => string | undefined = (submission) => {
  const { createdAt } = submission;
  return createdAt
    ? `<t:${Math.floor(createdAt.getTime() / 1000)}:R>`
    : undefined;
};

export const SendContentToWebhook = async (
  webhookURL: string,
  payload: { content?: string; embeds: { [id: string]: any }[] }
) => {
  // https://discord.com/developers/docs/resources/webhook#execute-webhook-jsonform-params
  await fetch(webhookURL, {
    method: "post",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};
