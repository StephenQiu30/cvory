# CVory 前端

Next.js 16 App Router、React 19、Tailwind 4、shadcn/Radix、Tiptap。Geist 与 Noto Sans SC 使用本地 Fontsource 包。工程规则见 [PROJECT](../PROJECT.md)，视觉见 [DESIGN](../DESIGN.md)。

## 运行与生成

```bash
pnpm install --frozen-lockfile
pnpm openapi
pnpm lint
pnpm build
BACKEND_INTERNAL_URL=http://127.0.0.1:4321 pnpm dev --port 1234
```

同站点 `/api/` 只转发到 NestJS，默认 `http://127.0.0.1:4321`。构建/启动的后端地址及 `PUBLIC_APP_ORIGIN` 必须匹配实际入口；容器使用 `http://backend:4321`。API 客户端统一由 `backend/openapi.json` 生成到 `src/lib/api/generated/`，不保留 Python 合同或第二个生成 namespace；生成配置负责可空字段与 AIP 冒号。

## 组件与功能边界

- `components/layout/`：共享页面壳、编辑器和设置布局；默认 Server Components。
- `components/ui/`：现有 shadcn/Radix 与语义颜色；状态用 StatusMessage/LoadingState/StatusBadge，不展示服务端错误原文。
- `components/resume/`：共用正文、文件和导出；`lib/resume/` 管理纯内容转换、完整表单默认值及候选校验。
- `app/cvs/[id]/_components/`：编辑、串行自动保存及条件写入、修订历史、模块和样式；Tiptap 按需加载，不另建全局编辑状态。
- `components/account/`：共用账户状态、登录和图片选择；GitHub 授权在新标签页完成后，返回原标签继续，保护编辑中的输入。
- `/settings/github` 仅提供安全绑定与显式读取本人公开仓库；选入简历/主页按 BACKLOG 实施。邮箱恢复和注销关闭入口，保留路由说明；存量账户可以修改密码。

## 制作与本机恢复

正文提供富文本、Markdown 源码和预览，共用受限 JSON。Markdown 文件交换复用相同转换器，保留强调、行内代码、嵌套列表与编号；不支持的格式先保留原输入并提示。DOCX/文字 PDF 上传至 Nest 受限子进程解析，候选展示字段映射、原文片段及 PDF 页码/坐标；确认后另存私有 CV，取消或失败清理原件。候选只在当前页面保留，关闭校对或一小时后清除。扫描 PDF 明确提示暂不支持 OCR，版式与图片不保证导入。转换器随编辑器或文件操作按需加载。完整样本及浏览器验收状态见 [HANDOVER](../HANDOVER.md) 和 [BACKLOG](../BACKLOG.md)。

停止输入后自动保存，组合输入期间暂停；失败、过期和冲突由手动重试恢复。保存并返回会等待后续新修改。经历表单与样式在明确应用前仅保留本机，不当作已保存内容。

恢复候选按账户、CV、格式和标签隔离，显示时间及服务器版本；过时草稿只另存，不自动覆盖。存储不可用或超限会提示，当前内存仍保留；显式退出清理原账户候选并通知其他标签。技术预算和服务端原账户核对见[设计 §7.1](../docs/design/02-CV制作管理与展示设计.md#71-草稿保存与恢复)。本机恢复不能替代跨设备备份。

## 真实浏览器验证

先按 [后端说明](../backend/README.md) 启动隔离 MySQL 夹具（`CVORY_TEST_MYSQL_URL` 由环境提供），再在独立终端：

```bash
BACKEND_INTERNAL_URL=http://127.0.0.1:4323 pnpm dev --hostname 127.0.0.1 --port 3123
CV_TEST_NEST=true CV_TEST_URL=http://127.0.0.1:3123 pnpm exec playwright test
```

先运行 `pnpm exec playwright install chromium`。测试只用合成账户，GitHub 外部边界模拟，不连接真实邮件或投递服务；HTML/Cookie/API/MySQL/文件下载实际执行。输出默认 `/tmp/cvory-browser-results`，不入库。

覆盖工作台、模板、自动保存／最新输入离开／组合输入、本机草稿与跨账户竞态、受限粘贴、照片、JSON/Markdown、实际 PDF、公开筛选/撤回、状态失败及手机访问。`nest-identity.spec.ts` 未设 `CV_TEST_NEST=true` 时跳过，不计通过；服务不可用测试须另启不可用后端的前端并设置 `CV_TEST_UNAVAILABLE_URL`，否则明确跳过。具体结果与未验收项见 [HANDOVER](../HANDOVER.md)。
