import { describe, expect, it } from "vitest";
import { getWeeklyThreadConfig } from "./config.js";
import {
  DEFAULT_WEEKLY_POST_FOOTER,
  DEFAULT_WEEKLY_POST_HEADER,
  DEFAULT_WEEKLY_POST_TITLE_TEMPLATE,
  WEEKLY_POST_ENABLED,
  WEEKLY_POST_FOOTER,
  WEEKLY_POST_HEADER,
  WEEKLY_POST_TITLE_TEMPLATE,
} from "./constants.js";

describe("weeklyThread/config", () => {
  it("falls back to default title and header when settings are blank", async () => {
    const values = new Map<string, unknown>([
      [WEEKLY_POST_ENABLED, true],
      [WEEKLY_POST_TITLE_TEMPLATE, "   "],
      [WEEKLY_POST_HEADER, ""],
      [WEEKLY_POST_FOOTER, ""],
    ]);

    const settings = {
      get: async <T>(name: string): Promise<T | undefined> =>
        values.get(name) as T | undefined,
    };

    const config = await getWeeklyThreadConfig(settings as never);

    expect(config.enabled).toBe(true);
    expect(config.titleTemplate).toBe(DEFAULT_WEEKLY_POST_TITLE_TEMPLATE);
    expect(config.header).toBe(DEFAULT_WEEKLY_POST_HEADER);
    expect(config.footer).toBe(DEFAULT_WEEKLY_POST_FOOTER);
  });
});
