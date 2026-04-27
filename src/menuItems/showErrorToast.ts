import { Context } from "@devvit/public-api";

/**
 * Logs an error and surfaces a toast to the moderator with a safe fallback message.
 * Avoids the operator-precedence pitfall of `"prefix: " + (error || "Unknown error")`.
 */
export function showErrorToast(
  context: Pick<Context, "ui">,
  action: string,
  error: unknown,
): void {
  console.error(`Failed to ${action}:`, error);
  const message = error instanceof Error ? error.message : "Unknown error";
  context.ui.showToast(`Failed to ${action}: ${message}`);
}
