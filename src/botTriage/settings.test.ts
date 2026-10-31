import { describe, expect, it } from "vitest";
import {
  botTriageSettings,
  parseDailyReportCap,
  readTriageSettings,
} from "./settings.js";

describe("bot triage controls", () => {
  it("reports by default and allows evaluation to be disabled", () => {
    expect(readTriageSettings({})).toEqual({
      enabled: true,
      dailyReportCap: 25,
    });
    expect(readTriageSettings({ botTriageEnabled: false }).enabled).toBe(false);
    expect(() => readTriageSettings({ botTriageEnabled: "false" })).toThrow();
    expect(() => readTriageSettings({ botTriageEnabled: null })).toThrow();
    expect(
      botTriageSettings.find(
        (field) => "name" in field && field.name === "botTriageEnabled",
      ),
    ).toMatchObject({ defaultValue: true });
  });
  it.each([0, 25, 500])("accepts cap %i", (value) =>
    expect(parseDailyReportCap(value)).toBe(value),
  );
  it.each([-1, 501, 1.5, NaN, Infinity, "25", null])(
    "rejects cap %s",
    (value) => {
      expect(() =>
        readTriageSettings({ botTriageDailyReportCap: value }),
      ).toThrow();
    },
  );
  it("uses the same cap validation in the settings form", async () => {
    const cap = botTriageSettings.find(
      (field) => "name" in field && field.name === "botTriageDailyReportCap",
    );
    if (cap?.type !== "number") throw new Error("Missing cap setting");
    const context = {} as Parameters<NonNullable<typeof cap.onValidate>>[1];
    expect(
      await cap.onValidate?.({ value: -1, isEditing: true }, context),
    ).toBeTypeOf("string");
    expect(
      await cap.onValidate?.({ value: 25, isEditing: true }, context),
    ).toBeUndefined();
  });
});
