import type { ModActionDefinition, TriggerContext } from "@devvit/public-api";

const text = (value: string, limit: number) =>
  value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/@/g, "＠")
    .slice(0, limit);
const markdown = (value: string) =>
  text(value, 1024)
    .replace(/[\\`*_{}\[\]()<>|~]/g, "\\$&")
    .slice(0, 1024);

export async function formatModAction(
  event: Parameters<ModActionDefinition["onEvent"]>[0],
  context: TriggerContext,
) {
  const subreddit = event.subreddit?.name || context.subredditName || "unknown";
  const action = event.action || "unknown";
  const actionId = event.id?.replace(/^ModAction_/, "");
  const timestamp = (event.actionedAt || new Date()).toISOString();
  const comment = event.targetComment;
  const user = event.targetUser;
  let postId = comment?.postId || event.targetPost?.id;
  if (comment?.id && !postId) {
    try {
      postId = (await context.reddit.getCommentById(comment.id)).postId;
    } catch {
      /* Redacted/deleted target. */
    }
  }
  const group =
    postId ||
    comment?.id ||
    (user?.id || user?.name
      ? `user:${user.id || user.name.toLowerCase()}`
      : `community:${timestamp.slice(0, 10)}`);
  const subredditUrl = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}`;
  let targetUrl = `${subredditUrl}/about/log/`;
  let target = "Community / unavailable target";
  let threadName = `r/${subreddit} — ${timestamp.slice(0, 10)} UTC`;
  if (postId) {
    target = comment?.id || postId;
    targetUrl = `${subredditUrl}/comments/${postId.replace(/^t3_/, "")}/`;
    if (comment?.id) targetUrl += `comment/${comment.id.replace(/^t1_/, "")}/`;
    let title = event.targetPost?.title;
    if (!title) {
      try {
        title = (await context.reddit.getPostById(postId)).title;
      } catch {
        /* Keep the ID-based title. */
      }
    }
    threadName = `${postId.replace(/^t3_/, "")} — ${title || `r/${subreddit}`}`;
  } else if (comment?.id) {
    target = comment.id;
    threadName = `Comment ${comment.id} — r/${subreddit}`;
  } else if (user?.id || user?.name) {
    target = user.name ? `u/${user.name}` : user.id;
    threadName = `${target} — moderation`;
    if (user.name)
      targetUrl = `https://www.reddit.com/user/${encodeURIComponent(user.name)}/`;
  }
  const fields = [
    {
      name: "Moderator",
      value: markdown(event.moderator?.name || "Unavailable / masked"),
    },
    { name: "Action", value: markdown(action) },
    { name: "Target", value: `[${markdown(target)}](${targetUrl})` },
  ];
  // Reasons are absent from the trigger payload. Never guess a match by user/time.
  if (actionId) {
    try {
      const logs = await context.reddit
        .getModerationLog({ subredditName: subreddit, limit: 100 })
        .all();
      const match = logs.find(
        (log) => log.id.replace(/^ModAction_/, "") === actionId,
      );
      const details = [match?.description, match?.details]
        .filter(Boolean)
        .join("\n");
      if (details)
        fields.push({ name: "Details / reason", value: markdown(details) });
    } catch {
      /* Optional enrichment must not prevent delivery. */
    }
  }
  return {
    group,
    actionId,
    threadName: text(threadName, 100),
    payload: {
      allowed_mentions: { parse: [] as string[] },
      embeds: [
        {
          title: text(`r/${subreddit}: ${action}`, 256),
          url: targetUrl,
          timestamp,
          fields,
          color: 0x7289da,
          footer: {
            text: text(`Mod action ${actionId || "ID unavailable"}`, 512),
          },
        },
      ],
    },
  };
}
