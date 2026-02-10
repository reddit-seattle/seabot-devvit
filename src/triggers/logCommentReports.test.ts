import { Comment, Context } from "@devvit/public-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LogCommentReports from "./logCommentReports.js";

// Mock dependencies
vi.mock("../utils/webhooks.js", () => ({
  SendContentToWebhook: vi.fn(),
}));

vi.mock("../utils/reddithelpers.js", () => ({
  createPermalinkLink: vi.fn(
    (permalink, text) => `[${text}](https://reddit.com${permalink})`,
  ),
}));

vi.mock("../utils/discordFormatters.js", () => ({
  formatUserInfo: vi.fn(() => "Formatted user info"),
  formatScoreInfo: vi.fn(() => "Formatted score info"),
  formatCommentContent: vi.fn(() => "Formatted comment content"),
  formatReportReasons: vi.fn(() => "Formatted report reasons"),
  createDiscordField: vi.fn((name, value) => ({ name, value })),
  createEmbedFooter: vi.fn(() => ({ footer: { text: "Footer" } })),
}));

const { SendContentToWebhook } = await import("../utils/webhooks.js");

const mockComment = {
  id: "comment123",
  body: "Test comment body",
  ignoringReports: false,
  modReportReasons: [],
  userReportReasons: [],
  score: 5,
  authorName: "testuser",
  authorId: "user123",
  permalink: "/r/test/comments/abc/test/comment123",
  postId: "post123",
  numReports: 1,
  upvotes: 6,
  downvotes: 1,
  collapsedBecauseCrowdControl: false,
} as unknown as Comment;

const mockPost = {
  id: "post123",
  title: "Test Post",
  permalink: "/r/test/comments/abc/test/",
  numberOfComments: 10,
};

const mockUser = {
  id: "user123",
  linkKarma: 100,
  commentKarma: 200,
  createdAt: new Date("2023-01-01"),
};

const mockContext = {
  settings: {
    get: vi.fn(),
  },
  reddit: {
    getCommentById: vi.fn(),
    getPostById: vi.fn(),
    getUserById: vi.fn(),
  },
} as unknown as Context;

const mockEvent = {
  reason: "Test report reason",
  comment: mockComment,
} as any;

