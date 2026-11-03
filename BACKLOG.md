# 项目待办与执行顺序

本文件只维护任务调度。业务见需求，方案见 design，验收见对应 PRD，步骤见 Plan；当前任务状态以表格为准。

| 任务 | 依赖 | 状态 | 工作入口 |
| --- | --- | --- | --- |
| UIUX 从零设计与竞品字段拆解 | 当前明确视觉要求、竞品观察 | 已实现共享布局、结构化制作、邮箱密码账户与公开流程；本地检查和浏览器验证通过，真实网站未发布 | [DESIGN](DESIGN.md)、[调研 02](docs/research/02-老鱼简历功能逆向与CV技术选型.md)、[Figma 草稿](https://www.figma.com/design/sLNuFRPH0Zg6gF8YfNNCsR?node-id=18-9323) |
| 文档与需求收敛 | — | 复核通过 | [业务需求](docs/requirement/04-个人CV制作与管理需求说明.md)、[设计](docs/design/02-CV制作管理与展示设计.md)、按能力拆分的 PRD/Plan |
| 前端技术基线 | — | 已安装并验证 | [设计 4.1](docs/design/02-CV制作管理与展示设计.md#41-已固定的前端基线)（Next.js 16 + React 19 + Tailwind 4 + Tiptap） |
| 后端与 API 基线 | 简单维护及 Google API 约束 | 已安装并验证 | [服务设计](docs/design/02-CV制作管理与展示设计.md#42-已确定的服务与数据边界)、[API 规范](PROJECT.md#33-api-规范)（FastAPI + MySQL + AIP 规范） |
| PLAN-CV-01 制作与保存 | 运行环境、所有者与持久化明确 | 已实现并验证 | [Plan 01](docs/plan/01-CV制作与保存.md)（AC-CV-01、02、05～12 已全部通过验证） |
| 我的简历卡片工作区与共享页面壳 | PLAN-CV-01 | 已实现并通过真实本地 API／浏览器验收 | [设计 02 §2.5](docs/design/02-CV制作管理与展示设计.md#25-管理工作区与共享页面壳)、[PRD 01](docs/prd/01-CV制作与保存.md)、[Plan 01](docs/plan/01-CV制作与保存.md) |
| PLAN-CV-02 版本管理 | PLAN-CV-01 | 已实现独立副本、名称编辑和删除；本地验证通过 | [Plan 02](docs/plan/02-CV版本管理.md) |
| PLAN-CV-03 模板与样式 | PLAN-CV-01 | 已实现三模板、配色及个人预设；本地验证通过 | [Plan 03](docs/plan/03-模板与样式管理.md) |
| PLAN-CV-04 导入 | PLAN-CV-01；本能力支持格式及限额 | 已实现 JSON v1／Markdown 校对与另存；本地验证通过 | [Plan 04](docs/plan/04-简历导入.md) |
| PLAN-CV-05 备份与 Markdown | PLAN-CV-03、04 | 已实现含照片的 JSON 备份与 Markdown 交换；本地验证通过 | [Plan 05](docs/plan/05-简历备份与Markdown导出.md) |
| PLAN-CV-06 PDF | PLAN-CV-03 | 已实现真实 Chromium PDF；本地多页文字提取验证通过 | [Plan 06](docs/plan/06-PDF导出.md) |
| PLAN-CV-07 公开展示 | PLAN-CV-01；本能力公开规则 | 已实现固定预览、发布、撤回与匿名网页；真实网站尚未发布 | [Plan 07](docs/plan/07-个人简历展示.md) |

版本、模板、导入和公开展示不必串成长链；只遵循实际数据依赖。需要确认的细节只影响相关能力，不另立全局审批阶段。既有公开仓库 main 保留，应用工程已建立，尚未接入远端 CI。
