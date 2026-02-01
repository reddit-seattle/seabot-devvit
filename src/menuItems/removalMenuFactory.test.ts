import { describe, it, expect, vi } from "vitest";
import { createRemovalMenuItem } from "./removalMenuFactory.js";
import { RemovalMenuConfig } from "../settings.js";

describe("removalMenuFactory", () => {
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
  });
});
