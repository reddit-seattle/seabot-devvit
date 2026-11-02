# Seabot (devvit edition)

This is a bot used to help our moderators perform tasks and manage the queue more efficiently.

It's relatively configurable (more to come), but is currently heavily tailored for r/Seattle and provides the following functionality:

## Features

### Discord Notifications
Provides the ability to notify discord webhooks with embeds for:
- New post reports
- New comment reports
- New modmail messages

### Quick Removal Actions
- Configurable quick-removal menu items using subreddit removal reason title matching
- Automatically fetches and applies subreddit removal reasons

### `Market Traffic Only` Flaired user restrictions
- Provides a quick button to add a custom post flair to chosen posts
- Stickies a custom comment when those posts are flaired
- See [Restricted Flair Setup](./docs/RestrictedFlairSetup.md) for more detail

### Bulk Actions
- Comment nuke - Remove all comments in a single thread

### Commenter Review
- Reports new r/Seattle comments when the author's sampled posts/comments include at least two distinct communities among r/PCOS, r/Testosterone, and r/Nashville. The report lists matches for manual account review.
- Enabled by default; disable **Report commenters active in 2 of PCOS, Testosterone, Nashville** (`botTriageReportsEnabled`) in installation settings to stop it.
- Checks up to 100 posts/comments at or before the triggering comment. The pinned SDK drops the requested sort, so the sample may not be the newest 100 or complete.
- Skips deleted authors, service accounts, and removed, spam, approved, or ignored-report comments. Matching comments are re-fetched before reporting to check current status.
- One atomic seven-day report claim per author prevents concurrent duplicates. A failed report retains its claim because Reddit may have accepted it; history failures can retry on the next comment. Redis stores only these expiring claims, with no history or per-comment records.

## Configuration

### Removal Menu Items
Edit [`src/settings.ts`](./src/settings.ts) and update the `REMOVAL_MENU_CONFIGS` constant to add or modify quick removal options.

### Discord Webhooks
Configure webhook URLs through the app settings in Reddit.

### Restricted Flair
See [Restricted Flair Setup](./docs/RestrictedFlairSetup.md) for complete setup instructions including sample AutoModerator configuration.

## Development

App creation and devvit notes coming soon, for now please [read Reddit's documentation](https://developers.reddit.com/docs/introduction/intro-mod-tools)
