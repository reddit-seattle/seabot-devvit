import { Comment, Post, User } from "@devvit/public-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDiscordField,
  createEmbedFooter,
  formatCommentContent,
  formatReportReasons,
  formatScoreInfo,
  formatUserInfo,
  type CommentInfo,
} from "./discordFormatters.js";

// Mock the dependencies
vi.mock("./reddithelpers.js", () => ({
  createUserLink: (username: string) =>
    `[u/${username}](https://reddit.com/user/${username})`,
}));

vi.mock("./parsers.js", () => ({
  getItemDateString: (submission: Post | Comment) =>
    submission.createdAt
      ? `<t:${Math.floor(submission.createdAt.getTime() / 1000)}:R>`
      : undefined,
}));

describe("discordFormatters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("formatUserInfo", () => {
    it("should format basic user info with username link", () => {
      const user = {
        username: "testuser",
      } as User;

      const result = formatUserInfo(user);

      expect(result).toEqual([
        "[u/testuser](https://reddit.com/user/testuser)",
      ]);
    });

    it("should include user account creation date when provided", () => {
      const user = {
        username: "testuser",
        createdAt: new Date("2024-01-01T00:00:00Z"),
      } as User;

      const result = formatUserInfo(user);

      expect(result).toEqual([
        "[u/testuser](https://reddit.com/user/testuser)",
        "Account Created: <t:1704067200:R>",
      ]);
    });

    it("should include user account creation date when no submission provided", () => {
      const user = {
        username: "testuser",
        createdAt: new Date("2024-01-01T00:00:00Z"),
      } as User;

      const result = formatUserInfo(user);

      expect(result).toEqual([
        "[u/testuser](https://reddit.com/user/testuser)",
        "Account Created: <t:1704067200:R>",
      ]);
    });

    it("should handle unknown username", () => {
      const user = {} as User;

      const result = formatUserInfo(user);

      expect(result).toEqual(["[u/unknown](https://reddit.com/user/unknown)"]);
    });

    it("should handle user with no createdAt date and no submission", () => {
      const user = {
        username: "testuser",
        // No createdAt property
      } as User;

      const result = formatUserInfo(user);

      expect(result).toEqual([
        "[u/testuser](https://reddit.com/user/testuser)",
        // No date line because createdAt is undefined
      ]);
    });

    it("should include karma information when provided", () => {
      const user = {
        username: "testuser",
        linkKarma: 1500,
        commentKarma: 850,
      } as User;

      const result = formatUserInfo(user);

      expect(result).toEqual([
        "[u/testuser](https://reddit.com/user/testuser)",
        "Karma: **1500** link, **850** comment",
      ]);
    });

    it("should handle missing karma gracefully", () => {
      const user = {
        username: "testuser",
        // No karma provided
      } as User;

      const result = formatUserInfo(user);

      // Should not include karma line if no karma data available
      expect(result).toEqual([
        "[u/testuser](https://reddit.com/user/testuser)",
      ]);
    });

    it("should handle submission without createdAt date", () => {
      const user = {
        username: "testuser",
      } as User;

      const result = formatUserInfo(user);

      expect(result).toEqual([
        "[u/testuser](https://reddit.com/user/testuser)",
      ]);
    });

    it("should include only link karma when comment karma is 0", () => {
      const user = {
        username: "testuser",
        linkKarma: 100,
        commentKarma: 0,
      } as User;

      const result = formatUserInfo(user);

      expect(result).toEqual([
        "[u/testuser](https://reddit.com/user/testuser)",
        "Karma: **100** link, **0** comment",
      ]);
    });

    it("should include only comment karma when link karma is 0", () => {
      const user = {
        username: "testuser",
        linkKarma: 0,
        commentKarma: 200,
      } as User;

      const result = formatUserInfo(user);

      expect(result).toEqual([
        "[u/testuser](https://reddit.com/user/testuser)",
        "Karma: **0** link, **200** comment",
      ]);
    });

    it("should include user account date and karma", () => {
      const user = {
        username: "testuser",
        linkKarma: 2500,
        commentKarma: 1200,
        createdAt: new Date("2024-01-01T00:00:00Z"),
      } as User;

      const result = formatUserInfo(user);

      expect(result).toEqual([
        "[u/testuser](https://reddit.com/user/testuser)",
        "Account Created: <t:1704067200:R>", // User account creation date (2024), not submission date (2025)
        "Karma: **2500** link, **1200** comment",
      ]);
    });
  });

  describe("formatScoreInfo", () => {
    it("should format basic score information from submission", () => {
      const mockSubmission = {
        score: 42,
        numReports: 2,
        createdAt: new Date("2025-01-12T14:30:00Z"),
      } as Comment;

      const result = formatScoreInfo(mockSubmission);

      expect(result).toEqual([
        "Score: **42**",
        "Created: <t:1736692200:R>",
        "Total Reports: **2**",
      ]);
    });

    it("should include comments count for posts", () => {
      const mockPost = {
        score: 42,
        numberOfReports: 2,
        numberOfComments: 15,
        createdAt: new Date("2025-01-12T14:30:00Z"),
      } as Post;

      const result = formatScoreInfo(mockPost);

      expect(result).toEqual([
        "Score: **42**",
        "Created: <t:1736692200:R>",
        "Comments: **15**",
        "Total Reports: **2**",
      ]);
    });

    it("should extract comment count from submission when provided", () => {
      const mockPost = {
        score: 42,
        numberOfReports: 2,
        numberOfComments: 25,
        createdAt: new Date("2025-01-12T14:30:00Z"),
      } as Post;

      const result = formatScoreInfo(mockPost);

      expect(result).toEqual([
        "Score: **42**",
        "Created: <t:1736692200:R>",
        "Comments: **25**",
        "Total Reports: **2**",
      ]);
    });

    it("should not include karma information (moved to formatUserInfo)", () => {
      const mockSubmission = {
        score: 42,
        numReports: 2,
      } as Comment;

      const result = formatScoreInfo(mockSubmission);

      expect(result).toEqual(["Score: **42**", "Total Reports: **2**"]);
    });

    it("should include crowd control when present", () => {
      const mockSubmission = {
        score: -5,
        numReports: 1,
        collapsedBecauseCrowdControl: true,
      } as Comment;

      const result = formatScoreInfo(mockSubmission);

      expect(result).toEqual([
        "Score: **-5**",
        "Total Reports: **1**",
        "Crowd Control: **Yes**",
      ]);
    });

    it("should handle missing numReports gracefully", () => {
      const mockSubmission = {
        score: 42,
      } as Comment;

      const result = formatScoreInfo(mockSubmission);

      expect(result).toEqual(["Score: **42**", "Total Reports: **0**"]);
    });

    it("should not include crowd control when false", () => {
      const mockSubmission = {
        score: 10,
        numReports: 0,
        collapsedBecauseCrowdControl: false,
      } as Comment;

      const result = formatScoreInfo(mockSubmission);

      expect(result).toEqual(["Score: **10**", "Total Reports: **0**"]);
    });

    it("should handle missing score", () => {
      const mockSubmission = {
        numReports: 3,
      } as Comment;

      const result = formatScoreInfo(mockSubmission);

      expect(result).toEqual(["Score: **0**", "Total Reports: **3**"]);
    });
  });

  describe("formatCommentContent", () => {
    it("should wrap comment in code blocks", () => {
      const commentInfo: CommentInfo = {
        body: "This is a test comment",
      };

      const result = formatCommentContent(commentInfo);

      expect(result).toBe("```\nThis is a test comment\n```");
    });

    it("should truncate long comments", () => {
      const longComment = "a".repeat(600);
      const commentInfo: CommentInfo = {
        body: longComment,
      };

      const result = formatCommentContent(commentInfo, 100);

      expect(result).toBe("```\n" + "a".repeat(97) + "...\n```");
    });

    it("should handle empty comment body", () => {
      const commentInfo: CommentInfo = {};

      const result = formatCommentContent(commentInfo);

      expect(result).toBe("");
    });

    it("should use default max length when not specified", () => {
      const longComment = "a".repeat(600);
      const commentInfo: CommentInfo = {
        body: longComment,
      };

      const result = formatCommentContent(commentInfo);

      expect(result).toBe("```\n" + "a".repeat(497) + "...\n```");
    });

    it("should handle null body", () => {
      const commentInfo: CommentInfo = {
        body: null as any,
      };

      const result = formatCommentContent(commentInfo);

      expect(result).toBe("");
    });

    it("should not truncate comment when exactly at max length", () => {
      const commentInfo: CommentInfo = {
        body: "a".repeat(100),
      };

      const result = formatCommentContent(commentInfo, 100);

      expect(result).toBe("```\n" + "a".repeat(100) + "\n```");
    });
  });

  describe("formatReportReasons", () => {
    it("should format report reasons with emoji", () => {
      const reasons = ["Spam", "Self-promotion", "Harassment"];
      const emoji = "🔹";

      const result = formatReportReasons(reasons, emoji);

      expect(result).toBe("🔹 Spam\n🔹 Self-promotion\n🔹 Harassment");
    });

    it("should handle empty reasons array", () => {
      const reasons: string[] = [];
      const emoji = "🔹";

      const result = formatReportReasons(reasons, emoji);

      expect(result).toBe("");
    });

    it("should handle single reason", () => {
      const reasons = ["Spam"];
      const emoji = "🔸";

      const result = formatReportReasons(reasons, emoji);

      expect(result).toBe("🔸 Spam");
    });
  });

  describe("createDiscordField", () => {
    it("should create field object with string value", () => {
      const result = createDiscordField("Test Field", "Test Value");

      expect(result).toEqual({
        name: "Test Field",
        value: "Test Value",
      });
    });

    it("should join array values with newlines", () => {
      const result = createDiscordField("Test Field", [
        "Line 1",
        "Line 2",
        "Line 3",
      ]);

      expect(result).toEqual({
        name: "Test Field",
        value: "Line 1\nLine 2\nLine 3",
      });
    });
  });

  describe("createEmbedFooter", () => {
    beforeEach(() => {
      // Mock Date to ensure consistent testing
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-09-15T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should create footer with Seattle timezone timestamp", () => {
      const result = createEmbedFooter();
      expect(result).toHaveProperty("footer");
      expect(result.footer).toHaveProperty("text");
      expect(result.footer.text).toContain("September 15, 2025");
      expect(result.footer.text).toMatch(/\d{1,2}:\d{2} [AP]M/); // Contains time in AM/PM format
    });
  });

  describe("Integration tests for Discord embed structure", () => {
    it("should create consistent comment report embed structure", () => {
      const user = {
        username: "spammer123",
        linkKarma: 45,
        commentKarma: -23,
      } as User;

      const mockSubmission = {
        score: -12,
        numReports: 3,
        collapsedBecauseCrowdControl: true,
        createdAt: new Date("2025-01-12T14:30:00Z"),
      } as Comment;

      const commentInfo: CommentInfo = {
        body: "This is spam content",
      };

      // Test that all required fields can be generated
      const userField = createDiscordField("User", formatUserInfo(user));
      const statsField = createDiscordField(
        "📊 Statistics",
        formatScoreInfo(mockSubmission),
      );
      const commentContent = formatCommentContent(commentInfo);
      const userReports = formatReportReasons(["Spam", "Self-promotion"], "🔹");
      const modReports = formatReportReasons(["Potential bot account"], "🔸");

      expect(userField.name).toBe("User");
      expect(userField.value).toContain("[u/spammer123]");
      expect(userField.value).toContain("Karma: **45** link, **-23** comment");

      expect(statsField.name).toBe("📊 Statistics");
      expect(statsField.value).toContain("Score: **-12**");
      expect(statsField.value).toContain("Crowd Control: **Yes**");
      expect(statsField.value).toContain("Created: <t:1736692200:R>"); // Comment creation date
      expect(statsField.value).not.toContain("Karma:"); // Karma moved to user field

      expect(commentContent).toBe("```\nThis is spam content\n```");
      expect(userReports).toBe("🔹 Spam\n🔹 Self-promotion");
      expect(modReports).toBe("🔸 Potential bot account");
    });

    it("should create consistent post report embed structure", () => {
      const user = {
        username: "scammer456",
        linkKarma: 156,
        commentKarma: 892,
      } as User;

      const mockSubmission = {
        score: 5,
        numberOfReports: 7,
        numberOfComments: 12,
        createdAt: new Date("2025-01-12T14:30:00Z"),
      } as Post;

      const postInfo = {
        title: "Looking for roommate - $500/month amazing deal downtown!",
        permalink: "https://old.reddit.com/r/Seattle/comments/abc123",
      };

      // Test that all required fields can be generated
      const userField = createDiscordField("User", formatUserInfo(user));
      const statsField = createDiscordField(
        "📊 Statistics",
        formatScoreInfo(mockSubmission),
      );
      const postLink = postInfo.permalink;
      const userReports = formatReportReasons(
        ["Housing scam", "Too good to be true"],
        "🔹",
      );
      const modReports = formatReportReasons(["Known scammer pattern"], "🔸");

      expect(userField.name).toBe("User");
      expect(userField.value).toContain("[u/scammer456]");
      expect(userField.value).toContain("Karma: **156** link, **892** comment");

      expect(statsField.name).toBe("📊 Statistics");
      expect(statsField.value).toContain("Score: **5**");
      expect(statsField.value).toContain("Comments: **12**");
      expect(statsField.value).toContain("Created: <t:1736692200:R>"); // Post creation date
      expect(statsField.value).not.toContain("Karma:"); // Karma moved to user field

      expect(postLink).toBe("https://old.reddit.com/r/Seattle/comments/abc123");
      expect(userReports).toBe("🔹 Housing scam\n🔹 Too good to be true");
      expect(modReports).toBe("🔸 Known scammer pattern");
    });
  });
});
