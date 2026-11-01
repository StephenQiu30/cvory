# 项目待办与执行顺序

本文件只维护任务调度。业务见需求，方案见 design，验收见对应 PRD，步骤见 Plan；当前只整理文档，未开始编码。

| 任务 | 依赖 | 状态 | 工作入口 |
| --- | --- | --- | --- |
| 文档与需求收敛 | — | 复核通过 | [业务需求](docs/requirement/04-个人CV制作与管理需求说明.md)、[设计](docs/design/02-CV制作管理与展示设计.md)、按能力拆分的 PRD/Plan；不表示实现完成 |
| PLAN-CV-01 制作与保存 | 实施时明确运行/持久化方式 | 待执行 | [Plan 01](docs/plan/01-CV制作与保存.md) |
| PLAN-CV-02 版本管理 | PLAN-CV-01 | 待执行 | [Plan 02](docs/plan/02-CV版本管理.md) |
| PLAN-CV-03 模板与样式 | PLAN-CV-01 | 待执行 | [Plan 03](docs/plan/03-模板与样式管理.md) |
| PLAN-CV-04 导入 | PLAN-CV-01；本能力支持格式及限额 | 待执行 | [Plan 04](docs/plan/04-简历导入.md) |
| PLAN-CV-05 备份与 Markdown | PLAN-CV-03、04 | 待执行 | [Plan 05](docs/plan/05-简历备份与Markdown导出.md) |
| PLAN-CV-06 PDF | PLAN-CV-03 | 待执行 | [Plan 06](docs/plan/06-PDF导出.md) |
| PLAN-CV-07 公开展示 | PLAN-CV-01；本能力公开规则 | 待执行 | [Plan 07](docs/plan/07-个人简历展示.md) |

版本、模板、导入和公开展示不必串成长链；只遵循实际数据依赖。需要确认的细节只影响相关能力，不另立全局审批阶段。既有公开仓库 main 保留，应用与 CI 尚未建立。
