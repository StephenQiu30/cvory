# 项目接手文档

任务调度只在 [BACKLOG](BACKLOG.md)。

## Docker 编排、Swagger 文档与 OpenAPI 客户端交付

日期：2026-11-01（Asia/Shanghai）。交付范围是支持 docker-compose 一键启动并复用宿主机环境、敏感信息 `.env` 隔离、提交规范 Conventional Commits、整理后端 Swagger 文档及使用 axios + @umijs/openapi 生成前端 API 客户端。

### 1. 交付内容
- **Docker 编排与宿主机复用**：
  - 编写 `docker-compose.yml`、`backend/Dockerfile` 与 `frontend/Dockerfile`。
  - 通过 `extra_hosts: ["host.docker.internal:host-gateway"]` 连通宿主机，容器内后端无缝连接宿主机已启动的 MySQL 服务（3306 端口）。
  - 建立根目录 `.env.example` 模板与本地 `.env`（写入 `.gitignore`，严禁提交私密凭据）。
- **代码提交规范**：
  - 新建 [CONTRIBUTING.md](CONTRIBUTING.md)，确立 `type(scope): description` 规范（如 `feat(cv)`、`fix(api)`、`build(docker)`、`docs(swagger)` 等）。
  - 同步更新 [PROJECT.md](PROJECT.md)、[AGENTS.md](AGENTS.md) 与 [README.md](README.md)。
- **Swagger 接口文档与去除版本号**：
  - 全局统一使用 `/api` 根路由，去除 `/api/v1` 等版本号前缀，目录结构保持扁平清晰（`backend/app/api/cvs.py`）。
  - 在 `backend/app/main.py` 与 `backend/app/api/cvs.py` 完善 OpenAPI 元数据、分组标签（`cvs`、`system`）、接口详细说明及状态码模型（含 400/401/403/404/409 Google AIP 错误结构）。
  - 文档交互地址为 `/api/docs`，元数据地址为 `/api/openapi.json`。
- **前端 API 生成（axios + @umijs/openapi 规范接入）**：
  - 遵循 `@umijs/openapi` 官方规范，配置标准 `frontend/openapi2ts.config.ts` 并在 `package.json` 提供 `openapi` / `openapi2ts` 命令。
  - 引入 `axios` 封装 [`request.ts`](frontend/src/lib/api/request.ts)，无缝适配 `openapi2ts` 生成的代码，拦截并映射 Google AIP 标准错误。
  - 生成类型和请求代码位于 [`src/lib/api/generated/`](frontend/src/lib/api/generated/)，接口路径直接对应 `/api/cvs`。

### 2. 验证证据
- **后端测试**：`cd backend && uv run pytest -v`，6 项测试全部通过（0 warnings）。
- **前端生成与构建**：`cd frontend && pnpm run openapi && pnpm build`，OpenAPI service 代码生成成功，Next.js 生产构建与 TypeScript 检查 0 错误通过。
- **Docker 编排配置校验**：`docker compose config` 解析与变量代换通过。
- **Git 忽略与隐私核查**：`git status` 确认 `.env` 保持未跟踪/已忽略状态，`.env.example` 正常纳管。
