import { Context } from "@devvit/public-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AutomodFilterPost from "./logAutomodFilterPost.js";

// Mock dependencies
vi.mock("../utils/webhooks.js", () => ({
  SendContentToWebhook: vi.fn(),
}));

const { SendContentToWebhook } = await import("../utils/webhooks.js");

const mockPost = {
  id: "post123",
  title: "Test Post",
  permalink: "/r/test/comments/abc/test/",
};

const mockContext = {
  settings: {
    get: vi.fn(),
  },
} as unknown as Context;

const mockEvent = {
  post: mockPost,
  reason: "Spam detected",
} as any;

describe("AutomodFilterPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockContext.settings.get as any).mockResolvedValue(
      "https://discord.com/webhook",
    );
  });

  it("should have correct event type", () => {
    expect(AutomodFilterPost.event).toBe("AutomoderatorFilterPost");
  });

  it("should skip processing when no webhook URL is configured", async () => {
    (mockContext.settings.get as any).mockResolvedValue(null);

    await AutomodFilterPost.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).not.toHaveBeenCalled();
  });

  it("should send webhook with post URL and reason", async () => {
    await AutomodFilterPost.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalledWith(
      "https://discord.com/webhook",
      expect.objectContaining({
        content: expect.stringMatching(/https:\/\/www\.reddit\.com.*Spam detected/),
      }),
    );
  });

  it("should handle missing post data", async () => {
    const eventWithoutPost = {
      post: null,
      reason: "Spam detected",
    } as any;

    await AutomodFilterPost.onEvent(eventWithoutPost, mockContext);

    expect(SendContentToWebhook).not.toHaveBeenCalled();
  });

  it("should handle empty webhook URL", async () => {
    (mockContext.settings.get as any).mockResolvedValue("");

    await AutomodFilterPost.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).not.toHaveBeenCalled();
  });
});
