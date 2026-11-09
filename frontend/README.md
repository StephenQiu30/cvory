# CVory 前端

Next.js 16 App Router、React 19、Tailwind 4、shadcn/Radix、React Hook Form 与按需加载的 Tiptap。Geist 与 Noto Sans SC 通过本地 Fontsource Variable 包提供，中文按 Unicode range 加载。项目工程规则见 [PROJECT](../PROJECT.md)，视觉与交互见 [DESIGN](../DESIGN.md)。

## 运行

在 `frontend/` 执行：

```bash
pnpm install --frozen-lockfile
pnpm run openapi
pnpm lint
pnpm build
pnpm dev
```

后端默认 `http://127.0.0.1:8000`，通过 `BACKEND_INTERNAL_URL` 配置；同站点 `/api/` 转发到 FastAPI，生产构建时也应设置此变量。OpenAPI 文件由后端生成，客户端不手改。生成器配置负责保留 AIP 自定义动作的冒号。

## 组件边界

- `components/layout/`：BasicLayout、Header、Navbar、Content、Footer、独立 EditorLayout 与 SettingsLayout；路由壳默认使用 Server Components。
- `components/ui/`：项目内 shadcn/Radix 基础控件与统一表单、状态反馈，Lucide 矢量图标。
- 状态反馈：`StatusMessage` 区分错误、成功、说明与处理中，`LoadingState` 组合状态文字与 Skeleton，`StatusBadge` 展示保存／发布状态；页面异常与不可用结果复用 `StatusPage`。API 状态码的中文提示集中在 `lib/api/error-message.ts`，不展示服务端错误原文。
- `components/resume/`：ResumeDocument、文件入口；正文渲染器供封面、预览、公开页与打印复用。
- `app/cvs/[id]/_components/`：页面内编辑表单、模块管理、样式工作台和 useCvDocument 保存状态；不引入全局编辑状态框架。
- `components/account/`：共用账户状态、账户菜单、独立图片选择与外观控制。账户头像与证件照不共用数据源。
- `lib/resume/`：日期、可见性、链接、文件转换和候选校验；API 仅通过 `lib/api/generated/` 的生成服务访问。

## 浏览器验收

先启动独立后端与前端。测试会注册合成账户并创建简历，应使用隔离数据库。默认前端地址为 `http://127.0.0.1:3100`，可通过 `CV_TEST_URL` 配置。公开发布测试需要隔离测试发件器：把模拟邮件逐行写入 JSONL，每行包含 `recipient`、`purpose`、`token`，并用 `CV_TEST_MAILBOX` 指向该文件；不得使用真实邮箱或真实账户运行该测试。

可使用 `backend/tests/browser_test_server.py` 启动只监听本机、使用独立 SQLite 和模拟邮件的测试后端。为每次测试指定一个新建的空 `CV_TEST_DIR`，在后端目录执行 `CV_TEST_DIR=<空目录> CV_TEST_URL=http://127.0.0.1:3100 uv run python tests/browser_test_server.py`。前端构建和启动时均设置 `BACKEND_INTERNAL_URL=http://127.0.0.1:18432`；执行测试时设置 `CV_TEST_MAILBOX=<空目录>/mail.jsonl`。测试服务只接受发往 `example.com` 的模拟邮件。

```bash
pnpm exec playwright install chromium
pnpm exec playwright test
```

覆盖完整制作、模板、公开隔离与撤回、保存期间继续输入、手机上下文、照片独立、真实 JSON/PDF 下载及文件合同。文件输出在 `/tmp/cvory-browser-results`，不进入仓库。后端、MySQL 与生产部署验证分别记录于 [HANDOVER](../HANDOVER.md)。

全局状态测试覆盖网络失败后重试、成功提示被失败替换、输入保留、密码校验、退出及复制失败、深色窄屏和页面异常。服务端异常边界用例需要另一个前端进程指向不可用后端：在已有生产构建下运行 `BACKEND_INTERNAL_URL=http://127.0.0.1:1 pnpm start --hostname 127.0.0.1 --port 3101`，测试时加 `CV_TEST_UNAVAILABLE_URL=http://127.0.0.1:3101`；不设置时该用例跳过，不计为通过。
