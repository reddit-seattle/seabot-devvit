# Restricted Flair Setup

This document describes our 'Market Traffic Only' feature - a restricted mod-only post flair that removes comments on specific posts from users who have not equipped a user flair.

MTO and Market Bollards form a two-tier system, with Bollards as the stricter tier. Each mode's eligibility rules are defined and enforced separately in the subreddit's AutoModerator configuration.

## Overview

The bot provides two components for these modes:

1. **Post Menu Items**: Adds post-only menu items labeled `Require Flair for Comments` and `Raise Market Bollards` - which let mods apply the corresponding flair.
2. **Post Flair Update Trigger**: When a post has either flair added, the bot will add a stickied, locked comment explaining the restriction

**The third component is provided by your subreddit's `automod` config.**

## Configuration

The restricted flair text and comment message can be customized in [src/settings.ts](../src/settings.ts):

- **Flair Text**: `RESTRICTED_FLAIR_TEXT` (MTO), `BOLLARDS_FLAIR_TEXT` (Bollards)
- **Stickied Comment Text**: `RESTRICTED_FLAIR_COMMENT_TEXT` (MTO), `BOLLARDS_FLAIR_COMMENT_TEXT` (Bollards)

The following flair-only rule is an MTO example to add to your subreddit's AutoModerator configuration:

**Important**: Make sure the `parent_submission.flair_text` value exactly matches the corresponding flair setting in [src/settings.ts](../src/settings.ts).

```yaml
# ==========================================
# Remove unflaired comments in restricted posts
# ==========================================
---
type: comment
author:
  is_submitter: false
  ~flair_text (includes, regex): ["."]
parent_submission:
  flair_text: "Your flair text here" # Update this to match your RESTRICTED_FLAIR_TEXT setting
action: remove
action_reason: "Restricted post comments to flaired users"
---
```

## How It Works

1. A moderator selects "Require Flair for Comments" or "Raise Market Bollards" from the post menu and the bot applies the configured flair to the post. **_This can also be done manually through the reddit UI._**
2. The flair update trigger detects the flair change and adds a sticky comment. **_A moderator can also make this comment themselves_**.
3. AutoModerator removes any new or edited comments from posts with this flair, from users who do not meet that tier's requirements.

## Notes

- The AutoModerator rule `~flair_text (includes, regex): ["."]` triggers on users who have a flair text without any characters (`.`)
- Post authors (`is_submitter: false`) are exempt from the flair requirement in the example above
- Existing comments are not removed when the flair is applied, but edited comments will be removed if the user doesn't meet the mode's requirements
