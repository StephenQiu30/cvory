# 项目规范

本文件是简序 · CVory 的工程规范：规定信息放在哪里，以及已经确认的文档工作方式。产品展示名、黑白灰视觉与 Geist 字体方向已确认；技术组合、仓库结构和编码基线仍待定。待定项不能当作已经选定的技术合同。

- [0. 文档体系](#0-文档体系)
- [1. 项目标识](#1-项目标识)
- [2. 仓库现状](#2-仓库现状)
- [3. 技术选型](#3-技术选型)
- [3.5 文档工作区](#35-文档工作区)
- [8. 质量与验收](#8-质量与验收)
- [9. 待定项](#9-待定项)

## 0. 文档体系

每类信息只有一个维护位置。其他文档只引用，不另写一套冲突规则。

| 信息 | 唯一来源 |
| --- | --- |
| 协作流程与交付授权 | [AGENTS.md](AGENTS.md) |
| 工程规范与文档工作区 | 本文件 |
| 视觉与交互标准 | [DESIGN.md](DESIGN.md)，区分已确认方向与建议基线 |
| 提交标题格式 | `CONTRIBUTING.md`，尚未建立 |
| 原始需求与确认状态 | [docs/requirement](docs/requirement/00-需求导航.md) |
| 技术设计 | [docs/design](docs/design/00-设计导航.md)，现行合同为[文档管理设计](docs/design/01-文档管理与Obsidian设计.md) |
| 人读需求与验收 | [docs/prd](docs/prd/00-PRD导航.md)；每份 PRD 只对应一份 design |
| 实施步骤与验证 | [docs/plan](docs/plan/00-Plan导航.md)；每份 Plan 只对应一份 PRD |
| 任务顺序、状态、阻塞 | [BACKLOG.md](BACKLOG.md) |
| 阶段记录与验证证据 | [HANDOVER.md](HANDOVER.md) |
| 实际版本号与运行命令 | 各工程清单和 README；当前没有工程目录 |

## 1. 项目标识

| 项 | 值 |
| --- | --- |
| 仓库目录名 | `CV` |
| GitHub 仓库 | [StephenQiu30/cvory](https://github.com/StephenQiu30/cvory)，公开仓库，默认分支 `main` |
| 产品展示名 | 简序 · CVory；B 方案图形，见[来源 07](docs/requirement/07-简序命名视觉与技术选型补充.md) |
| 技术标识、包名、模块名 | 待定 |

目录名 `CV` 只标识这个仓库，保持不变。产品名称不自动决定技术包名或架构。

## 2. 仓库现状

仓库现有入口是 [README](README.md)。文档在 [docs](docs/00-文档导航.md)。根规范有本文件、[AGENTS](AGENTS.md)、[BACKLOG](BACKLOG.md) 和 [HANDOVER](HANDOVER.md)。

没有应用代码、构建清单、容器编排或运行中的服务。没有可复用的本机工程环境。

## 3. 技术选型

负责人提出 Next.js、Tiptap 方向，确认 Geist 字体与黑白灰视觉；视觉规范见 [DESIGN](DESIGN.md)。框架、组件、中文字体、文件解析、存储和部署的技术推荐统一见[需求说明第 10 节](docs/requirement/04-个人CV制作与管理需求说明.md#10-技术选型建议)。除明确确认项外均为建议，兼容版本与工程合同尚未锁定。采用 Next.js 不等于已经选择 Vercel 托管。当前仅整理需求、视觉规范和建议；不从其他仓库复制技术栈。

## 3.5 文档工作区

- `docs` 是唯一文档目录，也是 Obsidian vault。原始需求、设计、PRD、Plan、调研、模板和附件以 Markdown 与原文件维护，通过 Git 协作。不在这里建设或部署知识库网站。阅读正文不需要安装 Node 或启动服务。
- 根规范和 BACKLOG、HANDOVER 留在仓库根目录。`docs` 用仓库相对链接引用它们，不复制正文。vault 外的文件在编辑器中阅读。
- `docs` 不存放 README。服务运行说明将来留在各工程 README。根入口为 [docs/00-文档导航.md](docs/00-文档导航.md)。编号规则见 [AGENTS](AGENTS.md#文档规则)。
- 文档按 `design → prd → plan` 分层。一份 design 对应一份 PRD，一份 PRD 可对应多份 Plan。各目录独立连续编号。父子关系以显式链接为准，不能只靠文件号推断。技术合同只在 design。调度状态只在 BACKLOG。
- 当前需求整理阶段只维护[一份需求说明](docs/requirement/04-个人CV制作与管理需求说明.md)，放在 requirement 并标明“整理稿，可编辑”；来源 01～03、05～07 冻结。说明不等同于 PRD，技术章节只列建议；重复产品设计、PRD 及宽泛调研草稿清理，不并行维护。制作、导入导出、管理和展示均纳入需求，暂不进入 PRD 或 Plan。根目录 DESIGN 维护视觉规范，不代替功能说明。
- `docs/requirement` 保留原始需求。正文、文件名、原编号和业务 ID 入库后不因整理或重编号改写。现有来源见[需求导航](docs/requirement/00-需求导航.md)；来源 01～03、05～07 的首次入库基线为 Git 提交 `d3e89cf216377d0a907358667bd5eac454afde8b`。来源 04 为可编辑整理稿，不按冻结来源处理；后续新增原始来源在本节登记对应首次入库提交。阶段摘要见 [HANDOVER](HANDOVER.md)。
- Obsidian 使用相对 Markdown 链接、核心搜索、反向链接、图谱、提纲、模板和 Workspaces，无社区插件。通用配置入 Git。个人布局、缓存和回收站不入 Git。自动链接更新关闭。
- `docs` 只保留正文、模板、附件和 Obsidian 配置，不保留脚本、测试、依赖、锁文件或生成目录。维护规则见[文档管理设计](docs/design/01-文档管理与Obsidian设计.md)。

## 8. 质量与验收

当前没有工程检查命令。文档变更核对编号、父子链接、锚点、路径大小写和事实。未运行的检查不算通过。工具不存在时如实说明。

Obsidian 客户端里的打开、布局和图谱另作验收。配置文件可解析不等于客户端已经验收。

工程目录出现后，把构建、测试和运行命令写进本节，并在 [Plan 导航](docs/plan/00-Plan导航.md) 登记检查入口。

## 9. 待定项

| 项 | 状态 |
| --- | --- |
| 产品展示名与范围 | 展示名为简序 · CVory；制作、版本、模板、PDF 与个人简历展示网站，以及富文本/Markdown 需求见[统一需求说明](docs/requirement/04-个人CV制作与管理需求说明.md) |
| 技术选型与仓库结构 | 待定 |
| 编码规范基线 | 待定。不借用其他仓库的语言规范 |
| 视觉标准 [DESIGN.md](DESIGN.md) | 品牌、黑白灰与 Geist 方向已确认；具体参数和中文字体为建议基线，未进行页面验收 |
| 提交规范 `CONTRIBUTING.md` | 未建立 |
| 远端仓库与 CI | GitHub 公开仓库 `StephenQiu30/cvory`，默认分支 `main`；CI 未接入 |
