import { describe, expect, it } from "vitest";
import {
  botTriageSettings,
  parseDailyReportCap,
  readTriageSettings,
} from "./settings.js";

describe("bot triage settings", () => {
  it("defaults to HIGH reporting and a daily cap of 25", () => {
    expect(readTriageSettings({}).options).toEqual({
      reportsEnabled: true,
      reportMedium: false,
      reportLow: false,
      dailyReportCap: 25,
    });
    expect(
      botTriageSettings.find(
        (field) => "name" in field && field.name === "botTriageReportsEnabled",
      ),
    ).toMatchObject({ defaultValue: true });
  });
  it.each([false, "true", null, 1])(
    "suppresses reports for a disabled or invalid switch: %s",
    (value) => {
      expect(
        readTriageSettings({ botTriageReportsEnabled: value }).options
          .reportsEnabled,
      ).toBe(false);
    },
  );
  it.each([0, 25, 500])("accepts a daily cap of %i", (value) => {
    expect(parseDailyReportCap(value)).toBe(value);
  });
  it.each([-1, 501, 1.5, NaN, Infinity, "25", null])(
    "rejects an invalid daily cap: %s",
    (value) => {
      expect(() =>
        readTriageSettings({ botTriageDailyReportCap: value }),
      ).toThrow();
    },
  );
  it("validates the campaign schema at runtime", () => {
    expect(() => readTriageSettings({ botTriageCampaignsJson: "{" })).toThrow();
  });
  it("provides settings-form feedback using the runtime validators", async () => {
    const campaign = botTriageSettings.find(
      (field) => "name" in field && field.name === "botTriageCampaignsJson",
    );
    const cap = botTriageSettings.find(
      (field) => "name" in field && field.name === "botTriageDailyReportCap",
    );
    // Validators do not need a Devvit context.
    if (campaign?.type !== "paragraph" || cap?.type !== "number")
      throw new Error("Missing settings");
    const context = {} as Parameters<NonNullable<typeof cap.onValidate>>[1];
    expect(
      await campaign.onValidate?.({ value: "{", isEditing: true }, context),
    ).toBeTypeOf("string");
    expect(
      await campaign.onValidate?.({ value: "", isEditing: true }, context),
    ).toBeUndefined();
    expect(
      await cap.onValidate?.({ value: -1, isEditing: true }, context),
    ).toBeTypeOf("string");
    expect(
      await cap.onValidate?.({ value: 25, isEditing: true }, context),
    ).toBeUndefined();
  });
});
