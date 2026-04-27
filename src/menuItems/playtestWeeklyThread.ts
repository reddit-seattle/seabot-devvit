import { MenuItem } from "@devvit/public-api";
import { createWeeklyThread } from "../weeklyThread/job.js";
import { showErrorToast } from "./showErrorToast.js";

const PlaytestWeeklyThread: MenuItem = {
  label: "Playtest: Post Weekly Thread Now",
  description: "Create the weekly thread immediately for playtesting",
  location: "subreddit",
  forUserType: "moderator",
  onPress: async (_, context) => {
    try {
      await createWeeklyThread(context, { ignoreDedupe: true });
      context.ui.showToast({
        text: "Weekly thread posted for playtest.",
        appearance: "success",
      });
    } catch (error) {
      showErrorToast(context, "create playtest weekly thread", error);
    }
  },
};

export default PlaytestWeeklyThread;
