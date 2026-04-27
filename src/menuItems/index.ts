import { REMOVAL_MENU_CONFIGS } from "../settings.js";
import CommentNuke from "./commentNuke.js";
import PlaytestWeeklyThread from "./playtestWeeklyThread.js";
import { createRemovalMenuItem } from "./removalMenuFactory.js";
import RestrictPostToFlairedUsers from "./restrictPostToFlairedUsers.js";

// Create quick-removal menu items from config
const removalMenuItems = REMOVAL_MENU_CONFIGS.map(createRemovalMenuItem);

export const menuItems = [
  ...removalMenuItems,
  PlaytestWeeklyThread,
  RestrictPostToFlairedUsers,
  CommentNuke,
];
