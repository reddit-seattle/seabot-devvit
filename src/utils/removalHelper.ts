export interface RemovalOptions {
    /** Target ID (post or comment) */
    targetId: string;
    /** Context from the menu item */
    context: any;
    /** Rule search terms to find the removal reason */
    ruleSearchTerms: string[];
    /** Optional custom mod note for removal tracking */
    modNote?: string;
    /** Whether this is a post (true) or comment (false) */
    isPost: boolean;
    /** Optional footer text to append to the removal comment */
    footer?: string;
}

/**
 * Generic helper function to remove posts or comments with official removal reasons
 */
export async function removeWithReason(options: RemovalOptions): Promise<void> {
    const { targetId, context, ruleSearchTerms, modNote, isPost, footer } = options;
    const itemType = isPost ? 'post' : 'comment';

    // Get the target item
    const target = isPost
        ? await context.reddit.getPostById(targetId)
        : await context.reddit.getCommentById(targetId);

    console.log(
        `Processing ${itemType} removal:`,
        `https://reddit.com${target.permalink}`
    );

    // Check if already removed
    if (target.removed) {
        const message = `This ${itemType} has already been removed.`;
        console.log(message);
        context.ui.showToast(message);
        return;
    }

    // Get subreddit removal reasons
    const removalReasons = await context.reddit.getSubredditRemovalReasons(context.subredditName!);

    // Find the matching removal reason using title search terms
    const matchingReason = removalReasons.find((reason: any) =>
        ruleSearchTerms.some(term =>
            reason.title?.toLowerCase().includes(term.toLowerCase())
        )
    );

    // Handle case where no matching removal reason is found
    if (!matchingReason) {
        const searchTermsStr = ruleSearchTerms.join(', ');
        console.error(`Could not find removal reason matching: ${searchTermsStr}`);
        context.ui.showToast(`Error: Could not find removal reason for: ${searchTermsStr}`);
        return;
    }

    // Remove the target
    await context.reddit.remove(targetId, false); // false = not spam

    // Add removal note
    try {
        await context.reddit.addRemovalNote({
            itemIds: [targetId],
            reasonId: matchingReason.id,
            modNote: modNote || `Removed via macro - ${matchingReason.title}`
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

    // Lock the target
    await target.lock();

    // Show success message
    context.ui.showToast(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} removed for ${matchingReason.title}`);
}
