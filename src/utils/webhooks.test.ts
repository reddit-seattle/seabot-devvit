import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SendContentToWebhook } from "./webhooks.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("SendContentToWebhook", () => {
  const webhookURL = "https://discord.com/api/webhooks/123456789/abcdefg";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("successful webhook calls", () => {
    it("should send basic embed to webhook", async () => {
      mockFetch.mockResolvedValue(new Response("", { status: 200 }));

      const payload = {
        embeds: [
          {
            title: "Test Embed",
            description: "Test description",
            color: 0xff0000,
          },
        ],
      };

      await SendContentToWebhook(webhookURL, payload);

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith(webhookURL, {
        method: "post",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    });

    it("should send content with embeds", async () => {
      mockFetch.mockResolvedValue(new Response("", { status: 200 }));

      const payload = {
        content: "Alert: New moderation action",
        embeds: [
          {
            title: "Post Removed",
            description: "A post was removed for violating rules",
            fields: [
              { name: "Reason", value: "Spam content" },
              { name: "Author", value: "testuser" },
            ],
          },
        ],
      };

      await SendContentToWebhook(webhookURL, payload);

      expect(mockFetch).toHaveBeenCalledWith(webhookURL, {
        method: "post",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    });

    it("should send multiple embeds", async () => {
      mockFetch.mockResolvedValue(new Response("", { status: 200 }));

      const payload = {
        embeds: [
          {
            title: "First Embed",
            description: "First description",
          },
          {
            title: "Second Embed",
            description: "Second description",
          },
        ],
      };

      await SendContentToWebhook(webhookURL, payload);

      expect(mockFetch).toHaveBeenCalledWith(webhookURL, {
        method: "post",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    });

    it("should send content without embeds", async () => {
      mockFetch.mockResolvedValue(new Response("", { status: 200 }));

      const payload = {
        content: "Simple text message",
        embeds: [],
      };

      await SendContentToWebhook(webhookURL, payload);

      expect(mockFetch).toHaveBeenCalledWith(webhookURL, {
        method: "post",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    });
  });

  describe("embed data structures", () => {
    it("should handle complex embed with all fields", async () => {
      mockFetch.mockResolvedValue(new Response("", { status: 200 }));

      const payload = {
        embeds: [
          {
            title: "Complex Embed",
            description: "A complex embed with all possible fields",
            url: "https://reddit.com/r/test/post123",
            color: 0x7289da,
            timestamp: "2023-01-15T10:30:00.000Z",
            footer: {
              text: "SeaBot Moderation",
              icon_url: "https://example.com/icon.png",
            },
            thumbnail: {
              url: "https://example.com/thumb.png",
            },
            author: {
              name: "Reddit User",
              url: "https://reddit.com/u/testuser",
              icon_url: "https://example.com/avatar.png",
            },
            fields: [
              { name: "Field 1", value: "Value 1", inline: true },
              { name: "Field 2", value: "Value 2", inline: true },
              { name: "Field 3", value: "Value 3", inline: false },
            ],
          },
        ],
      };

      await SendContentToWebhook(webhookURL, payload);

      expect(mockFetch).toHaveBeenCalledWith(webhookURL, {
        method: "post",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    });

    it("should handle embed with special characters", async () => {
      mockFetch.mockResolvedValue(new Response("", { status: 200 }));

      const payload = {
        embeds: [
          {
            title: 'Special Characters: "Test" & <Tags>',
            description:
              "Description with émojis 🎉 and newlines\n\nSecond paragraph",
            fields: [
              { name: "Unicode", value: "Testing unicode: ñáéíóú 中文 🔥" },
            ],
          },
        ],
      };

      await SendContentToWebhook(webhookURL, payload);

      const calledBody = mockFetch.mock.calls[0][1].body;
      const parsedBody = JSON.parse(calledBody);

      expect(parsedBody.embeds[0].title).toBe(
        'Special Characters: "Test" & <Tags>',
      );
      expect(parsedBody.embeds[0].description).toContain("émojis 🎉");
      expect(parsedBody.embeds[0].fields[0].value).toContain("ñáéíóú 中文 🔥");
    });
  });

  describe("error scenarios", () => {
    it("should handle fetch errors gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const payload = {
        embeds: [{ title: "Test", description: "Test" }],
      };

      // The function doesn't handle errors, so it should throw
      await expect(SendContentToWebhook(webhookURL, payload)).rejects.toThrow(
        "Network error",
      );
    });

    it("should handle HTTP error responses", async () => {
      mockFetch.mockResolvedValue(new Response("Bad Request", { status: 400 }));

      const payload = {
        embeds: [{ title: "Test", description: "Test" }],
      };

      // Function doesn't check response status, so it should resolve
      await expect(
        SendContentToWebhook(webhookURL, payload),
      ).resolves.not.toThrow();
    });

    it("should handle invalid webhook URL", async () => {
      mockFetch.mockRejectedValue(new TypeError("Invalid URL"));

      const payload = {
        embeds: [{ title: "Test", description: "Test" }],
      };

      await expect(
        SendContentToWebhook("invalid-url", payload),
      ).rejects.toThrow("Invalid URL");
    });
  });

  describe("payload validation", () => {
    it("should handle empty embeds array", async () => {
      mockFetch.mockResolvedValue(new Response("", { status: 200 }));

      const payload = {
        embeds: [],
      };

      await SendContentToWebhook(webhookURL, payload);

      expect(mockFetch).toHaveBeenCalledWith(webhookURL, {
        method: "post",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    });

    it("should handle undefined content", async () => {
      mockFetch.mockResolvedValue(new Response("", { status: 200 }));

      const payload = {
        content: undefined,
        embeds: [{ title: "Test" }],
      };

      await SendContentToWebhook(webhookURL, payload);

      const calledBody = mockFetch.mock.calls[0][1].body;
      const parsedBody = JSON.parse(calledBody);

      expect(parsedBody.content).toBeUndefined();
      expect(parsedBody.embeds).toHaveLength(1);
    });

    it("should handle large payloads", async () => {
      mockFetch.mockResolvedValue(new Response("", { status: 200 }));

      // Create a large embed with many fields
      const largeEmbed = {
        title: "Large Embed",
        description: "A".repeat(2000), // Large description
        fields: Array.from({ length: 20 }, (_, i) => ({
          name: `Field ${i + 1}`,
          value: "B".repeat(100),
          inline: i % 2 === 0,
        })),
      };

      const payload = {
        embeds: [largeEmbed],
      };

      await SendContentToWebhook(webhookURL, payload);

      expect(mockFetch).toHaveBeenCalledOnce();

      const calledBody = mockFetch.mock.calls[0][1].body;
      const parsedBody = JSON.parse(calledBody);

      expect(parsedBody.embeds[0].fields).toHaveLength(20);
      expect(parsedBody.embeds[0].description).toHaveLength(2000);
    });
  });

  describe("HTTP method and headers", () => {
    it("should use POST method", async () => {
      mockFetch.mockResolvedValue(new Response("", { status: 200 }));

      const payload = { embeds: [{ title: "Test" }] };

      await SendContentToWebhook(webhookURL, payload);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "post",
        }),
      );
    });

    it("should set correct Content-Type header", async () => {
      mockFetch.mockResolvedValue(new Response("", { status: 200 }));

      const payload = { embeds: [{ title: "Test" }] };

      await SendContentToWebhook(webhookURL, payload);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
          },
        }),
      );
    });

    it("should serialize payload as JSON string", async () => {
      mockFetch.mockResolvedValue(new Response("", { status: 200 }));

      const payload = {
        content: "Test message",
        embeds: [{ title: "Test", color: 0xff0000 }],
      };

      await SendContentToWebhook(webhookURL, payload);

      const calledBody = mockFetch.mock.calls[0][1].body;

      // Should be a valid JSON string
      expect(() => JSON.parse(calledBody)).not.toThrow();

      const parsedBody = JSON.parse(calledBody);
      expect(parsedBody).toEqual(payload);
    });
  });
});
