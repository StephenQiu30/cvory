# 项目接手文档

本文件只保留最近一次阶段记录。任务状态见 [BACKLOG](BACKLOG.md)。

## 简序 · CVory 品牌与前端规范

日期：2026-11-01（Asia/Shanghai）。负责人选择「简序 · CVory」和 B 方案图形，要求黑白灰、Geist 及前端设计规范，并请求技术推荐。[来源 07](docs/requirement/07-简序命名视觉与技术选型补充.md)保留原文，来源 01～03、05～06 不改动。

交付：

- [DESIGN](DESIGN.md)是视觉与交互的唯一入口：黑白灰语义颜色、Geist 与中文搭配、字号、空间、组件状态、键盘焦点、窄屏编辑、导入校对及保存反馈。具体色值、尺寸、中文字体为建议基线，未冒充负责人逐项确认。
- 使用内置 image_gen 以已选 B 图形生成[黑白 Logo 概念](docs/assets/branding/CVory-黑白Logo概念.png)，[完整编辑提示词](docs/assets/branding/CVory-黑白Logo生成说明.json)可复核。原候选图保留，选择状态已登记；PNG 不等于 SVG，图中字形不证明已使用真实 Geist 文件。
- [统一需求第 10 节](docs/requirement/04-个人CV制作与管理需求说明.md#10-技术选型建议)集中推荐 Next.js 单应用、Tailwind/shadcn、Tiptap、Drizzle 与 Chromium 打印；比较持久磁盘 SQLite 与 Vercel 远端数据库，部署尚未选定。
- 富文本建议以 JSON 直接渲染预览、公开页与打印内容，Markdown 保留为同一内容的输入/交换语法，避免展示强制经历往返转换。DOCX/PDF 导入解析与人工校对分别处理。
- README、PROJECT、AGENTS、文档管理设计及导航同步。目录名保持 CV，技术包名未选定。不建立产品 PRD、Plan 或应用代码。

证据：通过 Vercel 插件、Context7 与官方文档核对 Geist、Next.js、Tiptap 和 shadcn；参考 Geist 色彩与排版，并非逐项复制其变量。Vercel 插件对 SQLite 检索主要返回 Sandbox 内容，不用它证明 Functions 持久化；SQLite 约束由官方知识库搜索结果核对。该知识库页面直接读取失败，搜索摘要可用。来源集中在 DESIGN 及需求第 10 节。

验证：26 份 Markdown、203 个仓库相对链接及路径大小写、28 个锚点、14 份 JSON 检查通过；需求编号 00～07 与统一说明第 1～11 章连续。5 份既有原始来源 SHA-256 与修改前一致；其中原有 2 处仓库外技能路径按来源保护保留，不作为仓库相对链接。黑白 PNG 可读，尺寸 1536 × 1024。静态色值计算：正文黑/白 17.93:1，次要文字/浅灰 5.27:1，控件边界/近白 3.31:1；这些结果不代替真实页面验收。

没有工程运行、真实页面或字体/PDF 验收。Logo 矢量精修、真实 Geist 字标、小尺寸图标及工程技术选择尚未完成。未初始化 Git，无提交、推送或部署；个人 Obsidian 布局未改动。
