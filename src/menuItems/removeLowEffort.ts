import { MenuItem } from "@devvit/public-api";
import { removeWithReason } from "../utils/removalHelper.js";

const RemoveLowEffort: MenuItem = {
  label: "Remove for Low-Effort Content",
  description: "Remove post and apply Rule 4: No low-effort content",
  location: "post",
  forUserType: "moderator",
  onPress: async (event, context) => {
    const { targetId } = event;
    if (!targetId) {
      console.error("Menu action has no target.");
      return;
    }

    try {
      await removeWithReason({
        targetId,
        context,
        ruleSearchTerms: ["low-effort", "low effort", "rule 4"],
        isPost: true
      });
    } catch (error) {
      console.error("Error processing low-effort content removal:", error);
      context.ui.showToast("Failed to process low-effort content removal: " + (error || "Unknown error"));
    }
  },
};

export default RemoveLowEffort;
