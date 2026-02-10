import { MenuItem } from "@devvit/public-api";
import { removeWithFetchedRemovalReason } from "../utils/removalHelper.js";
import { RemovalMenuConfig } from "../settings.js";

/**
 * Creates a menu item from a removal configuration
 */
export function createRemovalMenuItem(config: RemovalMenuConfig): MenuItem {
  return {
    label: config.label,
    description: config.description,
    location: config.location,
    forUserType: "moderator",
    onPress: async (event, context) => {
      const { targetId } = event;
      if (!targetId) {
        console.error("Menu action has no target.");
        return;
      }

      try {
        // Generate footer if needed
        const footer = config.footerGenerator
          ? await config.footerGenerator(context, targetId)
          : undefined;

        await removeWithFetchedRemovalReason({
          targetId,
          context,
          rulePattern: config.rulePattern,
          isPost: config.location === "post",
          footer,
        });
      } catch (error) {
        console.error(`Error processing ${config.label} removal:`, error);
        context.ui.showToast(
          `Failed to process ${config.label} removal: ` +
            (error || "Unknown error"),
        );
      }
    },
  };
}
