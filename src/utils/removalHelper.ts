import { Context, RemovalReason } from "@devvit/public-api";

export interface RemovalOptions {
  /** Target ID (post or comment) */
  targetId: string;
  /** Context from the menu item */
  context: Context;
  /** Regex pattern to match removal reason title (case-insensitive) */
  rulePattern: string;
  /** Whether this is a post (true) or comment (false) */
  isPost: boolean;
  /** Optional footer text to append to the removal comment */
  footer?: string;
}

/**
 * Removes a post or comment with a fetched subreddit removal reason based on regex pattern.
 * @param options  Options for removal including targetId, context, rule pattern, and item type.
 * @returns Promise that resolves when removal is complete.
 * @remarks
 * This function performs the following steps:
 * 1. Fetches the target post or comment by ID.
 * 2. Checks if the target is already removed; if so, it shows a toast and exits.
 * 3. Retrieves subreddit removal reasons and selects first one matching the provided regex pattern.
 * 4. If a matching reason is found, it removes the target, adds a removal note, and submits
 *    a distinguished, stickied, and locked comment with the removal reason message.
 */
export async function removeWithFetchedRemovalReason(
  options: RemovalOptions,
): Promise<void> {
  const { targetId, context, rulePattern, isPost, footer } = options;
  const itemType = isPost ? "post" : "comment";

  // Get the target item
  const target = isPost
    ? await context.reddit.getPostById(targetId)
    : await context.reddit.getCommentById(targetId);

  console.log(
    `Processing ${itemType} removal:`,
    `https://reddit.com${target.permalink}`,
  );

  // Check if already removed
  if (target.removed) {
    const message = `This ${itemType} has already been removed.`;
    console.log(message);
    context.ui.showToast(message);
    return;
  }

  // Get subreddit removal reasons
  const removalReasons = await context.reddit.getSubredditRemovalReasons(
    context.subredditName!,
  );

  // Find the matching removal reason using regex pattern (case-insensitive)
  const regex = new RegExp(rulePattern, "i");
  const matchingReason = removalReasons.find(
    (reason: RemovalReason) => reason.title && regex.test(reason.title),
  );

  // Handle case where no matching removal reason is found
  if (!matchingReason) {
    console.error(
      `Could not find removal reason matching pattern: ${rulePattern}`,
    );
    context.ui.showToast(
      `Error: Could not find removal reason matching: ${rulePattern}`,
    );
    return;
  }

  // Remove the target
  await context.reddit.remove(targetId, false); // false = not spam
  const mod = await context.reddit.getCurrentUsername();

  // Add removal note
  try {
    await context.reddit.addRemovalNote({
      itemIds: [targetId],
      reasonId: matchingReason.id,
      modNote: `Removed by ${mod} via seabot`,
    });
  } catch (noteError) {
    console.warn("Could not add removal note:", noteError);
  }

  // Add the moderation comment using the fetched removal reason
  let commentText = matchingReason.message;

  // Append footer if provided
  if (footer) {
    commentText += `\n\n---\n\n${footer}`;
  }

  const comment = await context.reddit.submitComment({
    id: targetId,
    text: commentText,
    runAs: "APP",
  });

  // Distinguish, sticky, lock response comment
  if (comment) {
    await comment.distinguish(true); // true = sticky
    await comment.lock();
  }

  // Show success message
  context.ui.showToast(
    `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} removed for ${matchingReason.title}`,
  );
}
