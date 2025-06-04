import { PostFlairUpdateDefinition } from "@devvit/public-api";
import {
  RESTRICTED_FLAIR_COMMENT_TEXT,
  RESTRICTED_FLAIR_TEXT,
} from "../settings.js";

const commentSearchText = RESTRICTED_FLAIR_COMMENT_TEXT.slice(0, 30);

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
              comment.body.includes(commentSearchText)
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
      }
    } catch (error) {
      console.error("Error in PostFlairTrigger:", error);
    }
  },
};

export default AddCommentToRestrictedFlairPost;
