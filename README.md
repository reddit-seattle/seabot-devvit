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

## Configuration

### Removal Menu Items
Edit [`src/menuItems/removalMenuConfig.ts`](./src/menuItems/removalMenuConfig.ts) to add or modify quick removal options.

### Discord Webhooks
Configure webhook URLs through the app settings in Reddit.

### Restricted Flair
See [Restricted Flair Setup](./docs/RestrictedFlairSetup.md) for complete setup instructions including sample AutoModerator configuration.

## Development

App creation and devvit notes coming soon, for now please [read Reddit's documentation](https://developers.reddit.com/docs/introduction/intro-mod-tools)
