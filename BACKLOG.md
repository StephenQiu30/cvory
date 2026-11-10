# 项目待办与执行顺序

本文件只维护任务调度。完整目标见[需求 04](docs/requirement/04-个人CV制作与管理需求说明.md)，技术合同见 design，验收见 PRD，步骤见 Plan。

负责人已授权开始实现。唯一 NestJS 后端及 Python 清理已有实现和隔离验证，按授权交付 main；使用隔离 MySQL/合成数据验证；不自动迁移业务库、部署或发起真实 AI/BOSS 动作。

状态区分代码存在、局部验证、完整能力验收与部署验收；局部证据保留，不外推为完整链路可靠。现行完整目标尚未通过端到端验收，新增目标不沿用旧验收结论。

| 任务 | 依赖 | 状态 | 工作入口 |
| --- | --- | --- | --- |
| 个人工具需求与服务设计评审 | NestJS/TypeScript、自部署、AI/Chrome/手工PDF及MIT选择 | 身份/CV 及现有资料/图片/预设/公开/PDF 已迁入 Nest，Python 已清理；完整目标继续按依赖交付 | [需求 04](docs/requirement/04-个人CV制作与管理需求说明.md)、[设计 §9](docs/design/02-CV制作管理与展示设计.md#9-服务整体结构与落地评审) |
| 全局状态展示与异常处理 | [DESIGN §5.1](DESIGN.md#51-全局状态与异常反馈) | 已统一状态组件与错误恢复，22 项隔离浏览器测试及构建通过；交付分支为 `main` | [交接记录](HANDOVER.md)、[状态设计稿](https://www.figma.com/design/sLNuFRPH0Zg6gF8YfNNCsR?node-id=166-38664) |
| 简历制作完整链路验证与可靠性收敛 | 独立数据库、合成内容、真实浏览器和生成文件 | 制作／保存／本机恢复已按 PRD 01 贯穿真实浏览器、Nest API 与隔离 MySQL；现有文件／公开回归纳入同一测试。DOCX／文字 PDF／PNG 等新增目标仍须各自完整验收，现有格式通过不代表全部格式完成 | [设计 §7.5](docs/design/02-CV制作管理与展示设计.md#75-需求覆盖与验收闭环)、[PRD 导航](docs/prd/00-PRD导航.md) |
| 猫步及同类简历制作项目调研 | 当前制作代码与公开上游 | 限定范围调研完成；采用目标已归入需求 04、设计 02 及 PRD／Plan，不以报告替代实施验收 | [调研 04](docs/research/04-猫步简历源码拆解与CVory制作能力接入调研.md) |
| BOSS 直聘自主投递能力 | 现有简历版本与导出；开源模块许可及适配成本 | 已确认自主实现和开源改造方向；完整目标及验收已细化，Chrome 插件、人工上传 PDF 已明确，首期仅筛选/沟通/招呼；复用模块与分发待选；任务代码、模拟和真实平台验收未启动；增加关键词/可选 AI 与跨任务去重目标 | [PRD 11](docs/prd/11-BOSS直聘自主投递.md)、[Plan 11](docs/plan/11-BOSS直聘自主投递.md) |
| UIUX 与参考工作台对齐 | 已确认简历管理、模板、Markdown、导入和公开范围 | 已先按 DESIGN 同步 Figma 桌面／手机及状态稿，前端采用黑白灰与少量蓝色点缀；工作台功能已实现，真实网站未发布 | [DESIGN](DESIGN.md)、[调研 02](docs/research/02-老鱼简历功能逆向与CV技术选型.md)、[Figma 草稿](https://www.figma.com/design/sLNuFRPH0Zg6gF8YfNNCsR?node-id=7-2880) |
| 登录注册弹窗 | 邮箱密码账户与共享页面壳 | 已实现桌面／手机弹窗，会话过期保留草稿已验证 | [DESIGN](DESIGN.md)、[交接记录](HANDOVER.md) |
| PLAN-CV-08 GitHub 账户与项目素材 | GitHub OAuth 应用、双身份绑定与迁移方案 | Nest GitHub 登录/无邮箱账户/双身份绑定及公开仓库分页已实现；精选仓库候选、排序/贡献维护和发布预览复核已实现；模拟 OAuth、真实 GitHub 和公网完整验收待做 | [PRD 08](docs/prd/08-账户访问与资料.md)、[Plan 08](docs/plan/08-账户访问与资料.md) |
| PLAN-CV-09 存量邮箱验证与恢复 | 账户基础、发信渠道与验证政策 | 仅服务存量邮箱兼容，不作为 GitHub-only 发布前置；历史实现已从仓库移除；Nest 邮件验证/恢复尚未实现，入口关闭，需求和旧任务保留，按独立能力验收 | [PRD 09](docs/prd/09-邮箱验证与账户恢复.md)、[Plan 09](docs/plan/09-邮箱验证与账户恢复.md) |
| PLAN-CV-10 账户注销与数据处理 | 账户基础、注销及保留政策 | 历史 Python 已移除；Nest 注销/撤销/墓碑重放未实现并关闭入口，未完成注销任务阻止就绪；上线前需独立持久存储、密钥、备份及恢复验收 | [PRD 10](docs/prd/10-账户注销与数据处理.md)、[Plan 10](docs/plan/10-账户注销与数据处理.md) |
| 视觉基线同步 | [DESIGN](DESIGN.md) | Figma 先于页面同步；移除顶栏／标签页黑色选中线，采用 shadcn 填充选中态及 Card、Badge、Empty、Skeleton 信息组合；桌面／手机浏览器回归通过 | [交接记录](HANDOVER.md)；公网部署及跨浏览器验收未执行 |
| 完整需求与调研转化 | 最新业务要求、调研 03／04 | 完整目标、设计及 PRD/Plan 01～12 已整理；文档检查单独留证，不代表产品完成 | [业务需求](docs/requirement/04-个人CV制作与管理需求说明.md)、[设计](docs/design/02-CV制作管理与展示设计.md)、按能力拆分的 PRD/Plan |
| 前后端设计与目录规范 | Vercel/Geist、两份 shadcn 技能、Google TypeScript | 已整理到 DESIGN/PROJECT 及设计 02；实际建立 account/cvs/github/config/common/database 模块与配套前端入口；其余目录按需建立，完整迁移仍待完成 | [DESIGN](DESIGN.md)、[PROJECT](PROJECT.md) |
| 前端技术基线 | — | 已安装并验证 | [设计 4.1](docs/design/02-CV制作管理与展示设计.md#41-已固定的前端基线)（Next.js 16 + React 19 + Tailwind 4 + Tiptap） |
| 后端与 API 基线 | NestJS + TypeScript；MySQL 与 Google API 合同 | Nest 工程、显式 SQL/TypeScript 迁移、统一客户端及 Node 容器已建立；25 项后端/25 项浏览器与容器验收见 HANDOVER。Python 已删除，Node 容器/单一 OpenAPI；资料、头像、预设、公开与 PDF 已由 Nest 承接；邮箱恢复/注销未完成并关闭入口 | [服务设计](docs/design/02-CV制作管理与展示设计.md#42-已确定的服务与数据边界)、[API 规范](PROJECT.md#33-api-规范)（NestJS + TypeScript + MySQL + AIP 规范） |
| PLAN-CV-01 制作与保存 | 运行环境、所有者与持久化明确 | 已实现富文本／持续 Markdown／预览、串行自动保存、最新输入离开屏障、按账户与标签隔离的本机恢复及有界正文校验；未应用表单／样式／不兼容源码可恢复，副本创建在服务端核对原账户。隔离生产构建及完整回归证据见 HANDOVER；实际部署与跨格式扩展独立验收 | [Plan 01](docs/plan/01-CV制作与保存.md) |
| 我的简历卡片工作区与共享页面壳 | PLAN-CV-01 | 已实现并通过真实本地 API／浏览器验收 | [设计 02 §2.5](docs/design/02-CV制作管理与展示设计.md#25-管理工作区与共享页面壳)、[PRD 01](docs/prd/01-CV制作与保存.md)、[Plan 01](docs/plan/01-CV制作与保存.md) |
| PLAN-CV-02 版本管理 | PLAN-CV-01 | 已有副本、名称及删除实现和局部证据；Nest 历史快照/有界保留/幂等恢复副本及前端入口已实现；公开来源删除保护有代码，完整发布并发、资源兼容及历史预览待验证；公开来源删除保护已在 Nest 验证 | [Plan 02](docs/plan/02-CV版本管理.md) |
| PLAN-CV-03 模板与样式 | PLAN-CV-01 | 已有三模板、配色及预设和局部证据；兼容模板、预览边界及跨输出验收待完成 | [Plan 03](docs/plan/03-模板与样式管理.md) |
| PLAN-CV-04 导入 | PLAN-CV-01；本能力支持格式及限额 | 已实现 DOCX/文字 PDF 子进程解析、来源片段/页码/坐标、明确字段映射、候选校对及幂等另存；10 MiB/解压体积/页数/时间/堆限制和临时清理已写入代码。合成样本、多栏/表格、扫描/加密/损坏/超限、取消清理与真实浏览器流程尚未验收；JSON/Markdown 定点校对保真与往返仍待收敛。扫描 PDF 明确提示不支持，OCR 后续再定 | [Plan 04](docs/plan/04-简历导入.md) |
| PLAN-CV-05 备份与 Markdown | PLAN-CV-03、04 | 已有含照片 JSON／Markdown 实现及局部证据；原站不可用的完整恢复与故障降级待验收 | [Plan 05](docs/plan/05-简历备份与Markdown导出.md) |
| PLAN-CV-06 PDF/PNG | PLAN-CV-03 | 已有 Nest 固定快照 PDF 及 PDF.js 逐页 PNG，单页 PNG、多页 ZIP；页数/像素/输出/进程限额已落入代码。真实输出质量、ZIP 页数/顺序、字体图片故障、取消/超限和声明部署拓扑尚未验收 | [Plan 06](docs/plan/06-PDF导出.md) |
| PLAN-CV-07 公开展示 | PLAN-CV-01；本能力公开规则 | 已实现站主显式配置首页、稳定个人页共用发布快照、目录查阅、精选项目公开渲染和 GitHub 项目发布预览复核；并发版本、来源保护、完整匿名隐私与浏览器/真实网站验收仍待完成 | [Plan 07](docs/plan/07-个人简历展示.md) |
| PLAN-CV-12 AI 简历分析与岗位匹配 | 已保存版本/岗位；火山引擎/DeepSeek/OpenAI 官方预设；用户自填 Key 和模型 | 功能代码已接入，落实 7 天私有加密正文、仅本人读取、自动清理且 CVory 不限调用/Token/金额；后端类型/lint/格式/OpenAPI 与前端类型/lint/构建通过。模拟 provider、隔离 MySQL 迁移、浏览器流程和三家真实服务均未验收；未运行测试或真实模型调用 | [PRD 12](docs/prd/12-AI简历分析与岗位匹配.md)、[Plan 12](docs/plan/12-AI简历分析与岗位匹配.md) |
| MIT 许可与自部署交付说明 | 开源自部署、MIT 已确认 | 根 LICENSE 与第三方版权/许可清单待补；仅记录选择，不计为发布完成 | [PROJECT](PROJECT.md)、[README](README.md) |

后续执行顺序：完成真实 GitHub、生命周期与恢复验收 → GitHub 项目选入简历与发布 → 编辑/版本及 MD/DOCX/文字 PDF → PDF/PNG → 站主首页与项目发布 → AI → BOSS 插件规则和模拟 → 用户指定范围的真实平台验收。已有完整链路验证贯穿对应交付，格式必需项不再按可选扩展调度。

版本、模板、导入和公开展示只遵循实际数据依赖；独立能力可并行，但最终使用同一组合成内容完成跨能力验收。负责人已授权实施；尚未确认的供应商细节只约束对应能力，按通用提问补充确认。既有公开仓库 main 保留，应用工程已建立，尚未接入远端 CI。
