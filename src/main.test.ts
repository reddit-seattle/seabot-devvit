import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AddCommentToRestrictedFlairPost,
  LogCommentReports,
  LogModmailMessage,
  LogPostReport,
  ScheduleWeeklyThreadOnInstall,
  ScheduleWeeklyThreadOnUpgrade,
} from "./triggers/index.js";

// Mock Devvit API first
const mockDevvit = {
  configure: vi.fn(),
  addTrigger: vi.fn(),
  addMenuItem: vi.fn(),
  addSchedulerJob: vi.fn(),
  addSettings: vi.fn(),
};

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
  ScheduleWeeklyThreadOnInstall: {
    event: "AppInstall",
    onEvent: vi.fn(),
  },
  ScheduleWeeklyThreadOnUpgrade: {
    event: "AppUpgrade",
    onEvent: vi.fn(),
  },
}));

vi.mock("./weeklyThread/job.js", () => ({
  CreateWeeklyThreadJob: { name: "createWeeklyThread", onRun: vi.fn() },
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
      redis: true,
      http: {
        domains: [
          "https://api.weather.gov",
          "https://www.wsdot.wa.gov",
          "https://site.api.espn.com",
          "https://lscluster.hockeytech.com",
          "https://www.trumba.com",
        ],
        enabled: true,
      },
    });
  });

  it("should register all triggers dynamically", async () => {
    // Reset modules and clear mocks first
    vi.resetModules();
    mockDevvit.addTrigger.mockClear();

    // Import main to trigger registration
    await import("./main.js");

    expect(mockDevvit.addTrigger).toHaveBeenCalledTimes(6);
    expect(mockDevvit.addTrigger).toHaveBeenCalledWith(LogCommentReports);
    expect(mockDevvit.addTrigger).toHaveBeenCalledWith(LogModmailMessage);
    expect(mockDevvit.addTrigger).toHaveBeenCalledWith(
      AddCommentToRestrictedFlairPost,
    );
    expect(mockDevvit.addTrigger).toHaveBeenCalledWith(LogPostReport);
    expect(mockDevvit.addTrigger).toHaveBeenCalledWith(
      ScheduleWeeklyThreadOnInstall,
    );
    expect(mockDevvit.addTrigger).toHaveBeenCalledWith(
      ScheduleWeeklyThreadOnUpgrade,
    );
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

  it("should register scheduled jobs", async () => {
    vi.resetModules();
    mockDevvit.addSchedulerJob.mockClear();

    const { CreateWeeklyThreadJob } = await import("./weeklyThread/job.js");
    await import("./main.js");

    expect(mockDevvit.addSchedulerJob).toHaveBeenCalledWith(
      CreateWeeklyThreadJob,
    );
  });

  it("should export Devvit as default", async () => {
    const mainModule = await import("./main.js");
    expect(mainModule.default).toBe(mockDevvit);
  });
});
