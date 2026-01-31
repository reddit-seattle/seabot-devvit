import { PostFlairUpdateDefinition } from "@devvit/public-api";
import {
  RESTRICTED_FLAIR_COMMENT_TEXT,
  RESTRICTED_FLAIR_TEXT,
} from "../settings.js";

// Prefix of bot comment text to search for existing comments, this helps avoid
// issues with text formatting inconsistencies, adjust slice length as needed.
const commentSearchText = RESTRICTED_FLAIR_COMMENT_TEXT.slice(0, 30);

/**
 * Action specific posts with a flair to restrict unflaired commenters.
 * When a post's flair is updated to RESTRICTED_FLAIR_TEXT, this trigger:
 * 1. Checks if the post already has a distinguished and stickied comment
 *    containing the RESTRICTED_FLAIR_COMMENT_TEXT and returns early if found.
 * 2. Adds a new comment to the post of RESTRICTED_FLAIR_COMMENT_TEXT,
 *    distinguishes and locks the comment to prevent further replies.
 *
 * @remarks
 * Requires AutoModerator configuration to enforce the comment restriction.
 * See docs/RestrictedFlairSetup.md for complete setup instructions.
 */
const AddCommentToRestrictedFlairPost: PostFlairUpdateDefinition = {
  event: "PostFlairUpdate",
  onEvent: async (event, context) => {
    try {
      // Check if the updated flair text matches the target
      if (event.post?.linkFlair?.text === RESTRICTED_FLAIR_TEXT) {
        // Check if the post already has a comment
        const existingComments = await context.reddit
          .getComments({
            postId: event.post.id,
            depth: 1,
          })
          .all();
        console.log("Checking existing comments for restricted flair post...");
        if (
          existingComments.length > 0 &&
          existingComments.some(
            (comment) =>
              !comment.isRemoved() &&
              comment.isDistinguished() &&
              comment.isStickied() &&
              comment.body.includes(commentSearchText),
          )
        ) {
          console.log("Post already has a comment for restricted flair.");
          return;
        }
        // Add a comment to the post
        const comment = await context.reddit.submitComment({
          id: event.post.id,
          text: RESTRICTED_FLAIR_COMMENT_TEXT,
          runAs: "APP",
        });
        await comment.distinguish(true);
        await comment.lock();
        console.log(
          "Added comment to restricted flair post:",
          `https://reddit.com${comment.permalink}`,
        );
      }
    } catch (error) {
      console.error("Error in PostFlairTrigger:", error);
    }
  },
};

export default AddCommentToRestrictedFlairPost;
