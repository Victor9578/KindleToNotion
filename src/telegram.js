// Telegram Bot API 工具（Webhook 模式下无需长轮询）

/**
 * 调用 Telegram Bot API
 */
export async function tgFetch(env, method, params) {
  const resp = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return resp.json();
}

/**
 * 获取文件元信息（含 file_path）
 */
export async function getTelegramFile(env, fileId) {
  const data = await tgFetch(env, "getFile", { file_id: fileId });
  if (!data.ok) throw new Error(`getFile failed: ${JSON.stringify(data)}`);
  return data.result;
}

/**
 * 下载 Bot 服务器上的文件内容（文本）
 */
export async function downloadTelegramFileText(env, filePath) {
  const resp = await fetch(
    `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`
  );
  if (!resp.ok) throw new Error(`download failed: ${resp.status}`);
  return resp.text();
}

/**
 * 向用户发送回复消息
 */
export async function sendMessage(env, chatId, text) {
  await tgFetch(env, "sendMessage", { chat_id: chatId, text });
}
