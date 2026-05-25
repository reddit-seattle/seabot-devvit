import { SettingScope } from "@devvit/public-api";
import { describe, expect, it } from "vitest";
import Settings, {
  AUTOMOD_FILTER_COMMENT_WEBHOOK,
  AUTOMOD_FILTER_POST_WEBHOOK,
  COMMENT_DELETE_WEBHOOK,
  COMMENT_REPORT_WEBHOOK,
  Icons,
  MODMAIL_REPORT_WEBHOOK,
  POST_DELETE_WEBHOOK,
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
      expect(AUTOMOD_FILTER_COMMENT_WEBHOOK).toBe("automodFilterCommentWebhookURL");
      expect(AUTOMOD_FILTER_POST_WEBHOOK).toBe("automodFilterPostWebhookURL");
      expect(POST_DELETE_WEBHOOK).toBe("postDeleteWebhookURL");
      expect(COMMENT_DELETE_WEBHOOK).toBe("commentDeleteWebhookURL");
    });
  });

  describe("Settings array", () => {
    it("should contain all webhook settings", () => {
      expect(Settings).toHaveLength(7);

      const settingNames = Settings.map((setting) => (setting as any).name);
      expect(settingNames).toContain(POST_REPORT_WEBHOOK);
      expect(settingNames).toContain(COMMENT_REPORT_WEBHOOK);
      expect(settingNames).toContain(MODMAIL_REPORT_WEBHOOK);
      expect(settingNames).toContain(AUTOMOD_FILTER_COMMENT_WEBHOOK);
      expect(settingNames).toContain(AUTOMOD_FILTER_POST_WEBHOOK);
      expect(settingNames).toContain(POST_DELETE_WEBHOOK);
      expect(settingNames).toContain(COMMENT_DELETE_WEBHOOK);
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
      const automodCommentSetting = Settings.find(
        (s) => (s as any).name === AUTOMOD_FILTER_COMMENT_WEBHOOK,
      ) as any;
      const automodPostSetting = Settings.find(
        (s) => (s as any).name === AUTOMOD_FILTER_POST_WEBHOOK,
      ) as any;
      const postDeleteSetting = Settings.find(
        (s) => (s as any).name === POST_DELETE_WEBHOOK,
      ) as any;
      const commentDeleteSetting = Settings.find(
        (s) => (s as any).name === COMMENT_DELETE_WEBHOOK,
      ) as any;

      expect(postReportSetting?.label).toBe("post reports webhook URL");
      expect(commentReportSetting?.label).toBe("comment reports webhook URL");
      expect(modmailSetting?.label).toBe("new modmail webhook URL");
      expect(automodCommentSetting?.label).toBe("automod filtered comment webhook URL");
      expect(automodPostSetting?.label).toBe("automod filtered post webhook URL");
      expect(postDeleteSetting?.label).toBe("post deletion webhook URL");
      expect(commentDeleteSetting?.label).toBe("comment deletion webhook URL");
    });
  });
});
