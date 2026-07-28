import { Context } from "@devvit/public-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LogCommentDelete from "./logCommentDelete.js";

// Mock dependencies
vi.mock("../utils/reportHelpers.js", () => ({
  getWebhookUrl: vi.fn(),
  createDiscordEmbed: vi.fn(),
  buildSubmissionDetailsFields: vi.fn(() => []),
}));

vi.mock("../utils/discordFormatters.js", () => ({
  formatDeletedCommentContent: vi.fn(
    (body, author, postTitle) =>
      `Author: ${author}\nPost: ${postTitle}\nComment: ${body}`,
  ),
  createEmbedFooter: vi.fn(() => ({ footer: { text: "Footer" } })),
  createDiscordField: vi.fn((name, value) => ({ name, value })),
}));

const { getWebhookUrl, createDiscordEmbed } = await import(
  "../utils/reportHelpers.js"
);

const mockComment = {
  id: "comment123",
  body: "This is a deleted comment",
  authorName: "testuser",
};

const mockPost = {
  id: "post123",
  title: "Test Post",
};

const mockContext = {} as unknown as Context;

const mockEvent = {
  comment: mockComment,
  post: mockPost,
} as any;

describe("LogCommentDelete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getWebhookUrl as any).mockResolvedValue(
      "https://discord.com/webhook",
    );
  });

  it("should have correct event type", () => {
    expect(LogCommentDelete.event).toBe("CommentDelete");
  });

  it("should skip processing when no webhook URL is configured", async () => {
    (getWebhookUrl as any).mockResolvedValue(null);

    await LogCommentDelete.onEvent(mockEvent, mockContext);

    expect(createDiscordEmbed).not.toHaveBeenCalled();
  });

  it("should process comment deletion with all data", async () => {
    await LogCommentDelete.onEvent(mockEvent, mockContext);

    expect(createDiscordEmbed).toHaveBeenCalled();
  });

  it("should handle missing comment data", async () => {
    const eventWithoutComment = {
      comment: null,
      post: mockPost,
    } as any;

    await LogCommentDelete.onEvent(eventWithoutComment, mockContext);

    expect(createDiscordEmbed).not.toHaveBeenCalled();
  });

  it("should handle missing post context", async () => {
    const eventWithoutPost = {
      comment: mockComment,
      post: null,
    } as any;

    await LogCommentDelete.onEvent(eventWithoutPost, mockContext);

    expect(createDiscordEmbed).toHaveBeenCalled();
  });

  it("should handle missing author name", async () => {
    const commentWithoutAuthor = {
      ...mockComment,
      authorName: undefined,
    };

    const event = {
      comment: commentWithoutAuthor,
      post: mockPost,
    } as any;

    await LogCommentDelete.onEvent(event, mockContext);

    expect(createDiscordEmbed).toHaveBeenCalled();
  });

  it("should handle empty webhook URL string", async () => {
    (getWebhookUrl as any).mockResolvedValue("");

    await LogCommentDelete.onEvent(mockEvent, mockContext);

    expect(createDiscordEmbed).not.toHaveBeenCalled();
  });

  it("should handle API errors gracefully", async () => {
    (createDiscordEmbed as any).mockRejectedValue(
      new Error("Webhook Error"),
    );

    await LogCommentDelete.onEvent(mockEvent, mockContext);

    expect(createDiscordEmbed).toHaveBeenCalled();
  });
});
