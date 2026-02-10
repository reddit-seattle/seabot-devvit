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
 * Creates a markdown link to a Reddit user profile
 * @param username - The username (with or without u/ prefix)
 * @returns A markdown link to the user's profile
 */
export function createUserLink(username: string): string {
  const cleanUsername = username.replace(/^u\//, ""); // Remove u/ prefix if present
  return createMarkdownLink(username, `https://reddit.com/u/${cleanUsername}`);
}

/**
 * Creates a markdown link to a Reddit permalink
 * @param permalink - The permalink path (should start with /)
 * @param linkText - The text to display for the link
 * @returns A markdown link to the Reddit permalink
 */
export function createPermalinkLink(
  permalink: string,
  linkText: string,
): string {
  // Ensure permalink starts with /
  const normalizedPermalink = permalink.startsWith("/")
    ? permalink
    : `/${permalink}`;
  return createMarkdownLink(
    linkText,
    `https://reddit.com${normalizedPermalink}`,
  );
}

/**
 * Creates a Reddit resubmission link using old.reddit.com format
 * @param subreddit - Subreddit (accepts "subreddit", "r/subreddit", or "/r/subreddit")
 * @param title - Post title
 * @param url - Post URL (for link posts)
 * @param text - Post text/body (for text posts)
 * @returns A pre-filled submission URL
 */
export function createResubmissionUrl(
  subreddit: string,
  title: string,
  url?: string,
  text?: string,
): string {
  // Normalize subreddit name
  const normalizedSubredditName = subreddit
    .replace(/^\/r\//, "") // Remove /r/ prefix
    .replace(/^r\//, ""); // Remove r/ prefix

  const params = new URLSearchParams();

  // Set the title
  if (title) {
    params.set("title", title);
  }

  // Handle different post types
  if (url && url !== title && !url.includes("reddit.com")) {
    // Link post - set the URL (avoid self-referential Reddit links)
    params.set("url", url);
  } else if (text) {
    // Text post - use text parameter
    params.set("text", text);
  }

  // Use old Reddit because new doesn't populate body text
  return `https://old.reddit.com/r/${normalizedSubredditName}/submit?${params.toString()}`;
}

/**
 * Creates a markdown link for resubmitting to another subreddit
 * @param subreddit - Subreddit (accepts "subreddit", "r/subreddit", or "/r/subreddit")
 * @param title - Post title
 * @param url - Post URL (for link posts)
 * @param text - Post text/body (for text posts)
 * @param displayText - Optional custom text for the link (defaults to "Click here to resubmit...")
 * @returns A markdown link for resubmission
 */
export function createResubmissionLink(
  subreddit: string,
  title: string,
  url?: string,
  text?: string,
  linkText?: string,
): string {
  const resubmissionUrl = createResubmissionUrl(subreddit, title, url, text);
  const displayText =
    linkText || `Click here to resubmit your post to r/${subreddit}`;
  return createMarkdownLink(displayText, resubmissionUrl);
}
