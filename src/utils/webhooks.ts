/**
 * See: https://discord.com/developers/docs/resources/webhook#execute-webhook-jsonform-params
 * Returns the response so callers can check for HTTP failures.
 * */
export const SendContentToWebhook = async (
  webhookURL: string,
  payload: { content?: string; embeds: Record<string, unknown>[] },
): Promise<Response> => {
  return fetch(webhookURL, {
    method: "post",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};
