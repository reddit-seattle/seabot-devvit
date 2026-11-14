import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AddCommentToRestrictedFlairPost,
  LogCommentReports,
  LogModmailMessage,
  LogPostReport,
  LogFirstShadowban,
} from "./triggers/index.js";
import {
  ShadowbanWarmup,
  startShadowbanWarmup,
} from "./triggers/warmShadowbanCache.js";

// Mock Devvit API first
const mockDevvit = {
  configure: vi.fn(),
  addTrigger: vi.fn(),
  addMenuItem: vi.fn(),
  addSettings: vi.fn(),
  addSchedulerJob: vi.fn(),
};

vi.mock("./triggers/warmShadowbanCache.js", () => ({
  ShadowbanWarmup: { name: "shadowban-warmup", onRun: vi.fn() },
  startShadowbanWarmup: vi.fn(),
}));

vi.mock("@devvit/public-api", () => ({
  Devvit: mockDevvit,
}));

// Mock the external modules
vi.mock("./menuItems/index.js", () => ({
  menuItems: [
    { label: "Test Menu Item 1", onPress: vi.fn() },
    { label: "Test Menu Item 2", onPress: vi.fn() },
  ],
}));

vi.mock("./triggers/index.js", () => ({
  LogCommentReports: { event: "CommentReport", onEvent: vi.fn() },
  LogModmailMessage: { event: "ModMail", onEvent: vi.fn() },
  AddCommentToRestrictedFlairPost: {
    event: "PostFlairUpdate",
    onEvent: vi.fn(),
  },
  LogPostReport: { event: "PostReport", onEvent: vi.fn() },
  LogFirstShadowban: { event: "ModAction", onEvent: vi.fn() },
}));

vi.mock("./settings.js", () => ({
  default: [
    { name: "testSetting1", type: "string" },
    { name: "testSetting2", type: "boolean" },
  ],
}));

describe("main.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should configure Devvit with correct settings", async () => {
    // Import main to trigger configuration
    await import("./main.js");

    expect(mockDevvit.configure).toHaveBeenCalledWith({
      redditAPI: true,
      http: {
        domains: [
          "discord.com",
          "https://api-web.nhle.com",
          "https://api.nhle.com",
          "https://statsapi.mlb.com",
        ],
        enabled: true,
      },
    });
  });

  it("should register all triggers dynamically", async () => {
    // Reset modules and clear mocks first
    vi.resetModules();
    mockDevvit.addTrigger.mockClear();
    mockDevvit.addSchedulerJob.mockClear();

    // Import main to trigger registration
    await import("./main.js");

    expect(mockDevvit.addTrigger).toHaveBeenCalledTimes(6);
    expect(mockDevvit.addTrigger).toHaveBeenCalledWith({
      events: ["AppInstall", "AppUpgrade"],
      onEvent: startShadowbanWarmup,
    });
    expect(mockDevvit.addTrigger).toHaveBeenCalledWith(LogFirstShadowban);
    expect(mockDevvit.addSchedulerJob).toHaveBeenCalledTimes(1);
    expect(mockDevvit.addSchedulerJob).toHaveBeenCalledWith(ShadowbanWarmup);
    expect(mockDevvit.addTrigger).toHaveBeenCalledWith(LogCommentReports);
    expect(mockDevvit.addTrigger).toHaveBeenCalledWith(LogModmailMessage);
    expect(mockDevvit.addTrigger).toHaveBeenCalledWith(
      AddCommentToRestrictedFlairPost,
    );
    expect(mockDevvit.addTrigger).toHaveBeenCalledWith(LogPostReport);
  });

  it("should register all menu items dynamically", async () => {
    // Clear module cache to ensure fresh import
    vi.resetModules();
    // Reset mock call history
    mockDevvit.addMenuItem.mockClear();

    const { menuItems } = await import("./menuItems/index.js");
    await import("./main.js");

    expect(mockDevvit.addMenuItem).toHaveBeenCalledTimes(menuItems.length);
    menuItems.forEach((menuItem) => {
      expect(mockDevvit.addMenuItem).toHaveBeenCalledWith(menuItem);
    });
  });

  it("should add settings to Devvit", async () => {
    // Clear module cache to ensure fresh import
    vi.resetModules();
    // Reset mock call history
    mockDevvit.addSettings.mockClear();

    const Settings = (await import("./settings.js")).default;
    await import("./main.js");

    expect(mockDevvit.addSettings).toHaveBeenCalledWith(Settings);
  });

  it("should export Devvit as default", async () => {
    const mainModule = await import("./main.js");
    expect(mainModule.default).toBe(mockDevvit);
  });
});
