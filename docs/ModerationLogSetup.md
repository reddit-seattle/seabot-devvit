# Threaded moderation log

Seabot can forward received Reddit `ModAction` events to a Discord forum channel.
Configure its webhook in the Reddit app settings, just like the existing report
and modmail destinations. A blank setting disables the feature.

## Setup

1. Create a Discord **forum channel** visible to your moderator team. Forum threads
   inherit the parent channel's visibility. An ordinary text-channel webhook does
   not support this thread-creation workflow.
2. In that channel's **Integrations → Webhooks**, create a webhook and copy its URL.
   Leave the forum's **Require tags** option off; Seabot does not assign forum tags.
3. After installing/upgrading Seabot, open its installation settings at
   `https://developers.reddit.com/r/YOUR_SUBREDDIT/apps/seattle-bot`.
4. Paste the URL into **moderation log forum webhook URL**. Use the bare webhook URL,
   without `thread_id` or other query parameters. Do not commit this credential.
5. Optionally set **moderation log actions to ignore** to comma-separated Reddit
   action names, such as `approvelink, approvecomment`. Matching is case-insensitive.
   Blank forwards all received moderation action types, including automated ones.

The existing post-report, comment-report, and modmail webhooks retain their existing
behavior. This feature needs no additional Discord bot token or external server.

## What appears in Discord

- Actions on a post and any of its comments share one thread, named after the post.
- User actions such as bans and unbans share a thread keyed by Reddit user ID, with
  a case-insensitive username fallback when the ID is unavailable.
- Community actions without a content/user target share a daily UTC thread.
- A comment whose parent post cannot be resolved gets a comment-specific thread.
- Each embed contains the action, moderator when available, target link, event time,
  and action ID. The sender disables mentions and limits/escapes displayed text.
- Description/reason fields are added only when the action ID matches a record in
  the latest 100 moderation-log entries, fetched once per delivery batch. Reasons
  may be unavailable for delayed events. Post/comment bodies are not copied.

Reddit can redact target data and moderator identities, and does not guarantee
event ordering. This logs events received after configuration; it does not backfill
history or promise a complete archival copy of Reddit's moderation log.

## Delivery and storage

Install/upgrade registers one recurring delivery job. It checks the Redis queue
once per minute, processing at most 30 actions per run and starting deliveries only
within a 20-second batch budget. A leased worker lock serializes delivery and
thread creation. Latency is usually about a minute, and can grow during bursts.

Discord rate limits are respected across the queue. Network/server failures back
off from one minute to 15 minutes; configuration/permission errors wait 15 minutes.
Failed entries are retained for up to 24 hours. The app logs safe status/code
diagnostics without webhook credentials. Clearing the setting discards queued
entries when the worker runs; changing webhook IDs discards the old destination's
pending entries and starts fresh thread mappings. Rotating only the token preserves
mappings. Action filters apply at receipt, not retroactively to queued entries.

Successful action IDs are retained for seven days to suppress duplicate trigger
deliveries. Thread mappings expire after 90 days without a successful send. A later
action then starts a new thread. Discord automatically reopens archived threads
on delivery; locked threads require moderator intervention. A confirmed deleted
thread is replaced on retry. Missing-webhook and permission errors do not discard
thread mappings.

Redis stores pending action metadata (up to 24 hours), action IDs, thread IDs and
short-lived worker/cooldown state. It does not store webhook tokens, post/comment
bodies, titles or fetched removal reasons. Titles and reasons are fetched at send
time and displayed in the moderator Discord channel.

Delivery is best effort, with retries: a timeout after Discord accepted a message,
or a crash before Redis records success, can produce a duplicate message or initial
thread on retry. Discord webhook execution and Redis cannot commit atomically.
Events missing both an ID and timestamp cannot be reliably deduplicated.

## Validation before rollout

Offline tests cover grouping, duplicate events, concurrent workers, rate limits,
server errors, deleted/locked threads, webhook changes, disabled destinations,
expiry, masked targets, formatting and credential-safe errors.

In a test subreddit and a moderator-only test forum, verify:

1. Remove then approve a post and remove a comment on it: one thread, three entries.
2. Ban then unban a test user: both actions share a user thread.
3. Archive the post thread and action the post again: the existing thread reopens.
4. Delete the thread and action it again: a replacement appears after retry.
5. Disable the webhook and confirm no new logs arrive.

Live playtesting and production configuration are separate from the PR; the test
suite uses synthetic events and mocked HTTP and does not post to Discord.

## References

- [Reddit moderation trigger payloads](https://developers.reddit.com/docs/capabilities/server/trigger-events#onmodaction)
- [Discord webhook thread creation/delivery](https://docs.discord.com/developers/resources/webhook#execute-webhook)
- [Discord forum thread behavior](https://docs.discord.com/developers/topics/threads#creating-threads-in-forum-and-media-channels)

The implementation uses Seabot's existing installation-setting and embed patterns;
no source code from third-party logging apps is copied.
