import { Devvit } from "@devvit/public-api";
import Settings from "./settings.js";
import LogCommentDefinition from "./triggers/commentReports.js";
import LogModmailMessage from "./triggers/modmail.js";
import RestrictPostToFlairedUsers from "./triggers/modMenuItems.js";
import AddCommentToRestrictedFlairPost from "./triggers/postFlair.js";
import LogPostReport from "./triggers/postReports.js";

Devvit.configure({
  redditAPI: true,
  http: {
    domains: [
      "https://api-web.nhle.com",  // NHL API
      "https://api.nhle.com/stats/rest",  // NHL REST API
      "https://statsapi.mlb.com/api/",  // MLB stats API
    ],
    enabled: true,
  },
});

/**
 * Logs modmail messages
 * Requires setting the MODMAIL_REPORT_WEBHOOK in the app settings to a Discord webhook URL.
 */
Devvit.addTrigger(LogModmailMessage);
/**
 * Logs post reports
 * Requires setting the POST_REPORT_WEBHOOK in the app settings to a Discord webhook URL.
 */
Devvit.addTrigger(LogPostReport);
/**
 * Logs comment reports
 * Requires setting the COMMENT_REPORT_WEBHOOK in the app settings to a Discord webhook URL.
 */
Devvit.addTrigger(LogCommentDefinition);
/**
 * Post flair trigger that adds, stickies, and locks a comment on posts with a specific flair text.
 * Requires setting the RESTRICTED_FLAIR_TEXT in the app settings to the desired flair text.
 */
Devvit.addTrigger(AddCommentToRestrictedFlairPost);

/**
 * Adds a menu item to automatically apply "restricted flair" to posts.
 */
Devvit.addMenuItem(RestrictPostToFlairedUsers);

// Add settings to the app
Devvit.addSettings(Settings);

export default Devvit;
