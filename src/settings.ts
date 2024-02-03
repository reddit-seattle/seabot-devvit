import { SettingScope, SettingsFormField } from "@devvit/public-api";
import { validateURL } from "./utils.js";

const DISCORD_WEBHOOK_SUFFIX = "Discord channel webhook URL"
export const POST_REPORT_WEBHOOK = 'postReportWebhookURL';
export const COMMENT_REPORT_WEBHOOK = 'commentReportWebhookURL';
export const MODMAIL_REPORT_WEBHOOK = 'modmailWebhookURL';

const DISCORD_WEBHOOK_SETTINGS: { name: string, label: string }[] = [
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
    }
];

export const generateDiscordWebhookSetting: (name: string, label: string) => SettingsFormField = (name, label) => {
    return {
        type: 'string',
        name: name,
        label: label,
        scope: SettingScope.Installation,
        onValidate: validateURL
    };
}

const Settings = [
    ...DISCORD_WEBHOOK_SETTINGS.map(
        ({ name, label }) => generateDiscordWebhookSetting(name, label)
    )
]

export default Settings;