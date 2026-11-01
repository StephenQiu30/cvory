# 项目接手文档

任务调度只在 [BACKLOG](BACKLOG.md)。

## PLAN-CV-01 制作与保存 MVP 编码交付

日期：2026-11-01（Asia/Shanghai）。交付范围是遵循 PROJECT 建立 `frontend/` 与 `backend/` 工程，实现 PLAN-CV-01 核心制作与保存能力，保持 MVP 极简，不提前引入其他功能。

### 1. 工程与选型落地
- **后端 (`backend/`)**：Python 3.12 + FastAPI 0.162 + SQLAlchemy 2.1 + PyMySQL + Pydantic 2，采用 uv 管理依赖并锁定 `uv.lock`。数据持久化接入本地真实 MySQL（utf8mb4，数据库 `cvory`）。API 遵循 Google AIP 规范：`/api/v1/cvs` 资源导向，lowerCamelCase JSON 输出，RFC 3339 时间格式，AIP-193 统一错误模型与 AIP-154 ETag 并发控制。
- **前端 (`frontend/`)**：Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4 + Tiptap 3.32 + Lucide，采用 pnpm 管理依赖并锁定 `pnpm-lock.yaml`。设计严格遵循 [DESIGN.md](DESIGN.md) 的黑白灰语义色值与 Geist 字体，提供列表空状态、新建弹窗、基本信息编辑、模块增删/排序/隐藏、富文本排版工具栏与实时纸张预览。

### 2. 验证证据
- **后端自动化测试**：`cd backend && uv run pytest -v`，6 项单元与 API 测试（健康检查、空列表、创建/获取、ETag 并发冲突 409 ABORTED、字段校验 400 INVALID_ARGUMENT、删除 204）全部通过。
- **MySQL 真实持久化**：通过实际 MySQL 9.7 实例创建表结构，执行写入、读回与删除链路验证通过。
- **E2E 接口验证**：Uvicorn 启动后完整验证 POST 创建、GET 详情、PATCH 条件更新（成功产生新 ETag）、旧 ETag 拒绝（409 ABORTED）及 DELETE 清理。
- **前端构建验证**：`cd frontend && pnpm build` 顺利通过，TypeScript 类型检查零错误，PostCSS 零告警，生成标准静态与动态路由。
- **文档与工程规范**：[PROJECT.md](PROJECT.md) 登记实际启动与测试命令，[BACKLOG.md](BACKLOG.md) 标记 PLAN-CV-01 已完成，不增加无关功能。
