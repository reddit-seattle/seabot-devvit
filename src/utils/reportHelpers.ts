import { User } from "@devvit/public-api";
import { Icons } from "../settings.js";
import {
  createDiscordField,
  createEmbedFooter,
  formatReportReasons,
  formatScoreInfo,
  formatUserInfo,
} from "./discordFormatters.js";
import { createPermalinkLink } from "./reddithelpers.js";
import { SendContentToWebhook } from "./webhooks.js";

/**
 * Retrieves a webhook URL from app settings.
 * Returns undefined if the webhook is not configured.
 */
export async function getWebhookUrl(
  ctx: { settings: { get: (key: string) => Promise<string | undefined> } },
  settingName: string,
): Promise<string | undefined> {
  const webhookUrl = (await ctx.settings.get(settingName)) as string;
  return webhookUrl || undefined;
}

/**
 * Logs a message to the console when a report is ignored.
 * @param permalink The permalink to the reported item
 * @param label A label or title for the reported item (will be truncated if needed)
 * @param itemType The type of item being reported (e.g., "post" or "comment")
 */
export function logIgnoredReport(
  permalink: string,
  label: string,
  itemType: string,
): void {
  const truncatedLabel =
    label.length > 100 ? `${label.slice(0, 97)}...` : label;
  console.log(
    `Ignoring report for ${itemType}:`,
    createPermalinkLink(permalink, truncatedLabel),
  );
}

/**
 * Builds report reason fields for Discord embeds
 */
export function buildReportReasonFields(
  modReportReasons: string[],
  userReportReasons: string[],
  fallbackReason?: string,
): Array<{ name: string; value: string }> {
  const fields: Array<{ name: string; value: string }> = [];

  // Mod reports field
  if (modReportReasons.length > 0) {
    fields.push(
      createDiscordField(
        `${Icons.WARNING} Mod Reports`,
        formatReportReasons(modReportReasons, Icons.ORANGE_BULLET),
      ),
    );
  }

  // User reports field
  if (userReportReasons.length > 0) {
    fields.push(
      createDiscordField(
        `${Icons.USER_REPORTS} User Reports`,
        formatReportReasons(userReportReasons, Icons.BLUE_BULLET),
      ),
    );
  }

  // If no categorized reports but we have a fallback reason, show it as a user report
  if (
    modReportReasons.length === 0 &&
    userReportReasons.length === 0 &&
    fallbackReason
  ) {
    fields.push(
      createDiscordField(
        `${Icons.USER_REPORTS} User Reports`,
        formatReportReasons([fallbackReason], Icons.BLUE_BULLET),
      ),
    );
  }

  return fields;
}

/**
 * Creates and sends a Discord embed to a webhook URL
 */
export async function createDiscordEmbed(
  webhookUrl: string,
  title: string,
  description: string,
  fields: Array<{ name: string; value: string }>,
): Promise<void> {
  const footerData = createEmbedFooter();
  const embed = {
    title,
    type: "rich",
    description,
    fields,
    ...footerData,
  };
  const payload = {
    embeds: [embed],
  };
  await SendContentToWebhook(webhookUrl, payload);
}

/**
 * Common helper to build user and statistics fields for reports
 */
export function buildSubmissionDetailsFields(
  author: User | null,
  submission: any,
): Array<{ name: string; value: string }> {
  const fields: Array<{ name: string; value: string }> = [];

  // User information field
  if (author) {
    fields.push(createDiscordField("User", formatUserInfo(author)));
  }

  // Statistics field
  fields.push(
    createDiscordField(
      `${Icons.STATS} Statistics`,
      formatScoreInfo(submission),
    ),
  );

  return fields;
}
