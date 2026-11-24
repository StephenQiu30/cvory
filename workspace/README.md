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

## 知识库编写规范

1. 原始需求保留用户原话、来源编号和确认日期。调研单独记录证据。后续已裁决的问题回写原需求，并同步引用该结论的报告。
2. 设计按摘要、参与者、背景、目标、使用场景、价值、方案、实施与验收八节组织，说明边界、状态、数据和异常。PRD 在文首指定唯一来源设计，维护故事、接受条件和产品验收场景。执行计划在文首指定唯一来源 PRD，写明工作依赖、文件责任、任务、验证、退出与回退。
3. 每个分类由 `00` 导航和 `meta.json` 登记。正文按 `NN-名称.md` 命名，H1 只写标题。站点从文件名生成展示编号。已使用的文件编号、需求、故事、场景和任务 ID 保持稳定。
4. [项目 BACKLOG](../BACKLOG.md) 维护实施状态。产品承诺、设计建议、待验证假设和实际验收结果分别标注。更新后从[索引](content/index.mdx) 走通上下游链接并验证站点构建。
5. 每条新需求使用 grill-me 指向的 grilling 流程澄清，并按稳定编号在 requirement 中单独维护分析文档。先引用已确认原话，再将可独立决定的问题同轮提出，注明建议和取舍。记录实际答复与日期，依赖该答复的问题放到下一轮。最终回读范围、例外及验收口径，经用户确认后更新下游设计和计划。
