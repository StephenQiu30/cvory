# 简序 · CVory

个人 CV 制作与管理工具，同时展示选定的个人简历信息。提供结构化制作、模板、JSON／Markdown、PDF 与可控公开展示，使用邮箱密码账户隔离私有内容。实现与验收范围见 HANDOVER。

[业务需求](docs/requirement/04-个人CV制作与管理需求说明.md) → [产品设计](docs/design/02-CV制作管理与展示设计.md) → [按能力拆分的 PRD](docs/prd/00-PRD导航.md) → [执行 Plan](docs/plan/00-Plan导航.md)。

[文档导航](docs/00-文档导航.md) · [PROJECT](PROJECT.md) · [AGENTS](AGENTS.md) · [CONTRIBUTING](CONTRIBUTING.md) · [视觉规范](DESIGN.md) · [任务状态](BACKLOG.md) · [交付记录](HANDOVER.md)

## 启动与运行

### 方式一：Docker Compose 一键启动（推荐，复用宿主机 MySQL）
```bash
cp .env.example .env    # 根据本地环境配置敏感信息（.env 已被 git 忽略）
docker compose build
docker compose run --rm backend python migrations/001_account_ownership.py
docker compose up -d    # 启动后端与前端容器
docker compose ps       # 查看容器状态
docker compose logs -f  # 查看日志
```
- 前端页面：`http://localhost:1234`
- 后端 Swagger 接口文档：`http://localhost:4321/api/docs`

### 方式二：本地进程独立启动

- **后端启动**：
  ```bash
  cd backend
  uv sync
  uv run python migrations/001_account_ownership.py
  uv run playwright install chromium
  uv run pytest -v
  uv run uvicorn app.main:app --port 8000
  ```
  Swagger 接口文档位于 `http://127.0.0.1:8000/api/docs`。
- **前端启动与 API 代码生成**：
  ```bash
  cd frontend
  pnpm install
  pnpm run openapi   # 基于后端 Swagger/OpenAPI 生成 axios 请求服务
  pnpm build
  pnpm dev
  ```
- 访问：打开浏览器访问 `http://localhost:3000`。

## 代码提交规范

本项目遵循 [CONTRIBUTING.md](CONTRIBUTING.md) 约定的 `type(scope): description` 规范（如 `feat(cv): ...`、`fix(api): ...`）。敏感信息通过 `.env` 管理，禁止提交私密配置。

工程目录固定为 `frontend/` 和 `backend/`，目录职责、代码及 API 规范统一见 [PROJECT](PROJECT.md#34-工程目录与依赖边界)。

品牌为简序 · CVory，采用[黑白 Logo](docs/assets/branding/CVory-黑白Logo概念.png)、黑白灰与 Geist 方向。前端采用 Next.js、Tailwind CSS、Tiptap，后端采用 FastAPI + MySQL，遵循 Google Python 与 API 设计规范，统一见[技术选型](docs/design/02-CV制作管理与展示设计.md#4-技术选型)。

[GitHub 公开仓库](https://github.com/StephenQiu30/cvory)，默认分支 main。

## 账户与存量数据

首次访问在登录页注册邮箱与密码。密码至少 10 位；会话由 FastAPI 管理。邮箱注册不表示已验证，当前没有邮件发送与密码找回。

迁移保留已有 CV 的 `legacy` 归属，不将其自动交给新账户。需要接管自己的存量内容时，在注册后由管理者执行 `cd backend && uv run python migrations/001_account_ownership.py --assign-legacy-to <目标邮箱>`。该命令只迁移未归属账户的内容。

管理入口 `/`，编辑入口 `/cvs/{id}`，账户设置 `/settings/profile`，每个账户的公开网址 `/u/{publicId}`。保存不发布；公开设置先固定筛选预览，再确认发布，撤回不删除私有内容。JSON 为 v1 完整备份，Markdown 仅交换正文，支持文件不超过 10 MB；照片支持 JPEG／PNG／WebP，2 MiB。

PDF 需要后端 Chromium 和可访问的 Next.js 打印路由。`FRONTEND_INTERNAL_URL` 指向前端受控内网地址，`BACKEND_INTERNAL_URL` 指向后端；前端构建时也需设置正确后端地址。浏览器来源通过 `CORS_ORIGINS` 配置。容器默认使用单个后端进程，短期打印上下文在该进程内维护。
