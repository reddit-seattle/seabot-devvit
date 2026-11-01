import { Devvit } from "@devvit/public-api";
import { menuItems } from "./menuItems/index.js";
import Settings from "./settings.js";
import { DeliverModerationLog } from "./modlog/queue.js";
import {
  AddCommentToRestrictedFlairPost,
  LogCommentReports,
  LogModmailMessage,
  LogPostReport,
  LogModActions,
  SetupModerationLog,
} from "./triggers/index.js";
Devvit.configure({
  redditAPI: true,
  redis: true,
  http: {
    domains: [
      "discord.com",
      "api-web.nhle.com", // NHL API (reserved for future features)
      "api.nhle.com", // NHL REST API
      "statsapi.mlb.com", // MLB stats API
    ],
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
Devvit.addTrigger(LogModActions);
Devvit.addTrigger(SetupModerationLog);
Devvit.addSchedulerJob(DeliverModerationLog);

/**
 * Register all menu items
 */
menuItems.forEach((menuItem) => {
  Devvit.addMenuItem(menuItem);
});

// Add app settings
Devvit.addSettings(Settings);

export default Devvit;
