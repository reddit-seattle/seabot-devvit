import { Devvit } from "@devvit/public-api";
import { menuItems } from "./menuItems/index.js";
import Settings from "./settings.js";
import { triggers } from "./triggers/index.js";
Devvit.configure({
  redditAPI: true,
  http: {
    domains: [
      "https://api-web.nhle.com",  // NHL API
      "https://api.nhle.com",  // NHL REST API
      "https://statsapi.mlb.com",  // MLB stats API
    ],
    enabled: true,
  },
});

/**
 * Dynamically register triggers
 */
triggers.forEach(trigger => {
  Devvit.addTrigger(trigger);
});

/**
 * Dynamically register menu items
 */
menuItems.forEach(menuItem => {
  Devvit.addMenuItem(menuItem);
});

// Add app settings
Devvit.addSettings(Settings);

export default Devvit;
