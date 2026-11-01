# 简序 · CVory

个人 CV 制作与管理工具，同时展示选定的个人简历信息。已完成 PLAN-CV-01 制作与保存的 MVP 编码与集成验证。

[业务需求](docs/requirement/04-个人CV制作与管理需求说明.md) → [产品设计](docs/design/02-CV制作管理与展示设计.md) → [按能力拆分的 PRD](docs/prd/00-PRD导航.md) → [执行 Plan](docs/plan/00-Plan导航.md)。

[文档导航](docs/00-文档导航.md) · [PROJECT](PROJECT.md) · [AGENTS](AGENTS.md) · [CONTRIBUTING](CONTRIBUTING.md) · [视觉规范](DESIGN.md) · [任务状态](BACKLOG.md) · [交付记录](HANDOVER.md)

## 启动与运行

### 方式一：Docker Compose 一键启动（推荐，复用宿主机 MySQL）
```bash
cp .env.example .env    # 根据本地环境配置敏感信息（.env 已被 git 忽略）
docker compose up -d    # 启动后端与前端容器
docker compose ps       # 查看容器状态
docker compose logs -f  # 查看日志
```
- 前端页面：`http://localhost:3000`
- 后端 Swagger 接口文档：`http://localhost:8000/api/docs`

### 方式二：本地进程独立启动

- **后端启动**：
  ```bash
  cd backend
  uv sync
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
