import { User } from "@devvit/public-api";
import { EMOJI_DOWNVOTE, EMOJI_UPVOTE } from "../settings.js";
import { getItemDateString } from "./parsers.js";
import { createUserLink } from "./reddithelpers.js";

// Interface for comment content formatting
export interface CommentInfo {
  body?: string;
}

/**
 * Creates a Discord timestamp string for user creation date
 */
function getUserDateString(user: User): string | undefined {
  if (!user.createdAt) return undefined;
  return `<t:${Math.floor(user.createdAt.getTime() / 1000)}:R>`;
}

/**
 * Creates a formatted user info section
 */
export function formatUserInfo(user: User): string[] {
  const lines: string[] = [createUserLink(user.username || "unknown")];

  // Add user account creation date if available
  if (user.createdAt) {
    const userDateString = getUserDateString(user);
    if (userDateString) {
      lines.push(`Account Created: ${userDateString}`);
    }
  }

  // Add karma information if available
  if (user.linkKarma !== undefined || user.commentKarma !== undefined) {
    const linkKarma = user.linkKarma || 0;
    const commentKarma = user.commentKarma || 0;
    lines.push(`Karma: **${linkKarma}** link, **${commentKarma}** comment`);
  }

  return lines;
}

/**
 * Creates a formatted score/statistics section
 */
export function formatScoreInfo(submission: any): string[] {
  const lines: string[] = [];

  // Show detailed vote information if available, otherwise just show the score
  const score = submission.score ?? 0;
  if (submission.upvotes !== undefined && submission.downvotes !== undefined) {
    lines.push(
      `${submission.upvotes} ${EMOJI_UPVOTE} ${submission.downvotes} ${EMOJI_DOWNVOTE} [**${score}**]`,
    );
  } else {
    lines.push(`Score: **${score}**`);
  }

  // Add creation date
  const dateString = getItemDateString(submission);
  if (dateString) {
    lines.push(`Created: ${dateString}`);
  }

  // Add comment count if it's a post
  if (
    "numberOfComments" in submission &&
    submission.numberOfComments !== undefined
  ) {
    lines.push(`Comments: **${submission.numberOfComments}**`);
  }

  // Get report count (property name differs between posts and comments)
  const reportCount =
    "numberOfReports" in submission
      ? submission.numberOfReports
      : submission.numReports;
  lines.push(`Total Reports: **${reportCount || 0}**`);

  if (
    "collapsedBecauseCrowdControl" in submission &&
    submission.collapsedBecauseCrowdControl
  ) {
    lines.push(`Crowd Control: **Yes**`);
  }

  return lines;
}

/**
 * Creates a formatted comment content section with code blocks
 */
export function formatCommentContent(
  comment: { body?: string },
  maxLength: number = 500,
): string {
  if (!comment.body) {
    return "";
  }

  const commentBody =
    comment.body.length > maxLength
      ? `${comment.body.slice(0, maxLength - 3)}...`
      : comment.body;

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
export function createDiscordField(
  name: string,
  value: string | string[],
): { name: string; value: string } {
  return {
    name,
    value: Array.isArray(value) ? value.join("\n") : value,
  };
}

/**
 * Creates a Discord embed footer with Seattle timezone timestamp
 */
export function createEmbedFooter(): { footer: { text: string } } {
  const now = new Date();
  // Convert to Seattle timezone (Pacific Time)
  const seattleTime = now.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return {
    footer: {
      text: `${seattleTime}`,
    },
  };
}

/**
 * Formats content for a deleted post webhook message
 */
export function formatDeletedPostContent(
  title: string,
  author: string,
  content?: string,
): string {
  const lines: string[] = [
    `**Author:** ${author}`,
    `**Title:** ${title}`,
  ];

  if (content) {
    const preview =
      content.length > 500 ? `${content.slice(0, 497)}...` : content;
    lines.push(`**Content Preview:**\n\`\`\`\n${preview}\n\`\`\``);
  }

  return lines.join("\n");
}

/**
 * Formats content for a deleted comment webhook message
 */
export function formatDeletedCommentContent(
  body: string,
  author: string,
  postTitle?: string,
): string {
  const lines: string[] = [
    `**Author:** ${author}`,
  ];

  if (postTitle) {
    lines.push(`**Post:** ${postTitle}`);
  }

  const preview = body.length > 500 ? `${body.slice(0, 497)}...` : body;
  lines.push(`**Comment:**\n\`\`\`\n${preview}\n\`\`\``);

  return lines.join("\n");
}
