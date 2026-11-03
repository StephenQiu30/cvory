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
- `components/resume/`：ResumeDocument、文件入口；正文渲染器供封面、预览、公开页与打印复用。
- `app/cvs/[id]/_components/`：页面内编辑表单、模块管理、样式工作台和 useCvDocument 保存状态；不引入全局编辑状态框架。
- `components/account/`：共用账户状态、账户菜单、独立图片选择与外观控制。账户头像与证件照不共用数据源。
- `lib/resume/`：日期、可见性、链接、文件转换和候选校验；API 仅通过 `lib/api/generated/` 的生成服务访问。

## 浏览器验收

先启动独立后端与前端。测试会注册合成账户并创建简历，应使用隔离数据库。默认前端地址为 `http://127.0.0.1:3100`，可通过 `CV_TEST_URL` 配置。

```bash
pnpm exec playwright install chromium
pnpm exec playwright test
```

覆盖完整制作、模板、公开隔离与撤回、保存期间继续输入、手机上下文、照片独立、真实 JSON/PDF 下载及文件合同。文件输出在 `/tmp/cvory-browser-results`，不进入仓库。后端、MySQL 与生产部署验证分别记录于 [HANDOVER](../HANDOVER.md)。
