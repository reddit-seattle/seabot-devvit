export interface RemovalOptions {
    /** Target ID (post or comment) */
    targetId: string;
    /** Context from the menu item */
    context: any; // Using any to match menu item context type
    /** Rule search terms to find the removal reason */
    ruleSearchTerms: string[];
    /** Optional custom mod note for removal tracking */
    modNote?: string;
    /** Whether this is a post (true) or comment (false) */
    isPost: boolean;
}

/**
 * Generic helper function to remove posts or comments with official removal reasons
 */
export async function removeWithReason(options: RemovalOptions): Promise<void> {
    const { targetId, context, ruleSearchTerms, modNote, isPost } = options;
    const itemType = isPost ? 'post' : 'comment';

    // Get the target item (post or comment)
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

    // Find the matching removal reason using search terms
    const matchingReason = removalReasons.find((reason: any) =>
        ruleSearchTerms.some(term =>
            reason.title?.toLowerCase().includes(term.toLowerCase()) ||
            reason.message?.toLowerCase().includes(term.toLowerCase())
        )
    );

    if (!matchingReason) {
        const searchTermsStr = ruleSearchTerms.join(', ');
        console.error(`Could not find removal reason matching: ${searchTermsStr}`);
        context.ui.showToast(`Error: Could not find removal reason for: ${searchTermsStr}`);
        return;
    }

    // Remove the target
    await context.reddit.remove(targetId, false); // false = not spam

    // Add removal note if available
    try {
        await context.reddit.addRemovalNote({
            itemIds: [targetId],
            reasonId: matchingReason.id,
            modNote: modNote || `Removed via seabot - ${matchingReason.title}`
        });
    } catch (noteError) {
        console.warn("Could not add removal note:", noteError);
        // Continue with the process even if removal note fails
    }

    // Add the moderation comment using the fetched removal reason
    const comment = await context.reddit.submitComment({
        id: targetId,
        text: matchingReason.message,
        runAs: "APP",
    });

    // Distinguish and sticky the comment
    if (comment) {
        await comment.distinguish(true); // true = sticky
        await comment.lock();
    }

    // Lock the target (works for both posts and comments)
    await target.lock();

    context.ui.showToast(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} removed for ${matchingReason.title}`);
}
