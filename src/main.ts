import { Devvit } from "@devvit/public-api";
import { menuItems } from "./menuItems/index.js";
import Settings from "./settings.js";
import {
  AddCommentToRestrictedFlairPost,
  LogCommentReports,
  LogModmailMessage,
  LogPostReport,
  ScheduleWeeklyThreadOnInstall,
  ScheduleWeeklyThreadOnUpgrade,
} from "./triggers/index.js";
import { EXTERNAL_HTTP_DOMAINS } from "./weeklyThread/api.js";
import { CreateWeeklyThreadJob } from "./weeklyThread/job.js";
Devvit.configure({
  redditAPI: true,
  redis: true,
  http: {
    domains: EXTERNAL_HTTP_DOMAINS,
    enabled: true,
  },
});

/**
 * Register triggers
 */
Devvit.addTrigger(LogCommentReports);
Devvit.addTrigger(LogModmailMessage);
Devvit.addTrigger(AddCommentToRestrictedFlairPost);
Devvit.addTrigger(LogPostReport);
Devvit.addTrigger(ScheduleWeeklyThreadOnInstall);
Devvit.addTrigger(ScheduleWeeklyThreadOnUpgrade);
Devvit.addSchedulerJob(CreateWeeklyThreadJob);

/**
 * Register all menu items
 */
menuItems.forEach((menuItem) => {
  Devvit.addMenuItem(menuItem);
});

// Add app settings
Devvit.addSettings(Settings);

export default Devvit;
