import { MenuItem } from "@devvit/public-api";
import { removeWithReason } from "../utils/removalHelper.js";

const RemoveAskSeattle: MenuItem = {
  label: "Remove for r/AskSeattle",
  description: "Remove post and apply Rule 5: Use r/AskSeattle for recommendations",
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
        ruleSearchTerms: ["askseattle", "recommendations", "rule 5"],
        modNote: "Removed via AskSeattle macro - Rule 5 violation",
        isPost: true
      });
    } catch (error) {
      console.error("Error processing r/AskSeattle removal:", error);
      context.ui.showToast("Failed to process r/AskSeattle removal: " + (error || "Unknown error"));
    }
  },
};

export default RemoveAskSeattle;
