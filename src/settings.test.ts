import { describe, it, expect } from 'vitest';
import { SettingScope } from "@devvit/public-api";
import Settings, {
  RESTRICTED_FLAIR_TEXT,
  RESTRICTED_FLAIR_COMMENT_TEXT,
  EMOJI_UPVOTE,
  EMOJI_DOWNVOTE,
  EMOJI_SEATTLE_SNOO,
  EMOJI_SNOO,
  EMOJI_COMMENT,
  EMOJI_POST,
  EMOJI_STATS,
  EMOJI_WARNING,
  EMOJI_MEGAPHONE,
  EMOJI_DIAMOND_ORANGE,
  EMOJI_DIAMOND_BLUE,
  POST_REPORT_WEBHOOK,
  COMMENT_REPORT_WEBHOOK,
  MODMAIL_REPORT_WEBHOOK,
  generateDiscordWebhookSetting
} from './settings.js';

describe('settings.ts', () => {
  describe('constants', () => {
    it('should export correct restricted flair text', () => {
      expect(RESTRICTED_FLAIR_TEXT).toBe("Market Traffic Only");
    });

    it('should export correct restricted flair comment text', () => {
      expect(RESTRICTED_FLAIR_COMMENT_TEXT).toContain(RESTRICTED_FLAIR_TEXT);
      expect(RESTRICTED_FLAIR_COMMENT_TEXT).toContain("This thread has been designated");
      expect(RESTRICTED_FLAIR_COMMENT_TEXT).toContain("please do not report missing flair");
    });

    it('should export Discord custom emojis', () => {
      expect(EMOJI_UPVOTE).toBe("<:upvote:607100359328006166>");
      expect(EMOJI_DOWNVOTE).toBe("<:downvote:607100771028172820>");
      expect(EMOJI_SEATTLE_SNOO).toBe("<:seattlesnoo:1106309700187852800>");
      expect(EMOJI_SNOO).toBe("<:snoo:607100141647953921>");
    });

    it('should export Unicode emojis', () => {
      expect(EMOJI_COMMENT).toBe("💬");
      expect(EMOJI_POST).toBe("📝");
      expect(EMOJI_STATS).toBe("📊");
      expect(EMOJI_WARNING).toBe("⚠️");
      expect(EMOJI_MEGAPHONE).toBe("📢");
      expect(EMOJI_DIAMOND_ORANGE).toBe("🔸");
      expect(EMOJI_DIAMOND_BLUE).toBe("🔹");
    });

    it('should export webhook setting names', () => {
      expect(POST_REPORT_WEBHOOK).toBe("postReportWebhookURL");
      expect(COMMENT_REPORT_WEBHOOK).toBe("commentReportWebhookURL");
      expect(MODMAIL_REPORT_WEBHOOK).toBe("modmailWebhookURL");
    });
  });

  describe('generateDiscordWebhookSetting', () => {
    it('should generate correct webhook setting structure', () => {
      const name = 'testWebhook';
      const label = 'Test Webhook Label';
      
      const setting = generateDiscordWebhookSetting(name, label);
      
      expect(setting).toEqual({
        type: "string",
        name: name,
        label: label,
        scope: SettingScope.Installation,
      });
    });

    it('should handle empty strings', () => {
      const setting = generateDiscordWebhookSetting('', '') as any;
      
      expect(setting.name).toBe('');
      expect(setting.label).toBe('');
      expect(setting.type).toBe("string");
      expect(setting.scope).toBe(SettingScope.Installation);
    });

    it('should handle special characters in name and label', () => {
      const name = 'webhook_with-special.chars';
      const label = 'Label with spaces & symbols!';
      
      const setting = generateDiscordWebhookSetting(name, label) as any;
      
      expect(setting.name).toBe(name);
      expect(setting.label).toBe(label);
    });
  });

  describe('Settings array', () => {
    it('should contain all webhook settings', () => {
      expect(Settings).toHaveLength(3);
      
      const settingNames = Settings.map(setting => (setting as any).name);
      expect(settingNames).toContain(POST_REPORT_WEBHOOK);
      expect(settingNames).toContain(COMMENT_REPORT_WEBHOOK);
      expect(settingNames).toContain(MODMAIL_REPORT_WEBHOOK);
    });

    it('should have correct structure for all settings', () => {
      Settings.forEach(setting => {
        const s = setting as any;
        expect(s).toHaveProperty('type', 'string');
        expect(s).toHaveProperty('name');
        expect(s).toHaveProperty('label');
        expect(s).toHaveProperty('scope', SettingScope.Installation);
        expect(typeof s.name).toBe('string');
        expect(typeof s.label).toBe('string');
      });
    });

    it('should have descriptive labels for webhook settings', () => {
      const postReportSetting = Settings.find(s => (s as any).name === POST_REPORT_WEBHOOK) as any;
      const commentReportSetting = Settings.find(s => (s as any).name === COMMENT_REPORT_WEBHOOK) as any;
      const modmailSetting = Settings.find(s => (s as any).name === MODMAIL_REPORT_WEBHOOK) as any;

      expect(postReportSetting?.label).toContain('post reports');
      expect(postReportSetting?.label).toContain('Discord channel webhook URL');
      
      expect(commentReportSetting?.label).toContain('comment reports');
      expect(commentReportSetting?.label).toContain('Discord channel webhook URL');
      
      expect(modmailSetting?.label).toContain('new modmail message');
      expect(modmailSetting?.label).toContain('Discord channel webhook URL');
    });
  });
});
