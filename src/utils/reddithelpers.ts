/**
 * Utility functions for creating markdown content
 */

/**
 * Creates a markdown link
 * @param text - The text to display for the link
 * @param url - The URL to link to
 * @returns A markdown-formatted link string
 */
export function createMarkdownLink(text: string, url: string): string {
    return `[${text}](${url})`;
}

/**
 * Creates a Reddit resubmission link using old.reddit.com format
 * @param targetSubreddit - The subreddit to resubmit to (accepts "subreddit", "r/subreddit", or "/r/subreddit")
 * @param originalTitle - The original post title
 * @param originalUrl - The original post URL (for link posts)
 * @param originalText - The original post text/body (for text posts)
 * @returns A pre-filled submission URL
 */
export function createResubmissionUrl(
    targetSubreddit: string,
    originalTitle: string,
    originalUrl?: string,
    originalText?: string
): string {
    // Normalize subreddit name
    const normalizedSubredditName = targetSubreddit
        .replace(/^\/r\//, '')  // Remove /r/ prefix
        .replace(/^r\//, '');   // Remove r/ prefix

    const params = new URLSearchParams();

    // Set the title
    if (originalTitle) {
        params.set('title', originalTitle);
    }

    // Handle different post types
    if (originalUrl && originalUrl !== originalTitle && !originalUrl.includes('reddit.com')) {
        // Link post - set the URL (avoid self-referential Reddit links)
        params.set('url', originalUrl);
    } else if (originalText) {
        // Text post - use text parameter
        params.set('text', originalText);
    }

    // Use old Reddit because new doesn't populate body text
    return `https://old.reddit.com/r/${normalizedSubredditName}/submit?${params.toString()}`;
}

/**
 * Creates a markdown link for resubmitting to another subreddit
 * @param targetSubreddit - The subreddit to resubmit to (accepts "subreddit", "r/subreddit", or "/r/subreddit")
 * @param originalTitle - The original post title
 * @param originalUrl - The original post URL (for link posts)
 * @param originalText - The original post text/body (for text posts)
 * @param linkText - Optional custom text for the link (defaults to "Click here to resubmit...")
 * @returns A markdown link for resubmission
 */
export function createResubmissionLink(
    targetSubreddit: string,
    originalTitle: string,
    originalUrl?: string,
    originalText?: string,
    linkText?: string
): string {
    const url = createResubmissionUrl(targetSubreddit, originalTitle, originalUrl, originalText);
    const text = linkText || `Click here to resubmit your post to r/${targetSubreddit}`;
    return createMarkdownLink(text, url);
}
