import { SettingsClient } from "@devvit/public-api";
import {
  DEFAULT_WEEKLY_POST_FOOTER,
  DEFAULT_WEEKLY_POST_HEADER,
  DEFAULT_WEEKLY_POST_TITLE_TEMPLATE,
  WEEKLY_POST_ENABLED,
  WEEKLY_POST_FOOTER,
  WEEKLY_POST_HEADER,
  WEEKLY_POST_TITLE_TEMPLATE,
} from "./constants.js";
import { WeeklyThreadConfig } from "./types.js";

function fallbackString(
  value: string | undefined,
  defaultValue: string,
): string {
  return value && value.trim() ? value.trim() : defaultValue;
}

export async function getWeeklyThreadConfig(
  settings: SettingsClient,
): Promise<WeeklyThreadConfig> {
  const enabled = await settings.get<boolean>(WEEKLY_POST_ENABLED);
  const titleTemplate = await settings.get<string>(WEEKLY_POST_TITLE_TEMPLATE);
  const header = await settings.get<string>(WEEKLY_POST_HEADER);
  const footer = await settings.get<string>(WEEKLY_POST_FOOTER);

  return {
    enabled: enabled ?? true,
    titleTemplate: fallbackString(
      titleTemplate,
      DEFAULT_WEEKLY_POST_TITLE_TEMPLATE,
    ),
    header: fallbackString(header, DEFAULT_WEEKLY_POST_HEADER),
    footer: footer ? footer.trim() : DEFAULT_WEEKLY_POST_FOOTER,
  };
}
