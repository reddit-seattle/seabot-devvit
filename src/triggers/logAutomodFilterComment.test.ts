import { Context } from "@devvit/public-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AutomodFilterComment from "./logAutomodFilterComment.js";

// Mock dependencies
vi.mock("../utils/webhooks.js", () => ({
  SendContentToWebhook: vi.fn(),
}));

const { SendContentToWebhook } = await import("../utils/webhooks.js");

const mockComment = {
  id: "comment123",
  body: "This is a comment",
  permalink: "/r/test/comments/abc/test/comment123",
};

const mockContext = {
  settings: {
    get: vi.fn(),
  },
} as unknown as Context;

const mockEvent = {
  comment: mockComment,
  reason: "Rule violation",
} as any;

describe("AutomodFilterComment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockContext.settings.get as any).mockResolvedValue(
      "https://discord.com/webhook",
    );
  });

  it("should have correct event type", () => {
    expect(AutomodFilterComment.event).toBe("AutomoderatorFilterComment");
  });

  it("should skip processing when no webhook URL is configured", async () => {
    (mockContext.settings.get as any).mockResolvedValue(null);

    await AutomodFilterComment.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).not.toHaveBeenCalled();
  });

  it("should send webhook with comment URL and reason", async () => {
    await AutomodFilterComment.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalledWith(
      "https://discord.com/webhook",
      expect.objectContaining({
        content: expect.stringMatching(/https:\/\/www\.reddit\.com.*Rule violation/),
      }),
    );
  });

  it("should handle missing comment data", async () => {
    const eventWithoutComment = {
      comment: null,
      reason: "Rule violation",
    } as any;

    await AutomodFilterComment.onEvent(eventWithoutComment, mockContext);

    expect(SendContentToWebhook).not.toHaveBeenCalled();
  });

  it("should handle empty webhook URL", async () => {
    (mockContext.settings.get as any).mockResolvedValue("");

    await AutomodFilterComment.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).not.toHaveBeenCalled();
  });
});
