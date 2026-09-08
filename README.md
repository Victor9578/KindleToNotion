# KindleToNotion

把 Kindle 导出的标注 HTML 发给 Telegram Bot，自动解析高亮并上传到 Notion。
基于 **Cloudflare Workers**（Webhook 模式，免服务器常驻）。

[我的示例](https://tasks-jw.notion.site/ae21f75cc76d43b6803060f531f5e220?pvs=4)

## 项目结构

```
├── wrangler.toml      # Worker 配置（入口 src/index.js）
├── package.json
└── src/
    ├── index.js       # 入口：/setup 注册 webhook，/telegram/<secret> 收消息
    ├── kindle.js      # 解析 Kindle 标注 HTML
    ├── notion.js      # 推送高亮到 Notion（限流重试 + 长文本分段）
    └── telegram.js    # Telegram API 工具
```

## 工作原理

Workers 无法跑长轮询，所以用 **Telegram Webhook** 模式：

1. 访问 `https://<worker域名>/setup` → Worker 调用 Telegram `setWebhook` 注册回调地址；
2. 之后用户把 HTML 文件发给 Bot，Telegram 把 update POST 到 `/telegram/<TELEGRAM_WEBHOOK_SECRET>`；
3. Worker 校验 secret（路径 + `X-Telegram-Bot-Api-Secret-Token` 双重校验）后下载文件、解析、逐条写入 Notion，并把结果回复给用户。

## 环境变量（全部以 Secret 形式配置，不要写进代码）

| 变量 | 说明 |
|---|---|
| `TELEGRAM_BOT_TOKEN` | BotFather 签发的 Bot Token |
| `TELEGRAM_WEBHOOK_SECRET` | 自定的随机字符串，用于校验 webhook 来源 |
| `NOTION_TOKEN` | Notion 内部集成密钥 |
| `NOTION_DATABASE_ID` | Notion 数据库 ID（页面 URL 中 32 位 hex） |

Notion 数据库需包含三个属性：`Book`（Title）、`Loc`（Rich text）、`Highlight`（Rich text）。

## 部署方式一：绑定 GitHub 自动部署（推荐）

1. Cloudflare 控制台 → **Workers & Pages** → **Create** → **Workers** → **Import from Git**；
2. 授权并选择本仓库，构建设置：
   - **Build command**：`npx wrangler deploy`
   - **Deploy command**：留空
   - **Root directory**：留空（仓库根目录）
3. 首次部署完成后，到 Worker 的 **Settings → Variables and Secrets** 添加上表 4 个 Secret，**Save and Deploy**；
4. 之后每次 `git push` 到 `main` 分支即自动重新构建部署。

## 部署方式二：本地 wrangler 命令行

```powershell
npm install

npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put NOTION_TOKEN
npx wrangler secret put NOTION_DATABASE_ID

npx wrangler deploy
```

## 本地调试

```powershell
# 在项目根目录创建 .dev.vars（已被 .gitignore 忽略）：
#   TELEGRAM_BOT_TOKEN=...
#   TELEGRAM_WEBHOOK_SECRET=test-secret
#   NOTION_TOKEN=...
#   NOTION_DATABASE_ID=...

npx wrangler dev
```

## 使用

1. 部署后浏览器访问一次 `https://<worker域名>/setup` 注册 webhook；
2. 从 Kindle 导出笔记 HTML（网页端「内容和管理设备 → 批量操作 → 导出笔记」）；
3. 把该 HTML 文件发给 Telegram Bot，等待解析上传结果。
