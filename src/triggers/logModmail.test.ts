import { Context } from "@devvit/public-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LogModmailMessage from "./logModmail.js";

// Mock dependencies
vi.mock("../utils/webhooks.js", () => ({
  SendContentToWebhook: vi.fn(),
}));

vi.mock("../utils/parsers.js", () => ({
  parseConversationType: vi.fn((type) => `Parsed: ${type}`),
  parseParticipantAuthor: vi.fn((author) =>
    author ? `User: ${author.name}` : "Unknown",
  ),
}));

const { SendContentToWebhook } = await import("../utils/webhooks.js");

const mockContext = {
  settings: {
    get: vi.fn(),
  },
  reddit: {
    modMail: {
      getConversation: vi.fn(),
    },
  },
} as unknown as Context;

const mockConversation = {
  id: "conv123",
  subject: "Test Subject",
  conversationType: "internal",
  messages: {
    "2ch154": {
      author: { name: "testuser", id: "user123" },
      bodyMarkdown: "Test message content",
    },
  },
  authors: [
    { name: "testuser", id: "user123" },
    { name: "moderator", id: "mod123" },
  ],
};

const mockEvent = {
  conversationId: "conv123",
  messageId: "ModmailMessage_2ch154",
} as any;

describe("LogModmailMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockContext.settings.get as any).mockResolvedValue(
      "https://discord.com/webhook",
    );
    (mockContext.reddit.modMail.getConversation as any).mockResolvedValue({
      conversation: mockConversation,
    });
  });

  it("should have correct event type", () => {
    expect(LogModmailMessage.event).toBe("ModMail");
  });

  it("should skip processing when no webhook URL is configured", async () => {
    (mockContext.settings.get as any).mockResolvedValue(null);

    await LogModmailMessage.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).not.toHaveBeenCalled();
  });

  it("should process modmail message with all data", async () => {
    await LogModmailMessage.onEvent(mockEvent, mockContext);

    expect(mockContext.reddit.modMail.getConversation).toHaveBeenCalledWith({
      conversationId: "conv123",
      markRead: false,
    });

    expect(SendContentToWebhook).toHaveBeenCalledWith(
      "https://discord.com/webhook",
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: "New modmail message from testuser",
            description: expect.stringContaining("Test Subject"),
            fields: expect.arrayContaining([
              expect.objectContaining({ name: "Conversation Type" }),
              expect.objectContaining({ name: "Author" }),
              expect.objectContaining({ name: "Content" }),
              expect.objectContaining({ name: "Participants" }),
            ]),
          }),
        ]),
      }),
    );
  });

  it("should handle different conversation types", async () => {
    const differentConversation = {
      ...mockConversation,
      conversationType: "appeal",
    };

    (mockContext.reddit.modMail.getConversation as any).mockResolvedValue({
      conversation: differentConversation,
    });

    await LogModmailMessage.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalled();
  });

  it("should handle message with no author", async () => {
    const conversationWithNoAuthor = {
      ...mockConversation,
      messages: {
        "2ch154": {
          author: null,
          bodyMarkdown: "Test message content",
        },
      },
    };

    (mockContext.reddit.modMail.getConversation as any).mockResolvedValue({
      conversation: conversationWithNoAuthor,
    });

    await LogModmailMessage.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalled();
  });

  it("should handle conversation with multiple participants", async () => {
    const conversationWithMultipleParticipants = {
      ...mockConversation,
      authors: [
        { name: "user1", id: "user1" },
        { name: "user2", id: "user2" },
        { name: "mod1", id: "mod1" },
      ],
    };

    (mockContext.reddit.modMail.getConversation as any).mockResolvedValue({
      conversation: conversationWithMultipleParticipants,
    });

    await LogModmailMessage.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalled();
  });

  it("should handle empty conversation result", async () => {
    (mockContext.reddit.modMail.getConversation as any).mockResolvedValue({
      conversation: null,
    });

    await LogModmailMessage.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).not.toHaveBeenCalled();
  });

  it("should handle conversation API errors", async () => {
    (mockContext.reddit.modMail.getConversation as any).mockRejectedValue(
      new Error("API Error"),
    );

    // Call the function directly and ensure it handles the error
    await LogModmailMessage.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).not.toHaveBeenCalled();
  });

  it("should extract message ID correctly from event", async () => {
    const eventWithDifferentId = {
      ...mockEvent,
      messageId: "ModmailMessage_abc123",
    };

    const conversationWithMessage = {
      ...mockConversation,
      messages: {
        abc123: {
          author: { name: "testuser2", id: "user456" },
          bodyMarkdown: "Different message content",
        },
      },
    };

    (mockContext.reddit.modMail.getConversation as any).mockResolvedValue({
      conversation: conversationWithMessage,
    });

    await LogModmailMessage.onEvent(eventWithDifferentId, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalled();
  });

  it("should handle long subject titles", async () => {
    const conversationWithLongSubject = {
      ...mockConversation,
      subject:
        "This is a very long subject line that might need to be handled carefully in the Discord embed",
    };

    (mockContext.reddit.modMail.getConversation as any).mockResolvedValue({
      conversation: conversationWithLongSubject,
    });

    await LogModmailMessage.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalled();
  });

  it("should handle empty message content", async () => {
    const conversationWithEmptyMessage = {
      ...mockConversation,
      messages: {
        "2ch154": {
          author: { name: "testuser", id: "user123" },
          bodyMarkdown: "",
        },
      },
    };

    (mockContext.reddit.modMail.getConversation as any).mockResolvedValue({
      conversation: conversationWithEmptyMessage,
    });

    await LogModmailMessage.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalled();
  });
});
