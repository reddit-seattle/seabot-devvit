import type { ModAction, TriggerContext } from "@devvit/public-api";
import { SHADOWBAN_CONFIG } from "../settings.js";

const COMMENT_REMOVAL = "removecomment";
export const SEEN_VALUE = "1";
export const SEEN = "shadowban:seen";
export const WARMUP_STATE = "shadowban:warmup";

export function qualifyingAuthor(action: ModAction): string | undefined {
  const author = action.target?.author;
  return action.type === COMMENT_REMOVAL &&
    action.moderatorName.toLowerCase() ===
      SHADOWBAN_CONFIG.moderatorName.toLowerCase() &&
    (action.details === SHADOWBAN_CONFIG.removalReason ||
      action.description === SHADOWBAN_CONFIG.removalReason) &&
    author &&
    !author.startsWith("[")
    ? author
    : undefined;
}

export function getRemovalLog(context: TriggerContext, after?: string) {
  return context.reddit.getModerationLog({
    subredditName: context.subredditName!,
    moderatorUsernames: [SHADOWBAN_CONFIG.moderatorName],
    type: COMMENT_REMOVAL,
    pageSize: SHADOWBAN_CONFIG.pageSize,
    after,
  });
}
