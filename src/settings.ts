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
  footerGenerator?: (context: Context, targetId: string) => Promise<string | undefined>;
}

/**
 * Quick removal menu configurations
 * 
 * CONFIGURE THESE to match your subreddit's rules:
 * - Update labels and descriptions to match your rule names
 * - Modify rulePattern to match your AutoModerator removal reasons
 * - Add or remove menu items as needed for your subreddit
 * - Patterns are case-insensitive regex patterns
 */
export const REMOVAL_MENU_CONFIGS: RemovalMenuConfig[] = [
  {
    label: "r/AskSeattle",
    description: "Rule 5: Use r/AskSeattle for recommendations",
    location: "post",
    rulePattern: "askseattle|rule 5",
    footerGenerator: async (context, targetId) => {
      const post = await context.reddit.getPostById(targetId);
      return createResubmissionLink("AskSeattle", post.title, post.url, post.body);
    },
  },
  {
    label: "Remove: Be Good",
    description: "Remove comment and apply Rule 1: Be Good",
    location: "comment",
    rulePattern: "be good|rule 1",
  },
  {
    label: "Remove: Low-Effort Content",
    description: "Remove post and apply Rule 4: No low-effort content",
    location: "post",
    rulePattern: "low-effort|low effort|rule 4",
  },
];

const DISCORD_WEBHOOK_SUFFIX = "webhook URL";
export const POST_REPORT_WEBHOOK = "postReportWebhookURL";
export const COMMENT_REPORT_WEBHOOK = "commentReportWebhookURL";
export const MODMAIL_REPORT_WEBHOOK = "modmailWebhookURL";

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
];

const Settings = DISCORD_WEBHOOK_SETTINGS.map(({ name, label }) => ({
  type: "string",
  name,
  label,
  scope: SettingScope.Installation,
})) as SettingsFormField[];

export default Settings;
