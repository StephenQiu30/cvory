# BOSS直聘自动投递简历方案与自研可行性调研

核查日期：2026-11-09（Asia/Shanghai）。目标是选择可复用的求职执行能力，减少 CVory 从头开发登录、搜索、匹配和沟通的工作。负责人已明确自主实现、允许基于开源项目改造；具体基础项目与运行形态仍待选；产品目标和首期验收已归入 PRD 11，合同入口见[产品设计第 6 节](../design/02-CV制作管理与展示设计.md#6-boss-直聘投递自主实现方向)。

采用后的目标见[完整业务需求](../requirement/04-个人CV制作与管理需求说明.md)与[PRD 11](../prd/11-BOSS直聘自主投递.md)；本文保留调研证据及建议，不承担实施状态。

## 1. 结论与证据边界

CVory 自主实现和维护投递能力，复用上游成熟模块作为开发基础。建议优先核查 **boss-agent-cli** 的 Python 平台适配、去重和错误处理；浏览器方案核查 **jitou** 的页面操作与扩展实现；FastAPI 小原型可参考 **czc-good-job**。以模块适配成本选择一个主要基础，不将用户安装并操作第三方产品作为目标交付方式。

GitHub 插件用于仓库、README、许可证与关键源码核查，GitHub API 补充 stars、推送、发布和公开问题；Firecrawl 检索生态与官方 API 线索，Context7 核对 WXT 扩展机制。没有安装或运行这些工具，没有登录 BOSS、获取真实岗位、发送消息或简历、调用付费模型。上游测试数量和作者成功案例均为上游自述，不是 CVory 实测。

公开检索没有找到可据以接入的官方求职者自动投递 API 文档；不据此证明合作渠道不存在。候选项目使用网页自动化或非公开网页接口，不能视作官方授权 API。

## 2. 候选比较

stars 为核查时快照；最近推送取 pushed_at，不以 updated_at 代替代码维护证据。推送日期也不能证明全部功能已适配当前网页。

| 项目 | stars | 最近推送（UTC） | 能力与复用价值 | 许可及取舍 |
| --- | ---: | --- | --- | --- |
| [boss-agent-cli](https://github.com/can4hou6joeng4/boss-agent-cli) | 2203 | 2026-11-09 | Python、CLI/JSON、MCP；登录、搜索详情、筛选、候选池、去重、开聊、统计和停止恢复 | [MIT](https://github.com/can4hou6joeng4/boss-agent-cli/blob/master/LICENSE)；本地执行器集成首选候选 |
| [jitou／即投](https://github.com/impengpong/jitou) | 163 | 2026-11-03 | Chrome/Edge MV3 侧栏；岗位收集、文字简历、招呼语与确认后批量发送，自带模型接口 | [MIT](https://github.com/impengpong/jitou/blob/main/LICENSE)；扩展复用首选候选，原生 JS/HTML/CSS |
| [boss-helper](https://github.com/Ocyss/boss-helper) | 2505 | 2026-11-07 | WXT/Vue 扩展，规则和 AI 筛选、通勤条件、去重与招呼语 | LICENSE 为 MIT，但 README 明确禁止商用；商业集成前需澄清冲突 |
| [czc-good-job](https://github.com/czc6666/czc-good-job) | 59 | 2026-04-27 | 油猴 + 本地 FastAPI；单方向规则打分、固定招呼、收到新消息后发简历 | [MIT](https://github.com/czc6666/czc-good-job/blob/main/LICENSE)；代码小、技术栈接近，但规则带作者个人求职偏好 |
| [ai-job](https://github.com/yangfeng20/ai-job) | 727 | 2026-08-18 | Vue 油猴 + Spring Boot/Spring AI/MySQL，投递、回复、通知与支付 | [MIT](https://github.com/yangfeng20/ai-job/blob/master/LICENSE)；流程可参考，整套移植引入 Java 服务和重复账户／支付能力 |
| [Boss-Claw](https://github.com/YanQuan-dozzy/Boss-Claw) | 75 | 2026-11-07 | Electron/React/TS 桌面应用，画像、匹配、审核队列、沟通和 MCP，宣称支持四平台 | [Apache-2.0](https://github.com/YanQuan-dozzy/Boss-Claw/blob/main/LICENSE)；README 披露部分更新暂不开源，公开代码与安装包可能不一致 |
| [JobPilot](https://github.com/handsomekai924/jobpilot) | 74 | 2026-11-07 | Python uv workspace + Web 控制台，登录、岗位、匹配、招呼与批量发送 | README 标 MIT 又限制商业用途，目录未找到 LICENSE；暂不作商业复用首选 |
| [Ghost Job](https://github.com/InfernalAzazel/ghost-job) | 108 | 2026-11-08 | 桌面安装包，宣称支持匹配、自动回复和求职分析 | [PolyForm Noncommercial](https://github.com/InfernalAzazel/ghost-job/blob/main/LICENSE)，README 明确源码不公开；可试用产品，不是可移植源码底座 |

补查 [geekgeekrun](https://github.com/geekgeekrun/geekgeekrun)（3084 stars）和 [boss-cli](https://github.com/jackwener/boss-cli)（1044 stars）可作后续线索，但仓库元数据均未识别许可证；尚未深入核对授权和完整链路，不列为当前优先项。旧 [boss_batch_push](https://github.com/yangfeng20/boss_batch_push) README 提示未适配新版页面并引导迁移 ai-job，不宜作为新实现起点。

## 3. 优先候选的实际边界

### 3.1 boss-agent-cli：复用平台适配与服务编排

默认分支核查提交：8a4c203697060b9ce11d1935ca3ae039fcfd3f56；发布页最新稳定版为 [v3.2.1](https://github.com/can4hou6joeng4/boss-agent-cli/releases/tag/v3.2.1)。默认分支与发布版不能混作同一验证对象。

[README](https://github.com/can4hou6joeng4/boss-agent-cli/blob/8a4c203697060b9ce11d1935ca3ae039fcfd3f56/README.md) 提供 CLI 子进程、Python API 和 MCP 三种接入。按自主实现方向，优先评估拆取或改造平台适配和状态处理模块的成本；CLI 可用于对照验证，不预先确定为最终运行依赖。CVory 维护自己的业务接口、任务和简历版本映射。

[apply.py](https://github.com/can4hou6joeng4/boss-agent-cli/blob/8a4c203697060b9ce11d1935ca3ae039fcfd3f56/src/boss_agent_cli/commands/apply.py) 明确复用立即沟通，返回 mode=immediate_chat_apply，不能推断附件已发送。[greet.py](https://github.com/can4hou6joeng4/boss-agent-cli/blob/8a4c203697060b9ce11d1935ca3ae039fcfd3f56/src/boss_agent_cli/commands/greet.py) 有去重，以及平台成功后本地写入失败的单独处理，避免因记账失败自动重发。定制文字与附件送达仍须独立验证。

可省：认证兼容、搜索详情、过滤、部分去重、结构化错误和预算控制。仍需：CVory 简历版本映射、账户／任务隔离、审核界面、发送证据回写和安装更新。招聘者能力不属于首期求职范围。

### 3.2 jitou：复用扩展与侧栏流程

默认分支核查提交：4a6c77174949baae5fa0ae0df0bf945591798344，发布 [v2.0.0](https://github.com/impengpong/jitou/releases/tag/v2.0.0)。[README](https://github.com/impengpong/jitou/blob/4a6c77174949baae5fa0ae0df0bf945591798344/README.md) 描述本地运行、用户自带模型、检查选定岗位及招呼语后发送。

[manifest.json](https://github.com/impengpong/jitou/blob/4a6c77174949baae5fa0ae0df0bf945591798344/zitou-extension/manifest.json) 可确认 MV3、sidePanel、service worker 和 BOSS 页面脚本。已有原生 JS 扩展无需先迁移到 WXT 或 React。

可省：扩展入口、侧栏、岗位收集、模型配置与发送流程。仍需：CVory 账户配对、用户选择简历版本、任务／结果同步及失败恢复适配。文字简历用于生成招呼语，不自动成为发送给 HR 的 PDF。公开 [issue #9](https://github.com/impengpong/jitou/issues/9) 报告下拉加载新岗位后右侧列表不追加，应专门验收滚动与列表更新。

### 3.3 czc-good-job：小原型参考

[README](https://github.com/czc6666/czc-good-job/blob/main/readme.md) 明确当前主链为规则打分，resume.md 不是主链评分输入。FastAPI 接近 CVory 后端，但个人评分、单简历索引和油猴流程改成多用户产品仍需开发。最近推送较早，且存在公开[打招呼超时问题](https://github.com/czc6666/czc-good-job/issues/1)，不能只因技术栈相同就整套搬入。

## 4. 成功状态与不确定性

业务记录至少区分：已选岗位、已生成草稿、已发起沟通、招呼文字已确认发送、附件请求已发出、附件已确认送达。点击成功、HTTP 成功或系统默认招呼不足以证明 CVory 附件已经送达。

本机登录与执行减少云端托管凭据的需求，但不提供零风控或免封号保证。30～60 秒、120／150 次等数字来自第三方实现或有限观察，不是已核实的官方统一安全阈值。不能将“15 秒第三次必触发”或“每日固定 150 次”写成平台合同。

上游 [platform-risk](https://github.com/can4hou6joeng4/boss-agent-cli/blob/master/docs/platform-risk.md) 的观察仅适用于其测试条件；上游测试数量和作者转化案例不能证明我们的账号稳定性。没有验证 Token 完整算法、机房 IP 统一处理及封禁时长递增规则，不能断言云端必定失败或给出一概违法的结论。

本地保存不代表远程 AI 调用不传数据：送给远程模型的简历与 JD 会离开本机。MIT／Apache 源码许可也不代表取得平台数据或自动化业务授权。文档和源码核查不等于完整安全审计。

## 5. 减少工作量的接入建议

建议流程：CVory 选择并导出简历 → 本地执行器发现岗位 → 展示匹配依据和草稿 → 用户选择具体目标与发送范围 → 执行 → 按实际证据回写状态。

| 能力 | 优先复用 | CVory 补充 |
| --- | --- | --- |
| 简历制作、版本、Markdown／PDF | CVory 现有能力 | 选定版本快照与任务关联，不重建另一份主简历 |
| 登录、搜索、详情 | 以 boss-agent-cli 或 jitou 的适用模块为主要改造基础 | 自有平台适配边界、统一岗位字段和错误映射 |
| 硬条件、去重、匹配草稿 | 执行器现有能力 | 求职偏好、事实依据与未知项展示 |
| 沟通与附件 | 分别验证现有执行路径 | 精确状态与证据，不将开聊算作附件送达 |
| 任务历史 | 执行器本地记录 | 账户隔离、简历版本、审核记录、结果回写 |
| 本机连接与更新 | 上游安装方式 | 来源校验、明确配对和卸载；平台凭据留本机 |

开发起点建议为 CVory 现有简历版本与导出能力、自己的投递任务模型和一个 BOSS 平台适配器。开源模块按实际需要改造，保留来源、版本及许可信息；不先合并多个项目或引入其账户、支付和无关平台能力。是否采用自有扩展或本地执行程序，需结合主要基础项目的模块审查确定。

Web 页面不能直接启动用户本机 Python／Chrome；多用户云部署需要本地程序或扩展桥接。本地 Compose 后端与未来云端部署要分别设计，不能把一个用户的浏览器执行器直接复用于所有账户。

Context7 核对的 [WXT 入口文档](https://github.com/wxt-dev/wxt/blob/main/docs/guide/essentials/entrypoints.md) 说明 MV3 background 为 service worker，不能假设内存定时循环永久运行。选择自研扩展后才继续评估持久化、页面关闭及 worker 重启，无需为原型提前迁移框架。

## 6. 进入实现前的最小验收

先固定上游版本，在隔离目录核查依赖和离线能力；再用明确授权的账号验证一页搜索、一个详情和去重。只读通过后，分别验证一个已选目标的招呼与附件，核对对象、版本和状态；另验证未登录、限制、页面变化、停止及中断恢复，防止重复发送。

目前不能给出已节省多少百分比或保证的交付工期，因为尚未运行验证；可确认的是已有模块覆盖范围与所需集成工作。

[返回调研导航](00-调研导航.md)
