# 项目交接记录

## PDF/PNG 导出实现

- 新增 `GET /api/cvs/:id/png?etag=...`。PNG 从固定 etag 生成的同一份 PDF 逐页渲染；144 DPI，单页返回 PNG，多页按页码打包 ZIP。保存结果、账户和 CV 所有权在生成前后核对。
- 渲染运行在 PDF.js Node Canvas 子进程中：最多 30 页，单页边长不超过 4,096 px、单页像素不超过 4,000,000、总像素不超过 64,000,000、输出不超过 50 MiB；V8 堆 256 MiB、45 秒超时，和其他文件任务共用两个子进程名额。客户端断开会终止渲染进程。
- 前端导出选择中加入 PNG；按响应类型下载 `.png` 或 `.zip`，显示页数及尺寸。OpenAPI 和生成客户端已同步。技术预算见[设计 02 §3、§4.3](docs/design/02-CV制作管理与展示设计.md)。

## 工程检查与验收边界

- 后端 `pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm build`、`pnpm openapi` 通过；前端 `pnpm openapi`、`pnpm build` 通过，`pnpm lint` 为 0 错误、1 个既有 `postcss.config.mjs` 匿名默认导出警告；`git diff --check` 通过。
- 未运行测试套件、真实浏览器、合成 PDF/PNG 样本或目标容器验收。因此 PDF/PNG 实际文件质量、页数/顺序/尺寸、字体图片故障、取消/超限资源清理和部署拓扑尚未验收；PRD 06 不标记完成。
- 未运行数据库迁移、部署或真实平台动作；远端 CI 尚未配置，推送后仍需区分远端状态与本地检查结果。

下一项按 [BACKLOG](BACKLOG.md) 继续。
