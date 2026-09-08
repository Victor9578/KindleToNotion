// Notion 推送（对应原 notion_push.py）

const NOTION_VERSION = "2022-06-28";
const NOTION_PAGES_URL = "https://api.notion.com/v1/pages";
const RICH_TEXT_LIMIT = 2000; // Notion rich_text 单段上限

function chunkText(text, size = RICH_TEXT_LIMIT) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks.length ? chunks : [""];
}

function richText(text) {
  return chunkText(text).map((c) => ({ text: { content: c } }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 把高亮逐条写入 Notion 数据库
 * @param {object} env Worker 环境变量（NOTION_TOKEN / NOTION_DATABASE_ID）
 * @param {string} bookTitle 书名
 * @param {Array<{loc: string, content: string}>} highlights
 * @returns {Promise<{ok: number, failed: number}>}
 */
export async function pushHighlights(env, bookTitle, highlights) {
  const headers = {
    Authorization: `Bearer ${env.NOTION_TOKEN}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };

  let ok = 0;
  let failed = 0;

  for (const h of highlights) {
    const data = {
      parent: { database_id: env.NOTION_DATABASE_ID },
      properties: {
        Book: { title: richText(bookTitle) },
        Loc: { rich_text: richText(h.loc) },
        Highlight: { rich_text: richText(h.content) },
      },
    };

    let resp = await fetch(NOTION_PAGES_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });

    // 处理限流（Notion 约 3 req/s），重试一次
    if (resp.status === 429) {
      const retryAfter = Number(resp.headers.get("Retry-After") || 3);
      await sleep(retryAfter * 1000);
      resp = await fetch(NOTION_PAGES_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });
    }

    if (resp.ok) {
      ok++;
    } else {
      failed++;
      console.error(`Notion upload failed at loc=${h.loc}: ${resp.status} ${await resp.text()}`);
    }

    await sleep(350); // 控制速率，避免触发限流
  }

  return { ok, failed };
}
