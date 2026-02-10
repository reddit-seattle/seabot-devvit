/**
 * See: https://discord.com/developers/docs/resources/webhook#execute-webhook-jsonform-params
 * */
export const SendContentToWebhook = async (
  webhookURL: string,
  payload: { content?: string; embeds: Record<string, unknown>[] },
) => {
  await fetch(webhookURL, {
    method: "post",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};
