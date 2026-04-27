import { beforeEach, describe, expect, it, vi } from "vitest";

const getWeeklyThreadConfig = vi.fn();
const composeWeeklyThreadBody = vi.fn(() => "weekly body");
const fetchWeeklyWeatherPeriods = vi.fn();
const fetchTrafficAlerts = vi.fn();
const fetchUpcomingSeattleSports = vi.fn();
const fetchCityEvents = vi.fn();

vi.mock("./config.js", () => ({
  getWeeklyThreadConfig,
}));

vi.mock("./composeWeeklyThread.js", () => ({
  composeWeeklyThreadBody,
}));

vi.mock("./sources/weather.js", () => ({
  fetchWeeklyWeatherPeriods,
}));

vi.mock("./sources/traffic.js", () => ({
  fetchTrafficAlerts,
}));

vi.mock("./sources/sports.js", () => ({
  fetchUpcomingSeattleSports,
}));
vi.mock("./sources/events.js", () => ({
  fetchCityEvents,
}));

describe("weeklyThread/job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips posting when the current week is already claimed", async () => {
    getWeeklyThreadConfig.mockResolvedValue({
      enabled: true,
      titleTemplate: "Weekly thread",
      header: "",
      footer: "",
    });

    const { CreateWeeklyThreadJob } = await import("./job.js");

    const context = {
      settings: {
        get: vi.fn().mockResolvedValue(undefined),
      },
      redis: {
        set: vi.fn().mockResolvedValue(undefined),
        del: vi.fn(),
      },
      reddit: {
        getCurrentSubreddit: vi.fn().mockResolvedValue({
          name: "Seattle",
          numberOfSubscribers: 10,
          numberOfActiveUsers: 5,
        }),
        submitPost: vi.fn(),
      },
    };

    await CreateWeeklyThreadJob.onRun(undefined, context as never);

    expect(context.reddit.submitPost).not.toHaveBeenCalled();
    expect(fetchWeeklyWeatherPeriods).not.toHaveBeenCalled();
  });

  it("can bypass dedupe for manual playtesting", async () => {
    getWeeklyThreadConfig.mockResolvedValue({
      enabled: true,
      titleTemplate: "Weekly thread",
      header: "",
      footer: "",
    });
    fetchWeeklyWeatherPeriods.mockResolvedValue([]);
    fetchTrafficAlerts.mockResolvedValue([]);
    fetchUpcomingSeattleSports.mockResolvedValue([]);
    fetchCityEvents.mockResolvedValue([]);

    const distinguish = vi.fn();
    const sticky = vi.fn();
    const submitPost = vi.fn().mockResolvedValue({
      id: "t3_test",
      distinguish,
      sticky,
    });

    const { createWeeklyThread } = await import("./job.js");

    const context = {
      settings: {
        get: vi.fn().mockResolvedValue(undefined),
      },
      redis: {
        set: vi.fn(),
        del: vi.fn(),
      },
      reddit: {
        getCurrentSubreddit: vi.fn().mockResolvedValue({
          name: "Seattle",
          numberOfSubscribers: 10,
          numberOfActiveUsers: 5,
        }),
        getPostFlairTemplates: vi.fn().mockResolvedValue([]),
        submitPost,
      },
    };

    await createWeeklyThread(context as never, { ignoreDedupe: true });

    expect(context.redis.set).not.toHaveBeenCalled();
    expect(submitPost).toHaveBeenCalled();
    expect(distinguish).toHaveBeenCalled();
    expect(sticky).toHaveBeenCalledWith(1);
  });
});
