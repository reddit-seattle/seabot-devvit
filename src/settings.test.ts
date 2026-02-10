import { SettingScope } from "@devvit/public-api";
import { describe, expect, it } from "vitest";
import Settings, {
  COMMENT_REPORT_WEBHOOK,
  Icons,
  MODMAIL_REPORT_WEBHOOK,
  POST_REPORT_WEBHOOK,
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
    it("should contain all webhook settings", () => {
      expect(Settings).toHaveLength(3);

      const settingNames = Settings.map((setting) => (setting as any).name);
      expect(settingNames).toContain(POST_REPORT_WEBHOOK);
      expect(settingNames).toContain(COMMENT_REPORT_WEBHOOK);
      expect(settingNames).toContain(MODMAIL_REPORT_WEBHOOK);
    });

    it("should have correct structure for all settings", () => {
      Settings.forEach((setting) => {
        const s = setting as any;
        expect(s).toHaveProperty("type", "string");
        expect(s).toHaveProperty("name");
        expect(s).toHaveProperty("label");
        expect(s).toHaveProperty("scope", SettingScope.Installation);
        expect(typeof s.name).toBe("string");
        expect(typeof s.label).toBe("string");
      });
    });

    it("should have descriptive labels for webhook settings", () => {
      const postReportSetting = Settings.find(
        (s) => (s as any).name === POST_REPORT_WEBHOOK,
      ) as any;
      const commentReportSetting = Settings.find(
        (s) => (s as any).name === COMMENT_REPORT_WEBHOOK,
      ) as any;
      const modmailSetting = Settings.find(
        (s) => (s as any).name === MODMAIL_REPORT_WEBHOOK,
      ) as any;

      expect(postReportSetting?.label).toBe("post reports webhook URL");
      expect(commentReportSetting?.label).toBe("comment reports webhook URL");
      expect(modmailSetting?.label).toBe("new modmail webhook URL");
    });
  });
});
