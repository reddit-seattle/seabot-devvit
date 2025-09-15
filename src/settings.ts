import { SettingScope, SettingsFormField } from "@devvit/public-api";

export const RESTRICTED_FLAIR_TEXT = "Market Traffic Only";
export const RESTRICTED_FLAIR_COMMENT_TEXT = `This thread has been designated \`${RESTRICTED_FLAIR_TEXT}\` - New comments by users without an equipped r/Seattle flair will be automatically removed.

Existing comments are not removed when this action is applied, **please do not report missing flair** in these threads.`;

// Discord Custom Emojis
export const EMOJI_UPVOTE = "<:upvote:607100359328006166>";
export const EMOJI_DOWNVOTE = "<:downvote:607100771028172820>";
export const EMOJI_SEATTLE_SNOO = "<:seattlesnoo:1106309700187852800>";
export const EMOJI_SNOO = "<:snoo:607100141647953921>";

// Standard Unicode Emojis for Reports
export const EMOJI_COMMENT = "💬";
export const EMOJI_POST = "📝";
export const EMOJI_STATS = "📊";
export const EMOJI_WARNING = "⚠️";
export const EMOJI_MEGAPHONE = "📢";
export const EMOJI_DIAMOND_ORANGE = "🔸";
export const EMOJI_DIAMOND_BLUE = "🔹";

const DISCORD_WEBHOOK_SUFFIX = "Discord channel webhook URL";
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
    label: `new modmail message ${DISCORD_WEBHOOK_SUFFIX}`,
  },
];

export const generateDiscordWebhookSetting = (name: string, label: string) => {
  return {
    type: "string",
    name: name,
    label: label,
    scope: SettingScope.Installation,
  } as SettingsFormField;
};

const Settings = [
  ...DISCORD_WEBHOOK_SETTINGS.map(({ name, label }) =>
    generateDiscordWebhookSetting(name, label)
  ),
];

export default Settings;
