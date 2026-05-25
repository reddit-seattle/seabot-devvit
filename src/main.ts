import { Devvit } from "@devvit/public-api";
import { menuItems } from "./menuItems/index.js";
import Settings from "./settings.js";
import {
  AddCommentToRestrictedFlairPost,
  AutomodFilterComment,
  AutomodFilterPost,
  LogCommentDelete,
  LogCommentReports,
  LogModmailMessage,
  LogPostDelete,
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

// Log when a comment is reported
Devvit.addTrigger(LogCommentReports);

// Log when a post is reported
Devvit.addTrigger(LogPostReport);

// Log when a modmail message is received
Devvit.addTrigger(LogModmailMessage);

// Add a stickied comment to posts that get "restricted flair"
Devvit.addTrigger(AddCommentToRestrictedFlairPost);

// Log when automod removes a comment
Devvit.addTrigger(AutomodFilterComment);

// Log when automod removes a post
Devvit.addTrigger(AutomodFilterPost);

// Log when a post is deleted
Devvit.addTrigger(LogPostDelete);

// Log when a comment is deleted
Devvit.addTrigger(LogCommentDelete);

/**
 * Register all menu items
 */
menuItems.forEach((menuItem) => {
  Devvit.addMenuItem(menuItem);
});

// Add app settings
Devvit.addSettings(Settings);

export default Devvit;
