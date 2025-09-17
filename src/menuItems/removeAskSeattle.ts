import { MenuItem } from "@devvit/public-api";
import { removeWithReason } from "../utils/removalHelper.js";
import { createResubmissionLink } from "../utils/reddithelpers.js";

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
      // Get the post to generate resubmission link
      const post = await context.reddit.getPostById(targetId);
      const { title, url, body } = post;
      
      const footer = createResubmissionLink("AskSeattle", title, url, body);

      await removeWithReason({
        targetId,
        context,
        ruleSearchTerms: ["askseattle", "rule 5"],
        isPost: true,
        footer
      });
    } catch (error) {
      console.error("Error processing r/AskSeattle removal:", error);
      context.ui.showToast("Failed to process r/AskSeattle removal: " + (error || "Unknown error"));
    }
  },
};

export default RemoveAskSeattle;
