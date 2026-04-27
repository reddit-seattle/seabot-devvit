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

### Weekly What's Happening Thread
- Configurable weekly sticky thread with subreddit-level controls
- Generated sections for weather, WSDOT alerts, citywide events, sports
- Weekly dedupe protection so duplicate scheduler runs do not create duplicate threads

## Configuration

### Removal Menu Items
Edit [`src/settings.ts`](./src/settings.ts) and update the `REMOVAL_MENU_CONFIGS` constant to add or modify quick removal options.

### Discord Webhooks
Configure webhook URLs through the app settings in Reddit.

### Weekly Thread
Configure these through the app settings in Reddit:
- Enable or disable the weekly thread job
- Customize the thread title
- Customize the thread header and footer
- Other settings for API keys / config added as necessary

### Restricted Flair
See [Restricted Flair Setup](./docs/RestrictedFlairSetup.md) for complete setup instructions including sample AutoModerator configuration.

## Development

App creation and devvit notes coming soon, for now please [read Reddit's documentation](https://developers.reddit.com/docs/introduction/intro-mod-tools)
