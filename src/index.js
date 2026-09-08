// Kindle → Notion Telegram Bot（Cloudflare Worker 版）
// 原 Python 长轮询方案改为 Webhook 模式：
//   GET  /setup                        → 自动向 Telegram 注册 webhook
//   POST /telegram/<WEBHOOK_SECRET>    → 接收 Telegram 推送的 update

import { parseKindleHtml } from "./kindle.js";
import { pushHighlights } from "./notion.js";
import {
  tgFetch,
  getTelegramFile,
  downloadTelegramFileText,
  sendMessage,
} from "./telegram.js";

async function handleUpdate(update, env) {
  const message = update.message;
  if (!message || !message.document) return;

  const chatId = message.chat.id;
  const doc = message.document;

  try {
    await sendMessage(env, chatId, `开始处理文件 ${doc.file_name} ...`);

    // 1. 下载文件
    const file = await getTelegramFile(env, doc.file_id);
    const html = await downloadTelegramFileText(env, file.file_path);

    // 2. 解析高亮
    const { bookTitle, highlights } = parseKindleHtml(html);
    if (highlights.length === 0) {
      await sendMessage(env, chatId, "未解析到任何高亮，请确认是 Kindle 导出的 HTML 文件。");
      return;
    }

    // 3. 推送到 Notion
    const { ok, failed } = await pushHighlights(env, bookTitle, highlights);

    await sendMessage(
      env,
      chatId,
      `《${bookTitle}》共 ${highlights.length} 条高亮，成功上传 ${ok} 条${failed ? `，失败 ${failed} 条` : ""}。`
    );
  } catch (err) {
    console.error(err);
    await sendMessage(env, chatId, `处理失败：${err.message}`);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 注册 webhook（部署后浏览器访问一次即可）
    if (request.method === "GET" && url.pathname === "/setup") {
      if (!env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response("TELEGRAM_WEBHOOK_SECRET 未配置", { status: 500 });
      }
      const webhookUrl = `${url.origin}/telegram/${env.TELEGRAM_WEBHOOK_SECRET}`;
      const result = await tgFetch(env, "setWebhook", {
        url: webhookUrl,
        secret_token: env.TELEGRAM_WEBHOOK_SECRET,
        drop_pending_updates: true,
      });
      return Response.json({ webhookUrl, result });
    }

    // 接收 Telegram webhook 推送
    if (request.method === "POST" && url.pathname.startsWith("/telegram/")) {
      const secret = decodeURIComponent(url.pathname.split("/").pop());
      // 双重校验：路径中的 secret + Telegram 回传的 secret header
      if (
        secret !== env.TELEGRAM_WEBHOOK_SECRET ||
        request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.TELEGRAM_WEBHOOK_SECRET
      ) {
        return new Response("Forbidden", { status: 403 });
      }

      const update = await request.json();
      ctx.waitUntil(handleUpdate(update, env)); // 先回 200，避免 Telegram 超时重推
      return new Response("ok");
    }

    return new Response("Kindle → Notion Telegram Bot (Cloudflare Worker)");
  },
};
