import { Devvit } from "@devvit/public-api";
import { menuItems } from "./menuItems/index.js";
import Settings from "./settings.js";
import {
  ShadowbanWarmup,
  startShadowbanWarmup,
} from "./triggers/warmShadowbanCache.js";
import {
  AddCommentToRestrictedFlairPost,
  LogCommentReports,
  LogModmailMessage,
  LogPostReport,
  LogFirstShadowban,
} from "./triggers/index.js";
Devvit.configure({
  redditAPI: true,
  http: {
    domains: [
      "discord.com", // Moderation alerts
      "https://api-web.nhle.com", // NHL API
      "https://api.nhle.com", // NHL REST API
      "https://statsapi.mlb.com", // MLB stats API
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
Devvit.addTrigger(LogFirstShadowban);
Devvit.addSchedulerJob(ShadowbanWarmup);
Devvit.addTrigger({
  events: ["AppInstall", "AppUpgrade"],
  onEvent: startShadowbanWarmup,
});

/**
 * Register all menu items
 */
menuItems.forEach((menuItem) => {
  Devvit.addMenuItem(menuItem);
});

// Add app settings
Devvit.addSettings(Settings);

export default Devvit;
