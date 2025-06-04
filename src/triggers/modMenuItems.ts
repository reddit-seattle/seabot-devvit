import { MenuItem } from "@devvit/public-api";
import { RESTRICTED_FLAIR_TEXT } from "../settings.js";

const RestrictPostToFlairedUsers: MenuItem = {
  label: "Require Flair for Comments",
  description: "Restrict this post to flaired users",
  location: "post",
  forUserType: "moderator",
  onPress: async (event, context) => {
    console.log(
      "RestrictPostToFlairedUsers triggered for post:",
      event.targetId
    );
    const { targetId } = event;
    if (!targetId) {
      console.error("Action has no target.");
      return;
    }
    // Check if the post already has the restricted flair
    const post = await context.reddit.getPostById(targetId);
    if (post?.flair?.text === RESTRICTED_FLAIR_TEXT) {
      const message = `This post is already restricted to flaired users.`;
      console.log(message);
      context.ui.showToast(message);
      return;
    }
    try {
      // Update the post flair to the restricted flair text
      await context.reddit.setPostFlair({
        postId: targetId,
        text: RESTRICTED_FLAIR_TEXT,
        subredditName: context.subredditName || "",
      });
      context.ui.showToast({
        text: `Post restricted to flaired users.`,
        appearance: "success",
      });
    } catch (error) {
      console.error("Error restricting post to flaired users:", error);
      context.ui.showToast(
        "Failed to restrict post to flaired users: " + error || "Unknown error"
      );
    }
  },
};
export default RestrictPostToFlairedUsers;
