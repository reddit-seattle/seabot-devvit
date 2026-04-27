import { AppInstallDefinition, AppUpgradeDefinition } from "@devvit/public-api";
import { ensureWeeklyThreadJob } from "../weeklyThread/scheduler.js";

export const ScheduleWeeklyThreadOnInstall: AppInstallDefinition = {
  event: "AppInstall",
  onEvent: async (_, context) => {
    await ensureWeeklyThreadJob(context.scheduler);
  },
};

export const ScheduleWeeklyThreadOnUpgrade: AppUpgradeDefinition = {
  event: "AppUpgrade",
  onEvent: async (_, context) => {
    await ensureWeeklyThreadJob(context.scheduler);
  },
};
