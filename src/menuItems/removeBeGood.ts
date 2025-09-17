import { MenuItem } from "@devvit/public-api";
import { removeWithReason } from "../utils/removalHelper.js";

const RemoveBeGood: MenuItem = {
    label: "Remove for Be Good",
    description: "Remove comment and apply Rule 1: Be Good",
    location: "comment",
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
                ruleSearchTerms: ["be good", "rule 1"],
                isPost: false
            });
        } catch (error) {
            console.error("Error processing Be Good removal:", error);
            context.ui.showToast("Failed to process Be Good removal: " + (error || "Unknown error"));
        }
    },
};

export default RemoveBeGood;
