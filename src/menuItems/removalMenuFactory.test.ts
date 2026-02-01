import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRemovalMenuItem } from "./removalMenuFactory.js";
import { RemovalMenuConfig } from "../settings.js";
import * as removalHelper from "../utils/removalHelper.js";

vi.mock("../utils/removalHelper.js", () => ({
  removeWithFetchedRemovalReason: vi.fn(),
}));

describe("removalMenuFactory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createRemovalMenuItem", () => {
    it("should create a menu item with basic config", () => {
      const config: RemovalMenuConfig = {
        label: "Test Removal",
        description: "Test Description",
        location: "post",
        rulePattern: "test rule",
      };

      const menuItem = createRemovalMenuItem(config);

      expect(menuItem).toHaveProperty("label", "Test Removal");
      expect(menuItem).toHaveProperty("description", "Test Description");
      expect(menuItem).toHaveProperty("location", "post");
      expect(menuItem).toHaveProperty("forUserType", "moderator");
      expect(menuItem).toHaveProperty("onPress");
      expect(typeof menuItem.onPress).toBe("function");
    });

    it("should create menu items for both post and comment locations", () => {
      const postConfig: RemovalMenuConfig = {
        label: "Test Post",
        description: "Post removal",
        location: "post",
        rulePattern: "test",
      };

      const commentConfig: RemovalMenuConfig = {
        label: "Test Comment",
        description: "Comment removal",
        location: "comment",
        rulePattern: "test",
      };

      const postMenuItem = createRemovalMenuItem(postConfig);
      const commentMenuItem = createRemovalMenuItem(commentConfig);

      expect(postMenuItem.location).toBe("post");
      expect(commentMenuItem.location).toBe("comment");
    });

    it("should create menu item with footer generator", () => {
      const footerGenerator = vi.fn(async () => "Test footer");

      const config: RemovalMenuConfig = {
        label: "Test with Footer",
        description: "Has footer",
        location: "post",
        rulePattern: "test",
        footerGenerator,
      };

      const menuItem = createRemovalMenuItem(config);

      expect(menuItem).toHaveProperty("onPress");
      expect(typeof menuItem.onPress).toBe("function");
    });

    it("should handle config without footer generator", () => {
      const config: RemovalMenuConfig = {
        label: "Test without Footer",
        description: "No footer",
        location: "comment",
        rulePattern: "test",
      };

      const menuItem = createRemovalMenuItem(config);

      expect(menuItem).toHaveProperty("onPress");
      expect(typeof menuItem.onPress).toBe("function");
    });

    it("should preserve all config properties in menu item", () => {
      const config: RemovalMenuConfig = {
        label: "Complete Config",
        description: "All properties",
        location: "post",
        rulePattern: "complete|test",
        footerGenerator: async () => "footer",
      };

      const menuItem = createRemovalMenuItem(config);

      expect(menuItem.label).toBe(config.label);
      expect(menuItem.description).toBe(config.description);
      expect(menuItem.location).toBe(config.location);
    });

    describe("onPress behavior", () => {
      it("should handle missing targetId", async () => {
        const config: RemovalMenuConfig = {
          label: "Test",
          description: "Test",
          location: "post",
          rulePattern: "test",
        };

        const menuItem = createRemovalMenuItem(config);
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

        const event = { targetId: undefined };
        const context = {} as any;

        await menuItem.onPress!(event as any, context);

        expect(consoleError).toHaveBeenCalledWith("Menu action has no target.");
        expect(removalHelper.removeWithFetchedRemovalReason).not.toHaveBeenCalled();
        
        consoleError.mockRestore();
      });

      it("should call removeWithFetchedRemovalReason with correct params", async () => {
        const config: RemovalMenuConfig = {
          label: "Test Post Removal",
          description: "Test",
          location: "post",
          rulePattern: "test pattern",
        };

        const menuItem = createRemovalMenuItem(config);
        const event = { targetId: "post_123" };
        const context = {} as any;

        await menuItem.onPress!(event as any, context);

        expect(removalHelper.removeWithFetchedRemovalReason).toHaveBeenCalledWith({
          targetId: "post_123",
          context,
          rulePattern: "test pattern",
          isPost: true,
          footer: undefined,
        });
      });

      it("should call removeWithFetchedRemovalReason for comment", async () => {
        const config: RemovalMenuConfig = {
          label: "Test Comment Removal",
          description: "Test",
          location: "comment",
          rulePattern: "test pattern",
        };

        const menuItem = createRemovalMenuItem(config);
        const event = { targetId: "comment_456" };
        const context = {} as any;

        await menuItem.onPress!(event as any, context);

        expect(removalHelper.removeWithFetchedRemovalReason).toHaveBeenCalledWith({
          targetId: "comment_456",
          context,
          rulePattern: "test pattern",
          isPost: false,
          footer: undefined,
        });
      });

      it("should call footerGenerator and pass result", async () => {
        const footerGenerator = vi.fn(async () => "Custom footer text");
        const config: RemovalMenuConfig = {
          label: "Test with Footer",
          description: "Test",
          location: "post",
          rulePattern: "test",
          footerGenerator,
        };

        const menuItem = createRemovalMenuItem(config);
        const event = { targetId: "post_789" };
        const context = { reddit: {} } as any;

        await menuItem.onPress!(event as any, context);

        expect(footerGenerator).toHaveBeenCalledWith(context, "post_789");
        expect(removalHelper.removeWithFetchedRemovalReason).toHaveBeenCalledWith({
          targetId: "post_789",
          context,
          rulePattern: "test",
          isPost: true,
          footer: "Custom footer text",
        });
      });

      it("should handle errors and show toast", async () => {
        vi.mocked(removalHelper.removeWithFetchedRemovalReason).mockRejectedValueOnce(
          new Error("Test error"),
        );

        const config: RemovalMenuConfig = {
          label: "Test Removal",
          description: "Test",
          location: "post",
          rulePattern: "test",
        };

        const menuItem = createRemovalMenuItem(config);
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        const showToast = vi.fn();
        const event = { targetId: "post_error" };
        const context = { ui: { showToast } } as any;

        await menuItem.onPress!(event as any, context);

        expect(consoleError).toHaveBeenCalledWith(
          "Error processing Test Removal removal:",
          expect.any(Error),
        );
        expect(showToast).toHaveBeenCalledWith(
          "Failed to process Test Removal removal: Error: Test error",
        );

        consoleError.mockRestore();
      });
    });
  });
});
