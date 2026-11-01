# 项目待办与执行顺序

本文件只维护任务调度。业务见需求，方案见 design，验收见对应 PRD，步骤见 Plan；当前只整理文档，未开始编码。

| 任务 | 依赖 | 状态 | 工作入口 |
| --- | --- | --- | --- |
| 文档与需求收敛 | — | 复核通过 | [业务需求](docs/requirement/04-个人CV制作与管理需求说明.md)、[设计](docs/design/02-CV制作管理与展示设计.md)、按能力拆分的 PRD/Plan |
| 前端技术基线 | — | 已安装并验证 | [设计 4.1](docs/design/02-CV制作管理与展示设计.md#41-已固定的前端基线)（Next.js 16 + React 19 + Tailwind 4 + Tiptap） |
| 后端与 API 基线 | 简单维护及 Google API 约束 | 已安装并验证 | [服务设计](docs/design/02-CV制作管理与展示设计.md#42-已确定的服务与数据边界)、[API 规范](PROJECT.md#33-api-规范)（FastAPI + MySQL + AIP 规范） |
| PLAN-CV-01 制作与保存 | 运行环境、所有者与持久化明确 | 已实现并验证 | [Plan 01](docs/plan/01-CV制作与保存.md)（AC-CV-01、02、05～12 已全部通过验证） |
| PLAN-CV-02 版本管理 | PLAN-CV-01 | 待执行 | [Plan 02](docs/plan/02-CV版本管理.md) |
| PLAN-CV-03 模板与样式 | PLAN-CV-01 | 待执行 | [Plan 03](docs/plan/03-模板与样式管理.md) |
| PLAN-CV-04 导入 | PLAN-CV-01；本能力支持格式及限额 | 待执行 | [Plan 04](docs/plan/04-简历导入.md) |
| PLAN-CV-05 备份与 Markdown | PLAN-CV-03、04 | 待执行 | [Plan 05](docs/plan/05-简历备份与Markdown导出.md) |
| PLAN-CV-06 PDF | PLAN-CV-03 | 待执行 | [Plan 06](docs/plan/06-PDF导出.md) |
| PLAN-CV-07 公开展示 | PLAN-CV-01；本能力公开规则 | 待执行 | [Plan 07](docs/plan/07-个人简历展示.md) |

版本、模板、导入和公开展示不必串成长链；只遵循实际数据依赖。需要确认的细节只影响相关能力，不另立全局审批阶段。既有公开仓库 main 保留，应用与 CI 尚未建立。
