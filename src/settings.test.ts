import { SettingScope } from "@devvit/public-api";
import { describe, expect, it } from "vitest";
import Settings, {
  CITY_EVENTS_RSS_URL,
  COMMENT_REPORT_WEBHOOK,
  Icons,
  MODMAIL_REPORT_WEBHOOK,
  PWHL_API_KEY,
  WSDOT_API_KEY,
  POST_REPORT_WEBHOOK,
  WEEKLY_POST_ENABLED,
  WEEKLY_POST_FOOTER,
  WEEKLY_POST_HEADER,
  WEEKLY_POST_TITLE_TEMPLATE,
} from "./settings.js";

describe("settings.ts", () => {
  describe("constants", () => {
    it("should export correct icons", () => {
      expect(Icons.COMMENT).toBe("💬");
      expect(Icons.POST).toBe("📝");
      expect(Icons.STATS).toBe("📊");
      expect(Icons.WARNING).toBe("⚠️");
      expect(Icons.USER_REPORTS).toBe("📢");
      expect(Icons.ORANGE_BULLET).toBe("🔸");
      expect(Icons.BLUE_BULLET).toBe("🔹");
    });

    it("should export webhook setting names", () => {
      expect(POST_REPORT_WEBHOOK).toBe("postReportWebhookURL");
      expect(COMMENT_REPORT_WEBHOOK).toBe("commentReportWebhookURL");
      expect(MODMAIL_REPORT_WEBHOOK).toBe("modmailWebhookURL");
    });
  });

  describe("Settings array", () => {
    it("should contain all weekly thread and webhook settings", () => {
      expect(Settings).toHaveLength(10);

      const settingNames = Settings.map((setting) => (setting as any).name);
      expect(settingNames).toContain(WEEKLY_POST_ENABLED);
      expect(settingNames).toContain(WEEKLY_POST_TITLE_TEMPLATE);
      expect(settingNames).toContain(WEEKLY_POST_HEADER);
      expect(settingNames).toContain(WEEKLY_POST_FOOTER);
      expect(settingNames).toContain(PWHL_API_KEY);
      expect(settingNames).toContain(WSDOT_API_KEY);
      expect(settingNames).toContain(CITY_EVENTS_RSS_URL);
      expect(settingNames).toContain(POST_REPORT_WEBHOOK);
      expect(settingNames).toContain(COMMENT_REPORT_WEBHOOK);
      expect(settingNames).toContain(MODMAIL_REPORT_WEBHOOK);
    });

    it("should have correct structure for all settings", () => {
      Settings.forEach((setting) => {
        const s = setting as any;
        expect(s).toHaveProperty("type");
        expect(s).toHaveProperty("name");
        expect(s).toHaveProperty("label");
        expect(s).toHaveProperty("scope", SettingScope.Installation);
        expect(typeof s.name).toBe("string");
        expect(typeof s.label).toBe("string");
      });
    });

    it("should have descriptive labels for weekly thread and webhook settings", () => {
      const weeklyEnabledSetting = Settings.find(
        (s) => (s as any).name === WEEKLY_POST_ENABLED,
      ) as any;
      const weeklyTitleSetting = Settings.find(
        (s) => (s as any).name === WEEKLY_POST_TITLE_TEMPLATE,
      ) as any;
      const weeklyHeaderSetting = Settings.find(
        (s) => (s as any).name === WEEKLY_POST_HEADER,
      ) as any;
      const weeklyFooterSetting = Settings.find(
        (s) => (s as any).name === WEEKLY_POST_FOOTER,
      ) as any;
      const pwhlApiKeySetting = Settings.find(
        (s) => (s as any).name === PWHL_API_KEY,
      ) as any;
      const postReportSetting = Settings.find(
        (s) => (s as any).name === POST_REPORT_WEBHOOK,
      ) as any;
      const commentReportSetting = Settings.find(
        (s) => (s as any).name === COMMENT_REPORT_WEBHOOK,
      ) as any;
      const modmailSetting = Settings.find(
        (s) => (s as any).name === MODMAIL_REPORT_WEBHOOK,
      ) as any;

      expect(weeklyEnabledSetting?.label).toBe(
        "enable weekly ask seattle thread",
      );
      expect(weeklyTitleSetting?.label).toBe("weekly thread title template");
      expect(weeklyHeaderSetting?.label).toBe("weekly thread header");
      expect(weeklyFooterSetting?.label).toBe("weekly thread footer");
      expect(pwhlApiKeySetting?.label).toBe("pwhl api key");
      expect(postReportSetting?.label).toBe("post reports webhook URL");
      expect(commentReportSetting?.label).toBe("comment reports webhook URL");
      expect(modmailSetting?.label).toBe("new modmail webhook URL");
    });
  });
});
