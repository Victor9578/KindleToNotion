// Kindle 标注 HTML 解析（对应原 kindle_parse.py）

function stripTags(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();
}

/**
 * 解析 Kindle 导出的标注 HTML
 * @param {string} text HTML 文本
 * @returns {{ bookTitle: string, highlights: Array<{loc: string, content: string}> }}
 */
export function parseKindleHtml(text) {
  const titleMatch = text.match(/<div class="bookTitle">([\s\S]*?)<\/div>/i);
  const bookTitle = titleMatch ? stripTags(titleMatch[1]) : "Unknown Book";

  const headings = [...text.matchAll(/<div class="noteHeading">([\s\S]*?)<\/div>/gi)].map(
    (m) => m[1]
  );
  const bodies = [...text.matchAll(/<div class="noteText">([\s\S]*?)<\/div>/gi)].map((m) =>
    stripTags(m[1])
  );

  const highlights = [];
  const count = Math.min(headings.length, bodies.length);
  for (let i = 0; i < count; i++) {
    const heading = stripTags(headings[i]);
    // Kindle 的 Location 可能是 "1234" 或 "1234-1250"
    const locMatch = heading.match(/Location\s+(\d+(?:\s*-\s*\d+)?)/i);
    const loc = locMatch
      ? locMatch[1].replace(/\s+/g, "")
      : heading.split(/\s+/).pop() || "";
    const content = bodies[i];
    if (content) highlights.push({ loc, content });
  }

  return { bookTitle, highlights };
}
