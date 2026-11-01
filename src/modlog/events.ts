import type { ModActionDefinition, TriggerContext } from "@devvit/public-api";

type ModActionEvent = Parameters<ModActionDefinition["onEvent"]>[0];

// Queue only action metadata, never copies of post/comment bodies or webhook tokens.
export interface LogEntry {
  id: string;
  action: string;
  at: string;
  subreddit: string;
  moderator: string;
  postId?: string;
  commentId?: string;
  userId?: string;
  userName?: string;
}

export const plainText = (value: string, limit: number): string =>
  value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/@/g, "＠")
    .slice(0, limit);

const markdown = (value: string, limit: number): string =>
  plainText(value, limit)
    .replace(/[\\`*_{}\[\]()<>|~]/g, "\\$&")
    .slice(0, limit);

function fullname(
  value: string | undefined,
  prefix: string,
): string | undefined {
  const id = value?.replace(new RegExp(`^${prefix}_`), "");
  return id && /^[a-z0-9]+$/i.test(id) ? `${prefix}_${id}` : undefined;
}

export async function normalizeAction(
  event: ModActionEvent,
  context: TriggerContext,
): Promise<LogEntry> {
  const commentId = fullname(event.targetComment?.id, "t1");
  let postId = fullname(
    event.targetComment?.postId || event.targetPost?.id,
    "t3",
  );
  if (commentId && !postId) {
    postId = fullname(
      event.targetComment?.permalink?.match(/\/comments\/([a-z0-9]+)\//i)?.[1],
      "t3",
    );
    if (!postId) {
      try {
        postId = fullname(
          (await context.reddit.getCommentById(commentId)).postId,
          "t3",
        );
      } catch {
        // A redacted/deleted target still deserves an action log entry.
      }
    }
  }
  const action = event.action || "unknown";
  const suppliedDate = event.actionedAt && new Date(event.actionedAt);
  const hasDate = suppliedDate && Number.isFinite(suppliedDate.getTime());
  const at = hasDate ? suppliedDate.toISOString() : new Date().toISOString();
  const userId = fullname(event.targetUser?.id, "t2");
  const userName = event.targetUser?.name || undefined;
  // IDs are preferred. Without an ID or timestamp, don't collapse distinct actions.
  const id =
    event.id?.replace(/^ModAction_/, "") ||
    JSON.stringify([
      action,
      at,
      event.moderator?.id || event.moderator?.name,
      commentId || postId || userId || userName,
      hasDate ? "" : Math.random().toString(36).slice(2),
    ]);
  return {
    id,
    action,
    at,
    subreddit: event.subreddit?.name || context.subredditName || "unknown",
    moderator: event.moderator?.name || "Unavailable / masked",
    postId,
    commentId,
    userId,
    userName,
  };
}

export function groupFor(entry: LogEntry): string {
  if (entry.postId) return `post:${entry.postId}`;
  if (entry.commentId) return `comment:${entry.commentId}`;
  if (entry.userId || entry.userName)
    return `user:${entry.userId || entry.userName!.toLowerCase()}`;
  return `community:${entry.at.slice(0, 10)}`;
}

export async function loadActionDetails(
  subreddit: string,
  context: TriggerContext,
): Promise<Map<string, string>> {
  try {
    const logs = await context.reddit
      .getModerationLog({ subredditName: subreddit, limit: 100 })
      .all();
    return new Map(
      logs.map((log) => [
        log.id.replace(/^ModAction_/, ""),
        [log.description, log.details].filter(Boolean).join("\n"),
      ]),
    );
  } catch {
    // Optional enrichment must not block delivery of the original action.
    return new Map();
  }
}

export async function formatAction(
  entry: LogEntry,
  context: TriggerContext,
  details?: string,
  needsThreadTitle = true,
) {
  const subredditUrl = `https://www.reddit.com/r/${encodeURIComponent(entry.subreddit)}`;
  let targetUrl = `${subredditUrl}/about/log/`;
  let target = "Community settings / unavailable target";
  let threadName = `r/${entry.subreddit} — ${entry.at.slice(0, 10)} UTC`;
  if (entry.postId) {
    const postId = entry.postId.slice(3);
    targetUrl = `${subredditUrl}/comments/${postId}/`;
    target = entry.commentId || entry.postId;
    if (entry.commentId) targetUrl += `comment/${entry.commentId.slice(3)}/`;
    threadName = `Post ${postId} — r/${entry.subreddit}`;
    try {
      const post = needsThreadTitle
        ? await context.reddit.getPostById(entry.postId)
        : undefined;
      if (post?.title) threadName = `${postId} — ${post.title}`;
    } catch {
      // Deleted or inaccessible posts keep their stable ID-based title/link.
    }
  } else if (entry.commentId) {
    target = `${entry.commentId} (parent post unavailable)`;
    threadName = `Comment ${entry.commentId.slice(3)} — r/${entry.subreddit}`;
  } else if (entry.userId || entry.userName) {
    target = entry.userName ? `u/${entry.userName}` : entry.userId!;
    threadName = `${target} — moderation`;
    if (entry.userName)
      targetUrl = `https://www.reddit.com/user/${encodeURIComponent(entry.userName)}/`;
  }
  const fields = [
    { name: "Moderator", value: markdown(entry.moderator, 256), inline: true },
    { name: "Action", value: markdown(entry.action, 256), inline: true },
    { name: "Target", value: `[${markdown(target, 256)}](${targetUrl})` },
  ];
  // Trigger payloads don't contain reasons. The worker supplies only ID-matched details.
  if (details)
    fields.push({ name: "Details / reason", value: markdown(details, 1024) });
  return {
    threadName: plainText(threadName, 100),
    payload: {
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: plainText(`r/${entry.subreddit}: ${entry.action}`, 256),
          url: targetUrl,
          color: 0x7289da,
          timestamp: entry.at,
          fields,
          footer: { text: plainText(`Mod action ${entry.id}`, 512) },
        },
      ],
    },
  };
}
