# 简序 · CVory

面向个人的开源自部署简历与求职工具，许可选定 MIT。前端使用 Next.js、Geist 与 shadcn/Radix，后端仅使用 NestJS + TypeScript + MySQL，代码和目录规则见 [PROJECT](PROJECT.md)。

已有 GitHub 登录/安全绑定、存量邮箱密码兼容、富文本／Markdown 制作、串行自动保存与条件写入、本机草稿恢复、历史恢复副本、三套模板与个人样式、JSON/Markdown 交换、照片、PDF 及筛选后的公开简历。DOCX/文字 PDF 导入、PNG、站主首页、AI 和 BOSS Chrome 插件仍按 [BACKLOG](BACKLOG.md) 实施。邮箱恢复和账户注销暂未开放，界面明确说明。MIT 根 LICENSE 与第三方声明待补，不将选型表述为完整产品验收。

[业务需求](docs/requirement/04-个人CV制作与管理需求说明.md) → [产品设计](docs/design/02-CV制作管理与展示设计.md) → [PRD](docs/prd/00-PRD导航.md) → [Plan](docs/plan/00-Plan导航.md)。

[文档导航](docs/00-文档导航.md) · [PROJECT](PROJECT.md) · [AGENTS](AGENTS.md) · [CONTRIBUTING](CONTRIBUTING.md) · [视觉规范](DESIGN.md) · [交付记录](HANDOVER.md)

## 本地运行

需要 Node.js 24、pnpm 12 与已创建的 MySQL 数据库。将后端示例配置合并到被忽略的 `backend/.env`；不要覆盖已有真实配置。

```bash
cd backend
pnpm install --frozen-lockfile
pnpm build
pnpm db:migrate
pnpm exec playwright install chromium
pnpm start
```

另一个终端在 `frontend/`：

```bash
pnpm install --frozen-lockfile
BACKEND_INTERNAL_URL=http://127.0.0.1:4321 pnpm dev --port 1234
```

访问 `http://localhost:1234`。后端默认 `4321`，公开来源 `PUBLIC_APP_ORIGIN` 必须与浏览器入口一致。完整配置和检查见 [backend/README](backend/README.md)、[frontend/README](frontend/README.md)。

GitHub OAuth App 的回调地址为 `${PUBLIC_APP_ORIGIN}/api/account/github/callback`，Client ID/Secret 由部署者填写。新账户不要求邮箱；存量邮箱登录保留，新增邮箱注册默认关闭，可通过 `LEGACY_REGISTRATION_ENABLED=true` 显式启用。GitHub 未配置时界面给出提示。

## Docker Compose

使用宿主机 MySQL；创建专用数据库/用户，并将 [.env.example](.env.example) 中的配置写入本机 `.env`。密码中的 URL 保留字符须做百分号编码，真实值不提交。

```bash
docker compose build
docker compose run --rm --no-deps backend pnpm db:migrate
docker compose up -d
docker compose ps
```

前端默认 `http://localhost:1234`，后端 `/api/health` 检查数据库/schema 就绪。启动不自动迁移；前端容器等待后端就绪。PDF 使用独立 Node/Chromium 子进程与受控打印页，`FRONTEND_INTERNAL_URL`/`BACKEND_INTERNAL_URL` 必须可互通；照片和字体失败会明确返回失败，不生成缺失资源的文件。

## 存量数据与公开边界

SQL/TypeScript 显式迁移承接旧 owner/lifecycle schema，保留账户、会话、CV、公开地址、预设和私有文件；旧 CV 保持 `legacy`，不会分配给首位注册者。备份并在副本验证后，管理者可显式运行 `cd backend && pnpm db:migrate --assign-legacy-to <账户ID或邮箱>` 认领自己的存量 CV。

GitHub 绑定同时要求原本站会话和 GitHub 授权，不按邮箱合并。PDF、私有资料与修订历史按 owner 隔离；公开端只读取显式筛选后的快照。保存不会发布，撤回不会删除私有 CV；当前公开来源不能直接删除。

MySQL DDL 不整批回滚。切换前备份数据库、私有 `data/`、独立删除墓碑和密钥；恢复备份时先按原删除记录处理账户状态。有未完成注销任务时 Nest 拒绝就绪，不静默丢弃任务。已启用的删除流程/墓碑恢复尚未移植，不应直接将其业务库交给此版本。回退须停止写入并恢复迁移前数据库和私有文件备份。

本仓库不保留 Python 运行时；历史代码由 Git 历史承载。删除源码不删除数据库、私有文件或 Docker 卷。未获授权不部署、不调用付费模型、不执行真实 BOSS 发送。
