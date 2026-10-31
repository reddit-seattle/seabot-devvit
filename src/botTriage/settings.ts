import { SettingScope, type SettingsFormField } from "@devvit/public-api";
import { parseCampaignConfig, type ReportOptions } from "./scoring.js";

export function parseDailyReportCap(value: unknown): number {
  if (value === undefined) return 25;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 500
  ) {
    throw new Error("Daily report cap must be an integer from 0 to 500");
  }
  return value;
}

export function readTriageSettings(values: Record<string, unknown>) {
  const options: ReportOptions = {
    reportsEnabled:
      values.botTriageReportsEnabled === undefined ||
      values.botTriageReportsEnabled === true,
    reportMedium: values.botTriageReportMedium === true,
    reportLow: values.botTriageReportLow === true,
    dailyReportCap: parseDailyReportCap(values.botTriageDailyReportCap),
  };
  return {
    config: parseCampaignConfig(values.botTriageCampaignsJson),
    options,
  };
}

export const botTriageSettings: SettingsFormField[] = [
  {
    type: "boolean",
    name: "botTriageReportsEnabled",
    label: "Bot triage: submit reports (off = shadow mode)",
    defaultValue: true,
    scope: SettingScope.Installation,
  },
  {
    type: "boolean",
    name: "botTriageReportMedium",
    label: "Bot triage: also report MEDIUM",
    defaultValue: false,
    scope: SettingScope.Installation,
  },
  {
    type: "boolean",
    name: "botTriageReportLow",
    label: "Bot triage: also report LOW with a campaign match",
    defaultValue: false,
    scope: SettingScope.Installation,
  },
  {
    type: "number",
    name: "botTriageDailyReportCap",
    label: "Bot triage: daily report cap (UTC)",
    defaultValue: 25,
    scope: SettingScope.Installation,
    onValidate: ({ value }) => {
      try {
        parseDailyReportCap(value);
      } catch (error) {
        return (error as Error).message;
      }
    },
  },
  {
    type: "paragraph",
    name: "botTriageCampaignsJson",
    label: "Bot triage: campaigns (JSON; empty = bundled defaults)",
    helpText:
      "Each campaign needs id and subreddits; enabled is optional. Invalid configuration suppresses reports.",
    scope: SettingScope.Installation,
    onValidate: ({ value }) => {
      try {
        parseCampaignConfig(value);
      } catch (error) {
        return (error as Error).message;
      }
    },
  },
];
