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
    if (!submission?.createdAt) return undefined;
    
    try {
        // Handle Date objects separately to preserve NaN behavior
        if (submission.createdAt instanceof Date) {
            const timestamp = submission.createdAt.getTime();
            return `<t:${Math.floor(timestamp / 1000)}:R>`;
        }
        
        // For strings/numbers, try to create a valid Date
        const date = new Date(submission.createdAt);
        const timestamp = date.getTime();
        
        // Only throw if we got an invalid date from a string/number
        if (isNaN(timestamp)) {
            throw new Error(`Invalid date: ${submission.createdAt}`);
        }
        
        return `<t:${Math.floor(timestamp / 1000)}:R>`;
    } catch (error) {
        console.error('Failed to parse date:', error);
        return undefined;
    }
};
