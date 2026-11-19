import { MenuItem } from "@devvit/public-api";
import { RESTRICTED_FLAIR_MODES } from "../settings.js";

/**
 * Menu items to restrict post comments by setting a specific flair.
 * When selected, each updates the post's flair to the predefined restricted flair text.
 * If the post already has the restricted flair, it notifies the user and takes no action.
 *
 * @remarks
 * Requires AutoModerator configuration to enforce the restriction.
 * See docs/RestrictedFlairSetup.md for complete setup instructions.
 */
export const restrictedFlairMenuItems = RESTRICTED_FLAIR_MODES.map(
  (mode): MenuItem => ({
    label: mode.label,
    description: mode.description,
    location: "post",
    forUserType: "moderator",
    onPress: async ({ targetId }, context) => {
      if (!targetId || !context.subredditName) {
        console.error("Menu action has no target or subreddit.");
        context.ui.showToast("Unable to identify this post or subreddit.");
        return;
      }

      try {
        // Check if the post already has the restricted flair
        const post = await context.reddit.getPostById(targetId);
        console.log(
          "Checking post for existing restricted flair:",
          `https://reddit.com${post.permalink}`,
        );
        if (post?.flair?.text === mode.flairText) {
          context.ui.showToast(`${mode.flairText} is already applied to this post.`);
          return;
        }

        // Update the post flair to the restricted flair text
        await context.reddit.setPostFlair({
          postId: targetId,
          text: mode.flairText,
          subredditName: context.subredditName,
        });

        // Add to Mod Log (disabled - requires privileged permissions)
        // try {
        //   // Get current user for mod log attribution
        //   const user = await context.reddit.getCurrentUser();
        //   await context.modLog.add({
        //     action: 'editflair',
        //     target: targetId,
        //     details: 'flair restriction',
        //     description: `u/${user?.username || 'unknown'} applied ${mode.flairText} to the post.`,
        //   });
        // } catch (e: unknown) {
        //   console.error(`Failed to add modlog for post flair restriction: ${targetId}.`, (e as Error).message);
        // }

        context.ui.showToast({
          text: `${mode.flairText} applied to this post.`,
          appearance: "success",
        });
      } catch (error) {
        console.error(`Error applying ${mode.flairText}:`, error);
        context.ui.showToast(`Failed to apply ${mode.flairText}. Please try again.`);
      }
    },
  }),
);