describe("LogCommentDefinition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockContext.settings.get as any).mockResolvedValue(
      "https://discord.com/webhook",
    );
    (mockContext.reddit.getCommentById as any).mockResolvedValue(mockComment);
    (mockContext.reddit.getPostById as any).mockResolvedValue(mockPost);
    (mockContext.reddit.getUserById as any).mockResolvedValue(mockUser);
  });

  it("should have correct event type", () => {
    expect(LogCommentReports.event).toBe("CommentReport");
  });

  it("should skip processing when no webhook URL is configured", async () => {
    (mockContext.settings.get as any).mockResolvedValue(null);

    await LogCommentReports.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).not.toHaveBeenCalled();
  });

  it("should process comment report with all data", async () => {
    await LogCommentReports.onEvent(mockEvent, mockContext);

    expect(mockContext.reddit.getCommentById).toHaveBeenCalledWith(
      "comment123",
    );
    expect(mockContext.reddit.getPostById).toHaveBeenCalledWith("post123");
    expect(mockContext.reddit.getUserById).toHaveBeenCalledWith("user123");
    expect(SendContentToWebhook).toHaveBeenCalledWith(
      "https://discord.com/webhook",
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining("New comment reported"),
            description: expect.stringContaining("Test report reason"),
            fields: expect.any(Array),
          }),
        ]),
      }),
    );
  });

  it("should handle comments that are ignoring reports", async () => {
    const ignoredComment = {
      ...mockComment,
      ignoringReports: true,
    };

    const eventWithIgnored = {
      reason: mockEvent.reason,
      comment: ignoredComment,
    };

    (mockContext.reddit.getCommentById as any).mockResolvedValue(
      ignoredComment,
    );

    await LogCommentReports.onEvent(eventWithIgnored as any, mockContext);

    // Should return early and NOT send webhook when ignoring reports
    expect(SendContentToWebhook).not.toHaveBeenCalled();
  });

  it("should return early when ignoring reports and comment has no body", async () => {
    const ignoredCommentNoBody = {
      ...mockComment,
      ignoringReports: true,
      body: undefined,
    };

    const eventWithIgnoredNoBody = {
      reason: "Test report reason",
      comment: { id: "comment123", body: undefined },
    };

    (mockContext.reddit.getCommentById as any).mockResolvedValue(
      ignoredCommentNoBody,
    );

    // Clear any previous calls
    (SendContentToWebhook as any).mockClear();

    await LogCommentReports.onEvent(eventWithIgnoredNoBody as any, mockContext);

    // Should not call webhook since it returns early
    expect(SendContentToWebhook).not.toHaveBeenCalled();
  });

  it("should handle comment report with no comment body in description", async () => {
    const commentWithoutBody = {
      ...mockComment,
      body: undefined,
      ignoringReports: false, // Make sure it processes
    };

    const eventWithoutBody = {
      reason: "Test report reason",
      comment: { id: "comment123", body: undefined },
    };

    (mockContext.reddit.getCommentById as any).mockResolvedValue(
      commentWithoutBody,
    );

    await LogCommentReports.onEvent(eventWithoutBody as any, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalled();
  });

  it("should show direct reason when no categorized reports exist", async () => {
    const commentWithNoReports = {
      ...mockComment,
      modReportReasons: [],
      userReportReasons: [],
    };

    const eventWithDirectReason = {
      reason: "Direct report reason",
      comment: commentWithNoReports,
    };

    (mockContext.reddit.getCommentById as any).mockResolvedValue(
      commentWithNoReports,
    );

    await LogCommentReports.onEvent(eventWithDirectReason as any, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalled();
  });

  it("should handle comment with no body", async () => {
    const commentWithoutBody = {
      ...mockComment,
      body: undefined,
    };

    const eventWithoutBody = {
      reason: "Test report reason",
      comment: commentWithoutBody,
    };

    (mockContext.reddit.getCommentById as any).mockResolvedValue(
      commentWithoutBody,
    );

    await LogCommentReports.onEvent(eventWithoutBody as any, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalled();
  });

  it("should handle comment with long body in ignored reports", async () => {
    const longBodyComment = {
      ...mockComment,
      body: "a".repeat(150), // Longer than 100 chars
      ignoringReports: true,
    };

    const eventWithLongBody = {
      reason: "Test report reason",
      comment: longBodyComment,
    };

    (mockContext.reddit.getCommentById as any).mockResolvedValue(
      longBodyComment,
    );

    await LogCommentReports.onEvent(eventWithLongBody as any, mockContext);

    expect(SendContentToWebhook).not.toHaveBeenCalled();
  });

  it("should handle comments with mod reports", async () => {
    const commentWithModReports = {
      ...mockComment,
      modReportReasons: ["Mod report 1", "Mod report 2"],
    };

    (mockContext.reddit.getCommentById as any).mockResolvedValue(
      commentWithModReports,
    );

    await LogCommentReports.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalled();
  });

  it("should handle comments with user reports", async () => {
    const commentWithUserReports = {
      ...mockComment,
      userReportReasons: ["User report 1", "User report 2"],
    };

    (mockContext.reddit.getCommentById as any).mockResolvedValue(
      commentWithUserReports,
    );

    await LogCommentReports.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalled();
  });

  it("should handle comments with both mod and user reports", async () => {
    const commentWithBothReports = {
      ...mockComment,
      modReportReasons: ["Mod report"],
      userReportReasons: ["User report"],
    };

    (mockContext.reddit.getCommentById as any).mockResolvedValue(
      commentWithBothReports,
    );

    await LogCommentReports.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalled();
  });

  it("should handle comments with no categorized reports but direct reason", async () => {
    const commentWithNoReports = {
      ...mockComment,
      modReportReasons: [],
      userReportReasons: [],
    };

    (mockContext.reddit.getCommentById as any).mockResolvedValue(
      commentWithNoReports,
    );

    await LogCommentReports.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalled();
  });

  it("should handle missing comment ID", async () => {
    const eventWithoutCommentId = {
      reason: "Test report reason",
      comment: { ...mockComment, id: undefined },
    };

    await LogCommentReports.onEvent(eventWithoutCommentId as any, mockContext);

    expect(mockContext.reddit.getCommentById).toHaveBeenCalledWith("");
  });

  it("should handle missing author information", async () => {
    const commentWithoutAuthor = {
      ...mockComment,
      authorId: undefined,
      authorName: undefined,
    };

    (mockContext.reddit.getCommentById as any).mockResolvedValue(
      commentWithoutAuthor,
    );
    (mockContext.reddit.getUserById as any).mockResolvedValue(null);

    await LogCommentReports.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalled();
  });

  it("should handle crowd control collapsed comments", async () => {
    const crowdControlComment = {
      ...mockComment,
      collapsedBecauseCrowdControl: true,
    };

    (mockContext.reddit.getCommentById as any).mockResolvedValue(
      crowdControlComment,
    );

    await LogCommentReports.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalled();
  });
});
