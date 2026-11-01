# 简序 · CVory

个人 CV 制作与管理工具，同时展示选定的个人简历信息。已完成 PLAN-CV-01 制作与保存的 MVP 编码与集成验证。

[业务需求](docs/requirement/04-个人CV制作与管理需求说明.md) → [产品设计](docs/design/02-CV制作管理与展示设计.md) → [按能力拆分的 PRD](docs/prd/00-PRD导航.md) → [执行 Plan](docs/plan/00-Plan导航.md)。

[文档导航](docs/00-文档导航.md) · [PROJECT](PROJECT.md) · [AGENTS](AGENTS.md) · [视觉规范](DESIGN.md) · [任务状态](BACKLOG.md) · [交付记录](HANDOVER.md)

## 本地启动与验证

- **后端启动**：
  ```bash
  cd backend
  uv sync
  uv run pytest -v
  uv run uvicorn app.main:app --port 8000
  ```
- **前端启动**：
  ```bash
  cd frontend
  pnpm install
  pnpm build
  pnpm dev
  ```
- 访问：打开浏览器访问 `http://localhost:3000`。

工程目录固定为 `frontend/` 和 `backend/`，目录职责、代码及 API 规范统一见 [PROJECT](PROJECT.md#34-工程目录与依赖边界)。

品牌为简序 · CVory，采用[黑白 Logo](docs/assets/branding/CVory-黑白Logo概念.png)、黑白灰与 Geist 方向。前端采用 Next.js、Tailwind CSS、Tiptap，后端采用 FastAPI + MySQL，遵循 Google Python 与 API 设计规范，统一见[技术选型](docs/design/02-CV制作管理与展示设计.md#4-技术选型)。

[GitHub 公开仓库](https://github.com/StephenQiu30/cvory)，默认分支 main。
