import { MenuItem } from "@devvit/public-api";
import {
  RESTRICTED_FLAIR_TEXT,
  RESTRICTED_FLAIR_WEBHOOK,
} from "../settings.js";
import { SendContentToWebhook } from "../utils/webhooks.js";
import { createEmbedFooter } from "../utils/index.js";

/**
 * Menu item to restrict a post to flaired users only by setting a specific flair.
 * When selected, it updates the post's flair to the predefined restricted flair text.
 * If the post already has the restricted flair, it notifies the user and takes no action.
 *
 * @remarks
 * Requires AutoModerator configuration to enforce the restriction.
 * See docs/RestrictedFlairSetup.md for complete setup instructions.
 */
const RestrictPostToFlairedUsers: MenuItem = {
  label: "Require Flair for Comments",
  description: "Restrict this post to flaired users",
  location: "post",
  forUserType: "moderator",
  onPress: async (event, context) => {
    const { targetId } = event;
    if (!targetId) {
      console.error("Menu action has no target.");
      return;
    }

    try {
      // Check if the post already has the restricted flair
      const post = await context.reddit.getPostById(targetId);
      console.log(
        "Checking post for existing restricted flair:",
        `https://reddit.com${post.permalink}`,
      );
      if (post?.flair?.text === RESTRICTED_FLAIR_TEXT) {
        const message = `This post is already restricted to flaired users.`;
        console.log(message);
        context.ui.showToast(message);
        return;
      }

      // Update the post flair to the restricted flair text
      await context.reddit.setPostFlair({
        postId: targetId,
        text: RESTRICTED_FLAIR_TEXT,
        subredditName: context.subredditName || "",
      });

      // log mod action to webhook
      const discordWebhookUrl = (await context.settings.get(
        RESTRICTED_FLAIR_WEBHOOK,
      )) as string;
      if (discordWebhookUrl !== "") {
        await SendContentToWebhook(discordWebhookUrl, {
          embeds: [
            {
              title: `\`${RESTRICTED_FLAIR_TEXT}\` mode enabled`,
              description:
                `[${post.title}](https://reddit.com${post.permalink})` +
                "\n" +
                `Applied by: ${context.username || "unknown user"}`,
             ...createEmbedFooter(),
            },
          ],
        });
      }

      // Add to Mod Log (disabled - requires privileged permissions)
      // try {
      //   // Get current user for mod log attribution
      //   const user = await context.reddit.getCurrentUser();
      //   await context.modLog.add({
      //     action: 'editflair',
      //     target: targetId,
      //     details: 'flair restriction',
      //     description: `u/${user?.username || 'unknown'} restricted post to flaired users only.`,
      //   });
      // } catch (e: unknown) {
      //   console.error(`Failed to add modlog for post flair restriction: ${targetId}.`, (e as Error).message);
      // }

      context.ui.showToast({
        text: `Post restricted to flaired users.`,
        appearance: "success",
      });
    } catch (error) {
      console.error("Error restricting post to flaired users:", error);
      context.ui.showToast(
        "Failed to restrict post to flaired users: " + error || "Unknown error",
      );
    }
  },
};
export default RestrictPostToFlairedUsers;
