import { User } from "@devvit/public-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildReportReasonFields,
  buildSubmissionDetailsFields,
  getWebhookUrl,
  logIgnoredReport,
  createDiscordEmbed,
} from "./reportHelpers.js";
import * as webhooks from "./webhooks.js";

// Mock dependencies
vi.mock("./webhooks.js", () => ({
  SendContentToWebhook: vi.fn(),
}));

vi.mock("./discordFormatters.js", () => ({
  createDiscordField: (name: string, value: string) => ({ name, value }),
  formatUserInfo: (user: User) => `User: ${user.username}`,
  formatScoreInfo: (submission: any) => `Score: ${submission.score || 0}`,
  formatReportReasons: (reasons: string[], bullet: string) =>
    reasons.map((r) => `${bullet} ${r}`).join("\n"),
  createEmbedFooter: () => ({ footer: { text: "SeaBot" } }),
}));

vi.mock("./reddithelpers.js", () => ({
  createPermalinkLink: (permalink: string, text: string) =>
    `[${text}](${permalink})`,
}));

describe("reportHelpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  describe("getWebhookUrl", () => {
    it("should return webhook URL when configured", async () => {
      const mockContext = {
        settings: {
          get: vi.fn().mockResolvedValue("https://discord.com/webhook"),
        },
      } as any;

      const result = await getWebhookUrl(mockContext, "testWebhook");

      expect(result).toBe("https://discord.com/webhook");
      expect(mockContext.settings.get).toHaveBeenCalledWith("testWebhook");
    });

    it("should return undefined when webhook is not configured", async () => {
      const mockContext = {
        settings: {
          get: vi.fn().mockResolvedValue(""),
        },
      } as any;

      const result = await getWebhookUrl(mockContext, "testWebhook");

      expect(result).toBeUndefined();
    });

    it("should return undefined when webhook is null", async () => {
      const mockContext = {
        settings: {
          get: vi.fn().mockResolvedValue(null),
        },
      } as any;

      const result = await getWebhookUrl(mockContext, "testWebhook");

      expect(result).toBeUndefined();
    });
  });

  describe("logIgnoredReport", () => {
    it("should log ignored report with permalink", () => {
      logIgnoredReport(
        "https://reddit.com/r/test/comments/abc",
        "Test Title",
        "post",
      );

      expect(console.log).toHaveBeenCalledWith(
        "Ignoring report for post:",
        "[Test Title](https://reddit.com/r/test/comments/abc)",
      );
    });

    it("should truncate long labels", () => {
      const longLabel = "a".repeat(150);
      logIgnoredReport(
        "https://reddit.com/r/test/comments/abc",
        longLabel,
        "comment",
      );

      expect(console.log).toHaveBeenCalledWith(
        "Ignoring report for comment:",
        expect.stringContaining("..."),
      );
      const logCall = (console.log as any).mock.calls[0][1];
      // The truncated label should be 97 chars + "..." = 100 chars, plus the markdown link syntax
      expect(logCall).toContain("...");
      expect(logCall).toMatch(/^\[a+\.\.\.]/); // Should start with [aaa...]
    });
  });

  describe("buildReportReasonFields", () => {
    it("should build fields for mod reports", () => {
      const fields = buildReportReasonFields(
        ["Rule 1", "Rule 2"],
        [],
        undefined,
      );

      expect(fields).toHaveLength(1);
      expect(fields[0].name).toContain("Mod Reports");
      expect(fields[0].value).toContain("Rule 1");
      expect(fields[0].value).toContain("Rule 2");
    });

    it("should build fields for user reports", () => {
      const fields = buildReportReasonFields(
        [],
        ["Spam", "Harassment"],
        undefined,
      );

      expect(fields).toHaveLength(1);
      expect(fields[0].name).toContain("User Reports");
      expect(fields[0].value).toContain("Spam");
      expect(fields[0].value).toContain("Harassment");
    });

    it("should build fields for both mod and user reports", () => {
      const fields = buildReportReasonFields(
        ["Rule 1"],
        ["Spam"],
        undefined,
      );

      expect(fields).toHaveLength(2);
      expect(fields[0].name).toContain("Mod Reports");
      expect(fields[1].name).toContain("User Reports");
    });

    it("should use fallback reason when no categorized reports exist", () => {
      const fields = buildReportReasonFields([], [], "Generic report");

      expect(fields).toHaveLength(1);
      expect(fields[0].name).toContain("User Reports");
      expect(fields[0].value).toContain("Generic report");
    });

    it("should ignore fallback reason when categorized reports exist", () => {
      const fields = buildReportReasonFields(["Rule 1"], [], "Generic report");

      expect(fields).toHaveLength(1);
      expect(fields[0].name).toContain("Mod Reports");
    });
  });

  describe("buildUserAndStatsFields", () => {
    it("should build fields with user and stats", () => {
      const mockUser = {
        username: "testuser",
      } as User;

      const mockSubmission = {
        score: 42,
      };

      const fields = buildSubmissionDetailsFields(mockUser, mockSubmission);

      expect(fields).toHaveLength(2);
      expect(fields[0].name).toBe("User");
      expect(fields[0].value).toContain("testuser");
      expect(fields[1].name).toContain("Statistics");
      expect(fields[1].value).toContain("42");
    });

    it("should build fields without user when null", () => {
      const mockSubmission = {
        score: 42,
      };

      const fields = buildSubmissionDetailsFields(null, mockSubmission);

      expect(fields).toHaveLength(1);
      expect(fields[0].name).toContain("Statistics");
    });
  });

  describe("sendReportToDiscord", () => {
    it("should send formatted embed to webhook", async () => {
      const mockSendContentToWebhook = vi.mocked(
        webhooks.SendContentToWebhook,
      );

      await createDiscordEmbed(
        "https://discord.com/webhook",
        "Test Title",
        "Test Description",
        [{ name: "Field1", value: "Value1" }],
      );

      expect(mockSendContentToWebhook).toHaveBeenCalledWith(
        "https://discord.com/webhook",
        {
          embeds: [
            {
              title: "Test Title",
              type: "rich",
              description: "Test Description",
              fields: [{ name: "Field1", value: "Value1" }],
              footer: { text: "SeaBot" },
            },
          ],
        },
      );
    });
  });
});
