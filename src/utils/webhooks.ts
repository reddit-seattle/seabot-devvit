/**
 * See: https://discord.com/developers/docs/resources/webhook#execute-webhook-jsonform-params
 * */
export const SendContentToWebhook = async (
  webhookURL: string,
  payload: { content?: string; embeds?: Record<string, unknown>[] },
) => {
  const response = await fetch(webhookURL, {
    method: "post",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error(`Webhook failed: ${response.status} ${response.statusText}`);
  }
};
