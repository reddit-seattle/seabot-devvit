import { Context, SettingScope, SettingsFormField } from "@devvit/public-api";
import { createResubmissionLink } from "./utils/reddithelpers.js";

export const RESTRICTED_FLAIR_TEXT = "Market Traffic Only";
export const RESTRICTED_FLAIR_COMMENT_TEXT = `This thread has been designated \`${RESTRICTED_FLAIR_TEXT}\` - New comments by users without an equipped r/Seattle flair will be automatically removed.

Existing comments are not removed when this action is applied, **please do not report missing flair** in these threads.`;

/**
 * Discord Custom Emojis for upvotes/downvotes
 *
 * CONFIGURE THESE with your Discord server's custom emoji codes:
 * 1. In Discord, type \:emoji_name:
 * 2. Copy the resulting code that looks like: <:emoji_name:123456789>
 * 3. Replace the values below
 */
export const EMOJI_UPVOTE = "<:upvote:607100359328006166>";
export const EMOJI_DOWNVOTE = "<:downvote:607100771028172820>";

// Icons for consistent formatting
export enum Icons {
  COMMENT = "💬",
  POST = "📝",
  STATS = "📊",
  WARNING = "⚠️",
  USER_REPORTS = "📢",
  ORANGE_BULLET = "🔸",
  BLUE_BULLET = "🔹",
}

/**
 * Configuration interface for removal menu items
 */
export interface RemovalMenuConfig {
  /** Label shown in the menu */
  label: string;
  /** Description shown in the menu */
  description: string;
  /** Location where menu item appears */
  location: "post" | "comment";
  /** Regex pattern to match removal reason */
  rulePattern: string;
  /** Optional function to generate footer text for removal comment */
  footerGenerator?: (
    context: Context,
    targetId: string,
  ) => Promise<string | undefined>;
}

/**
 * Custom remove-and-add-removal-reason mod menu items, modify to match your subreddit's rules.
 * Patterns are case-insensitive regex to match your removal reason titles
 */
export const REMOVAL_MENU_CONFIGS: RemovalMenuConfig[] = [
  {
    label: "Remove: AskSeattle",
    description: "Rule 5: Use r/AskSeattle for recommendations",
    location: "post",
    rulePattern: "askseattle|rule 5",
    footerGenerator: async (context, targetId) => {
      const post = await context.reddit.getPostById(targetId);
      return createResubmissionLink(
        "AskSeattle",
        post.title,
        post.url,
        post.body,
      );
    },
  },
  {
    label: "Remove: Be Good",
    description: "Rule 1: Be Good",
    location: "comment",
    rulePattern: "be good|rule 1",
  },
  {
    label: "Remove: Not Seattle-Related",
    description: "Rule 2: Must be Seattle-related",
    location: "post",
    rulePattern: "seattle-related|rule 2",
  },
];

const DISCORD_WEBHOOK_SUFFIX = "webhook URL";
export const POST_REPORT_WEBHOOK = "postReportWebhookURL";
export const COMMENT_REPORT_WEBHOOK = "commentReportWebhookURL";
export const MODMAIL_REPORT_WEBHOOK = "modmailWebhookURL";
export const AUTOMOD_FILTER_COMMENT_WEBHOOK = "automodFilterCommentWebhookURL";
export const AUTOMOD_FILTER_POST_WEBHOOK = "automodFilterPostWebhookURL";
export const POST_DELETE_WEBHOOK = "postDeleteWebhookURL";
export const COMMENT_DELETE_WEBHOOK = "commentDeleteWebhookURL";

const DISCORD_WEBHOOK_SETTINGS: { name: string; label: string }[] = [
  {
    name: POST_REPORT_WEBHOOK,
    label: `post reports ${DISCORD_WEBHOOK_SUFFIX}`,
  },
  {
    name: COMMENT_REPORT_WEBHOOK,
    label: `comment reports ${DISCORD_WEBHOOK_SUFFIX}`,
  },
  {
    name: MODMAIL_REPORT_WEBHOOK,
    label: `new modmail ${DISCORD_WEBHOOK_SUFFIX}`,
  },
  {
    name: AUTOMOD_FILTER_COMMENT_WEBHOOK,
    label: `automod filtered comment ${DISCORD_WEBHOOK_SUFFIX}`,
  },
  {
    name: AUTOMOD_FILTER_POST_WEBHOOK,
    label: `automod filtered post ${DISCORD_WEBHOOK_SUFFIX}`,
  },
  {
    name: POST_DELETE_WEBHOOK,
    label: `post deletion ${DISCORD_WEBHOOK_SUFFIX}`,
  },
  {
    name: COMMENT_DELETE_WEBHOOK,
    label: `comment deletion ${DISCORD_WEBHOOK_SUFFIX}`,
  },
];

const Settings: SettingsFormField[] = [
  // Discord webhook settings
  ...DISCORD_WEBHOOK_SETTINGS.map(({ name, label }) => ({
    type: "string" as const,
    name,
    label,
    scope: SettingScope.Installation,
  })),
];

export default Settings;
