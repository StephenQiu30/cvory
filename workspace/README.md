# 简序知识库服务

用 Next.js 和 Fumadocs 发布 `content/` 中的 CVory 文档。支持目录导航、全文搜索、页面 Markdown、全文索引、页面预览图和 Mermaid 图表。

## 本机运行

在仓库根目录启动：

```sh
docker compose up -d --build --wait workspace
```

[知识库首页](http://127.0.0.1:1230/docs) 默认仅在本机开放。需要更换端口时，可在命令前设置 `WORKSPACE_PORT`。对外使用其他阅读地址时，构建前设置 `WORKSPACE_PUBLIC_URL`，页面分享预览图将使用该地址。更新正文后用同一条命令重新构建。

## 开发与验证

在 `workspace/` 使用 Node.js 24 和项目锁定的 pnpm 版本：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

开发服务器默认使用 3000 端口。运行 `pnpm lint`、`pnpm types:check`、`pnpm format:check` 和 `pnpm build` 检查工程。对运行中的服务执行 `pnpm exec playwright install chromium` 和 `pnpm test:e2e`。端到端测试默认访问 1230 端口，其他地址可通过 `WORKSPACE_BASE_URL` 指定。

## 内容与阅读入口

- [知识库索引](content/index.mdx) 和各目录的 `meta.json` 维护导航。普通页面用 Markdown，章节之间使用相对文档链接。
- 截图放在 `public/research/`，正文引用 `/research/文件名.png`。
- `/docs` 提供网页阅读，`/api/search` 提供搜索，同一文档 URL 加 `.md` 可读 Markdown。`/llms.txt` 和 `/llms-full.txt` 分别提供索引和全文。
