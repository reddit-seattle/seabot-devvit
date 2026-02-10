import { MenuItem, Comment } from "@devvit/public-api";

async function* getAllCommentsInThread(
  comment: Comment,
  skipDistinguished: boolean = true,
): AsyncGenerator<Comment> {
  // Yield the current comment first
  if (!skipDistinguished || !comment.isDistinguished()) {
    yield comment;
  }

  // Then traverse all replies
  const replies = await comment.replies.all();
  for (const reply of replies) {
    yield* getAllCommentsInThread(reply, skipDistinguished);
  }
}

const CommentNuke: MenuItem = {
  label: "Comment Nuke",
  description: "Remove nested comments except mod comments",
  location: "comment",
  forUserType: "moderator",
  onPress: async (event, context) => {
    const { targetId } = event;
    if (!targetId) {
      console.error("Menu action has no target.");
      return;
    }

    try {
      // Get the target comment
      const targetComment = await context.reddit.getCommentById(targetId);

      console.log(
        "Processing comment nuke for comment:",
        `https://reddit.com${targetComment.permalink}`,
      );

      // Get all comments in thread
      const commentsToRemove: Comment[] = [];
      for await (const comment of getAllCommentsInThread(targetComment, true)) {
        commentsToRemove.push(comment);
      }

      console.log(
        `Found ${commentsToRemove.length} comments to remove (excluding mod comments)`,
      );

      if (commentsToRemove.length === 0) {
        context.ui.showToast("No comments to remove");
        return;
      }

      // Remove and lock all comments in parallel
      await Promise.all(
        commentsToRemove.map(async (comment) => {
          comment.removed || (await comment.remove());
          comment.locked || (await comment.lock());
        }),
      );

      // Add to Mod Log (disabled - requires privileged permissions)
      // try {
      //     // Get current user for mod log attribution
      //     const user = await context.reddit.getCurrentUser();
      //     await context.modLog.add({
      //         action: 'removecomment',
      //         target: targetId,
      //         details: 'seabot comment nuke',
      //         description: `u/${user?.username || 'unknown'} used comment nuke on this comment`,
      //     });
      // } catch (e: unknown) {
      //     console.error(`Failed to add modlog for comment: ${targetId}.`, (e as Error).message);
      // }

      // Show result to user
      context.ui.showToast(
        `Successfully removed ${commentsToRemove.length} comments! Refresh to see changes.`,
      );
      console.log(
        `Comment nuke completed: ${commentsToRemove.length} comments removed`,
      );
    } catch (error) {
      console.error("Error processing comment nuke:", error);
      context.ui.showToast("Comment nuke failed! Please try again later.");
    }
  },
};

export default CommentNuke;
