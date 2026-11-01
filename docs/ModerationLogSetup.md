# Threaded moderation log

Create a moderator-only Discord **forum channel**, turn off **Require tags**, and
copy its webhook from **Integrations → Webhooks**. In Seabot's installation settings,
paste the bare URL into **moderation log forum webhook URL**. Leave it blank to
disable. An ordinary text-channel webhook cannot create these forum threads.

Optionally enter comma-separated **moderation log actions to ignore**, such as
`approvelink, approvecomment, banuser`. Blank logs all supported post-related actions.

Post and comment actions share the parent post's thread. The opening message
starts with a post summary above the first action: title, author/profile link,
posting time, flair and removal/lock/NSFW/spoiler flags when available, plus links
to the post, newest comments, Old Reddit and the subreddit mod log. This is a
snapshot at thread creation, not a live status display. Later messages contain
only the new action. If post metadata cannot be fetched, the summary retains the
post ID, any event-provided title and navigation links.

Action embeds show moderator, action, target link, time and action ID. Reasons are
included only when the ID matches one of the latest 100 modlog entries. Comments
whose parent post cannot be resolved are skipped. Account-only actions and
community changes do not create user or daily threads.

Bans are attached using the original automatic ban notification in modmail,
not the separate `banuser` moderation event (which lacks the ban message). The
notice must have Reddit's standard English ban subject, identify a recipient and
link to exactly one post in this subreddit. Post/comment permalinks on Reddit and
`redd.it` post links are supported; share redirects (`/s/...`) are not resolved.
The linked post's subreddit is verified through Reddit. Unlinked or ambiguous
notices, unavailable posts, appeals and later replies are skipped. Multiple links
to the same post still count as one post. The entry shows the banned user, notice
time, related post and a modmail link; the full ban message remains in the existing
modmail channel. This works even if that channel's webhook is unset and never marks
modmail read. Add `banuser` to the ignore list to disable these entries.

Delivery follows the existing report/modmail handlers: send directly through the
shared webhook helper and log failures. There is no queue, scheduler, background
retry or historical backfill. Rate limits, network failures and prolonged lock
contention can lose a notification. Each thread's sends are serialized, waiting
up to ten seconds for a busy sender. Successful action IDs suppress duplicates for
seven days (ban entries use the modmail message ID); thread mappings expire after
90 inactive days. Redis stores IDs and short-lived locks, not content or webhook
credentials. Actions without IDs cannot
be deduplicated; a lost response/state write can still produce a duplicate.

Discord reopens archived threads automatically. A confirmed deleted thread is
recreated once; locked threads require moderator intervention. A new webhook ID
starts fresh mappings; rotating only its token preserves existing threads.

Before rollout, playtest summary-first post/comment grouping, actual permanent
and temporary ban notices linking to posts/comments, archived and deleted threads,
and disabling the webhook in a test subreddit/forum. Automated tests use synthetic
events and mocked HTTP; production has not been configured.
