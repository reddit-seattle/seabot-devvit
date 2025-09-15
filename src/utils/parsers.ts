import { Comment, Participant, Post } from "@devvit/public-api";
import { createUserLink } from "./reddithelpers.js";

export const parseParticipantAuthor = (author: Participant | undefined) => {
    let output = "";
    if (author?.isMod) {
        output += `[MOD] `;
    } else if (author?.isAdmin) {
        output += `[ADMIN] `;
    }
    output += createUserLink(author?.name || "unknown");
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

export const getItemDateString: (
    submission: Post | Comment
) => string | undefined = (submission) => {
    if (!submission) return undefined;
    const { createdAt } = submission;
    return createdAt
        ? `<t:${Math.floor(createdAt.getTime() / 1000)}:R>`
        : undefined;
};
