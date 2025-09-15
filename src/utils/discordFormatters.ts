import {
    EMOJI_UPVOTE,
    EMOJI_DOWNVOTE
} from "../settings.js";
import { createUserLink } from "./reddithelpers.js";
import { getItemDateString } from "./parsers.js";
import { Comment, Post, User } from "@devvit/public-api";

export interface UserInfo {
    authorName?: string;
    authorId?: string;
    linkKarma?: number;
    commentKarma?: number;
    createdAt?: Date;
}

export interface ScoreInfo {
    score: number;
    upvotes?: number;
    downvotes?: number;
    numReports?: number;
    collapsedBecauseCrowdControl?: boolean;
}

export interface PostInfo {
    title: string;
    permalink: string;
    numberOfComments?: number;
}

export interface CommentInfo {
    body?: string;
    maxLength?: number;
}

/**
 * Creates a Discord timestamp string for user creation date
 */
function getUserDateString(user: UserInfo): string | undefined {
    if (!user.createdAt) return undefined;
    return `<t:${Math.floor(user.createdAt.getTime() / 1000)}:R>`;
}

/**
 * Creates a formatted user info section (simplified, no emojis)
 */
export function formatUserInfo(userInfo: UserInfo, submission?: Post | Comment): string[] {
    const lines: string[] = [
        createUserLink(userInfo.authorName || 'unknown'),
    ];

    if (submission) {
        const dateString = getItemDateString(submission);
        if (dateString) {
            lines.push(`Created: ${dateString}`);
        }
    } else if (userInfo.createdAt) {
        // Use user creation date if no submission provided
        const userDateString = getUserDateString(userInfo);
        if (userDateString) {
            lines.push(`Account created: ${userDateString}`);
        }
    }

    // Add karma information if available
    if (userInfo.linkKarma !== undefined || userInfo.commentKarma !== undefined) {
        const linkKarma = userInfo.linkKarma || 0;
        const commentKarma = userInfo.commentKarma || 0;
        lines.push(`Karma: **${linkKarma}** link, **${commentKarma}** comment`);
    }

    return lines;
}

/**
 * Creates a formatted score/statistics section (no emoji prefixes except for votes)
 */
export function formatScoreInfo(scoreInfo: ScoreInfo, includeComments?: number): string[] {
    const lines: string[] = [
        `${scoreInfo.upvotes || 0} ${EMOJI_UPVOTE} ${scoreInfo.downvotes || 0} ${EMOJI_DOWNVOTE} [**${scoreInfo.score}**]`,
    ];

    if (includeComments !== undefined) {
        lines.push(`Comments: **${includeComments}**`);
    }

    lines.push(`Total Reports: **${scoreInfo.numReports || 0}**`);

    if (scoreInfo.collapsedBecauseCrowdControl) {
        lines.push(`Crowd Control: **Yes**`);
    }

    return lines;
}

/**
 * Creates a formatted comment content section with code blocks
 */
export function formatCommentContent(commentInfo: CommentInfo): string {
    if (!commentInfo.body) {
        return '';
    }

    const maxLength = commentInfo.maxLength || 500;
    const commentBody = commentInfo.body.length > maxLength
        ? `${commentInfo.body.slice(0, maxLength - 3)}...`
        : commentInfo.body;

    return `\`\`\`\n${commentBody}\n\`\`\``;
}

/**
 * Creates formatted report reason lists
 */
export function formatReportReasons(reasons: string[], emoji: string): string {
    return reasons.map((str) => `${emoji} ${str}`).join("\n");
}

/**
 * Creates a Discord field object
 */
export function createDiscordField(name: string, value: string | string[]): { name: string; value: string } {
    return {
        name,
        value: Array.isArray(value) ? value.join("\n") : value,
    };
}

/**
 * Creates a Discord embed footer with timestamp
 */
export function createEmbedFooter(): { footer: { text: string }; timestamp: string } {
    const now = new Date();
    return {
        footer: {
            text: now.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            })
        },
        timestamp: now.toISOString()
    };
}
