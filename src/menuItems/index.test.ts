import { describe, it, expect } from "vitest";
import { menuItems } from "./index.js";

describe("menuItems index", () => {
  it("should export all menu items", () => {
    expect(menuItems).toBeDefined();
    expect(Array.isArray(menuItems)).toBe(true);
    expect(menuItems).toHaveLength(6);

    // Verify each menu item has the required properties
    menuItems.forEach((item) => {
      expect(item).toHaveProperty("label");
      expect(item).toHaveProperty("onPress");
      expect(typeof item.onPress).toBe("function");
    });
  });

  it("should include all expected menu items", () => {
    const labels = menuItems.map((item) => item.label);
    expect(labels).toContain("Remove: AskSeattle");
    expect(labels).toContain("Remove: Be Good");
    expect(labels).toContain("Remove: Not Seattle-Related");
    expect(labels).toContain("Playtest: Post Weekly Thread Now");
    expect(labels).toContain("Require Flair for Comments");
    expect(labels).toContain("Comment Nuke");
  });
});
