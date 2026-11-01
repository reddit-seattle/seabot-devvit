# Threaded moderation log

Create a moderator-only Discord **forum channel**, turn off **Require tags**, and
copy its webhook from **Integrations → Webhooks**. In Seabot's installation settings,
paste the bare URL into **moderation log forum webhook URL**. Leave it blank to
disable. An ordinary text-channel webhook cannot create these forum threads.

Optionally enter comma-separated **moderation log actions to ignore**, such as
`approvelink, approvecomment`. Blank logs all received action types.

Post and comment actions share the parent post's thread; account actions share a
user thread; other actions use a daily UTC thread. Embeds show moderator, action,
target link, time and action ID. Reasons are included only when the ID matches one
of the latest 100 modlog entries. Unavailable or redacted targets still get logged.

Delivery follows the existing report/modmail handlers: send directly through the
shared webhook helper and log failures. There is no queue, scheduler, background
retry or historical backfill. Rate limits, network failures and prolonged lock
contention can lose a notification. Each thread's sends are serialized, waiting
up to ten seconds for a busy sender. Successful action IDs suppress duplicates for
seven days; thread mappings expire after 90 inactive days. Redis stores IDs and
short-lived locks, not content or webhook credentials. Actions without IDs cannot
be deduplicated; a lost response/state write can still produce a duplicate.

Discord reopens archived threads automatically. A confirmed deleted thread is
recreated once; locked threads require moderator intervention. A new webhook ID
starts fresh mappings; rotating only its token preserves existing threads.

Before rollout, playtest post/comment grouping, ban/unban grouping, archived and
deleted threads, and disabling the webhook in a test subreddit/forum. Automated
tests use synthetic events and mocked HTTP; production has not been configured.
