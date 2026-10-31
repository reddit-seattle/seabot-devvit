import { SettingScope, type SettingsFormField } from "@devvit/public-api";

export function parseDailyReportCap(value: unknown): number {
  if (value === undefined) return 25;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 500
  )
    throw new Error("Daily report cap must be an integer from 0 to 500");
  return value;
}

export function readTriageSettings(values: Record<string, unknown>) {
  const enabled =
    values.botTriageEnabled === undefined ? true : values.botTriageEnabled;
  if (typeof enabled !== "boolean")
    throw new Error("Bot triage enabled must be boolean");
  return {
    enabled,
    dailyReportCap: parseDailyReportCap(values.botTriageDailyReportCap),
  };
}

export const botTriageSettings: SettingsFormField[] = [
  {
    type: "boolean",
    name: "botTriageEnabled",
    label: "Bot detection: report suspected network activity",
    defaultValue: true,
    scope: SettingScope.Installation,
  },
  {
    type: "number",
    name: "botTriageDailyReportCap",
    label: "Bot detection: daily report cap (UTC)",
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
];
