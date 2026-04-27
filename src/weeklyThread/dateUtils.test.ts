import { describe, expect, it } from "vitest";
import {
  formatDateWithPattern,
  formatTrafficAlertDateString,
  formatTemplate,
  getUpcomingWindow,
  getWeekWindow,
} from "./dateUtils.js";

describe("weeklyThread/dateUtils", () => {
  const sampleDate = new Date("2026-04-25T12:00:00-07:00");

  it("formats date tokens with Seattle-local values", () => {
    expect(formatDateWithPattern(sampleDate, "dddd, MMMM D, YYYY")).toBe(
      "Saturday, April 25, 2026",
    );
    expect(formatDateWithPattern(sampleDate, "MM/DD/YY")).toBe("04/25/26");
  });

  it("computes week start and week end macros", () => {
    const { start, end } = getWeekWindow(sampleDate);

    expect(formatDateWithPattern(start, "MMMM D, YYYY")).toBe("April 20, 2026");
    expect(formatDateWithPattern(end, "MMMM D, YYYY")).toBe("April 26, 2026");
  });

  it("computes a rolling seven day window", () => {
    const { start, end } = getUpcomingWindow(sampleDate);

    expect(formatDateWithPattern(start, "MMMM D, YYYY")).toBe("April 25, 2026");
    expect(formatDateWithPattern(end, "MMMM D, YYYY")).toBe("May 1, 2026");
  });

  it("renders date macros in templates", () => {
    const template =
      "Weekly What's Happening Thread: {{weekStart:MMMM D, YYYY}} - {{weekEnd:MMM D}}";

    expect(formatTemplate(template, sampleDate)).toBe(
      "Weekly What's Happening Thread: April 20, 2026 - Apr 26",
    );
  });

  it("formats pacific date time labels for section output", () => {
    expect(formatTrafficAlertDateString("2026-05-02T00:00:00Z")).toContain("May");
    expect(formatTrafficAlertDateString("2026-05-02T00:00:00Z")).toContain("PDT");
  });
});
