import { Context } from "@devvit/public-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LogPostDelete from "./logPostDelete.js";

// Mock dependencies
vi.mock("../utils/webhooks.js", () => ({
  SendContentToWebhook: vi.fn(),
}));

vi.mock("../utils/discordFormatters.js", () => ({
  formatDeletedPostContent: vi.fn(
    (title, author, content) =>
      `Author: ${author}\nTitle: ${title}\nContent: ${content}`,
  ),
  createEmbedFooter: vi.fn(() => ({ footer: { text: "Footer" } })),
}));

const { SendContentToWebhook } = await import("../utils/webhooks.js");

const mockPost = {
  id: "post123",
  title: "Test Post",
  authorName: "testuser",
  body: "This is the post content",
  permalink: "/r/test/comments/abc/test/",
};

const mockContext = {
  settings: {
    get: vi.fn(),
  },
} as unknown as Context;

const mockEvent = {
  post: mockPost,
} as any;

describe("LogPostDelete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockContext.settings.get as any).mockResolvedValue(
      "https://discord.com/webhook",
    );
  });

  it("should have correct event type", () => {
    expect(LogPostDelete.event).toBe("PostDelete");
  });

  it("should skip processing when no webhook URL is configured", async () => {
    (mockContext.settings.get as any).mockResolvedValue(null);

    await LogPostDelete.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).not.toHaveBeenCalled();
  });

  it("should process post deletion with all data", async () => {
    await LogPostDelete.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalledWith(
      "https://discord.com/webhook",
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining("Post Deleted"),
            description: expect.stringContaining("testuser"),
            type: "rich",
          }),
        ]),
      }),
    );
  });

  it("should handle missing post data", async () => {
    const eventWithoutPost = {
      post: null,
    } as any;

    await LogPostDelete.onEvent(eventWithoutPost, mockContext);

    expect(SendContentToWebhook).not.toHaveBeenCalled();
  });

  it("should handle missing post body", async () => {
    const postWithoutBody = {
      ...mockPost,
      body: undefined,
    };

    const event = {
      post: postWithoutBody,
    } as any;

    await LogPostDelete.onEvent(event, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalled();
  });

  it("should handle missing author name", async () => {
    const postWithoutAuthor = {
      ...mockPost,
      authorName: undefined,
    };

    const event = {
      post: postWithoutAuthor,
    } as any;

    await LogPostDelete.onEvent(event, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalled();
  });

  it("should handle empty webhook URL string", async () => {
    (mockContext.settings.get as any).mockResolvedValue("");

    await LogPostDelete.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).not.toHaveBeenCalled();
  });

  it("should handle API errors gracefully", async () => {
    (SendContentToWebhook as any).mockRejectedValue(
      new Error("Webhook Error"),
    );

    await LogPostDelete.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalled();
  });
});
