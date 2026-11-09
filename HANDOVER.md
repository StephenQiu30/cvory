# 项目接手文档

任务调度唯一入口为 [BACKLOG](BACKLOG.md)。

## NestJS 服务设计与自部署边界

后端已明确选用 NestJS + TypeScript，MySQL 与现有前端基线保留；[PROJECT](PROJECT.md)同步编码/API/目录规范，[设计 02](docs/design/02-CV制作管理与展示设计.md)补充目标服务模块、Node 文件链与兼容切换要求。现存 backend/ 仍是 FastAPI/Python，NestJS 工程、依赖和真实脚本尚未建立；没有改应用代码、迁移数据或切换服务。

负责人通过问答明确：MIT 开源自部署，由使用者自行填写火山引擎、DeepSeek、OpenAI 官方密钥与模型；首期只支持 Chrome，PDF 由用户在 BOSS 页面手工上传，插件仅负责筛选、沟通及招呼。密钥私有管理/加密/脱敏、三家协议适配为设计建议；具体模型、预算、保留与 Chrome 分发仍待落实。根 LICENSE/第三方许可声明尚未补齐，MIT 选择不等于许可文件已交付或应用已发布。

[需求 04](docs/requirement/04-个人CV制作与管理需求说明.md)、相关 PRD/Plan 和导航已同步；PDF 首期文字层、扫描件提示/OCR后续，站主首页展示简历与 GitHub 项目的选择保留。首期投递验收不再要求自动附件；人工上传确认标注用户来源，不能冒充平台回执。AI 新增三家预设和自部署私有配置验收。

## 设计依据与未验证项

- NestJS 官方文档/Context7 核对模块、DTO/ValidationPipe、异常/Swagger 和 Prisma 接入；Prisma baseline 为存量迁移建议，不运行 reset 或 db push。
- 文件链建议改为 Mammoth → 清洗/校对，PDF.js 提取/逐页 PNG，Node Playwright 生成 PDF；官方文档不等于本项目已通过 DOCX/文字 PDF/PNG 验收。
- OpenAI Docs 核对官方 JS/TS SDK/Responses，DeepSeek 官方文档核对兼容格式；Ark 官方动态页面抓取超时，精确参数及地域在实施前复核。三家均未配置或调用真实服务。
- 竞品固定源码、许可证及 REA 限制继续见[调研导航](docs/research/00-调研导航.md)；没有重跑竞品运行观察或登录 BOSS。

## 验证与交付边界

文档检查通过：49 份 Markdown、344 个本地链接/锚点，PRD/Plan 01～12 唯一来源及编号、既有验收编号保留，`git diff --check` 无空白错误。原始需求 01、frontend/backend、Compose 与环境示例相对 HEAD 无差异；NestJS/Chrome/人工 PDF/三家官方预设/自部署和 MIT 的已确认范围已交叉核对。

只调整正式文档和 AGENTS 中的技术规范锚点，保留已有文档修改；原始需求 01、前后端应用、依赖、数据库、容器和部署未改。未运行应用测试，不把 Python 检查视作 NestJS 通过；未配置密钥、调用付费 AI 或发送消息/简历。负责人已授权将文档提交并推送至 main，实际结果以 Git 记录为准；不涉及应用发布。

当前继续停留在需求与服务设计评审，完整业务链路及 NestJS 迁移均未验收。后续执行按 BACKLOG，技术建议不冒充逐项确认。
