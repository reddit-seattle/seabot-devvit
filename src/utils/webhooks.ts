export const SendContentToWebhook = async (
  webhookURL: string,
  payload: { content?: string; embeds: { [id: string]: any }[] }
) => {
  // https://discord.com/developers/docs/resources/webhook#execute-webhook-jsonform-params
  await fetch(webhookURL, {
    method: "post",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};
