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
 * Dynamically register all triggers
 */
triggers.forEach(trigger => {
  Devvit.addTrigger(trigger);
});

/**
 * Dynamically register all menu items
 */
menuItems.forEach(menuItem => {
  Devvit.addMenuItem(menuItem);
});

// Add settings to the app
Devvit.addSettings(Settings);

export default Devvit;
