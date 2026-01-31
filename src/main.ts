import { Devvit } from "@devvit/public-api";
import { menuItems } from "./menuItems/index.js";
import Settings from "./settings.js";
import {
  AddCommentToRestrictedFlairPost,
  LogCommentReports,
  LogModmailMessage,
  LogPostReport,
} from "./triggers/index.js";
Devvit.configure({
  redditAPI: true,
  http: {
    // You can ignore this. These endpoints are not used currently...
    domains: [
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

/**
 * Register all menu items
 */
menuItems.forEach((menuItem) => {
  Devvit.addMenuItem(menuItem);
});

// Add app settings
Devvit.addSettings(Settings);

export default Devvit;
