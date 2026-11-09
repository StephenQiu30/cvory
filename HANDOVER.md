# 项目接手文档

任务调度唯一入口为 [BACKLOG](BACKLOG.md)。

## Vercel、shadcn 与 Google TypeScript 工程规范

前端以 Vercel Web Interface Guidelines/Geist 和负责人指定的两份 shadcn 技能为规范，视觉与组件/交互规则集中在 [DESIGN](DESIGN.md)；后端以 Google TypeScript Style Guide、NestJS 业务模块和 Google API 指南分别约束代码、服务边界及接口。[PROJECT](PROJECT.md)细化目录、文件命名和依赖方向，产品技术入口同步到[设计 02](docs/design/02-CV制作管理与展示设计.md)。

目录是目标设计：前端区分路由编排、页面私有组件、共享 Radix 组件、简历渲染及生成 API 客户端；后端区分配置、基础设施、数据库、业务模块、DTO 与受限文件任务。后端 snake_case 保留 Nest 职责后缀，前端沿用 kebab-case。没有新建空目录或移动运行代码。现存 FastAPI 尚未迁移，NestJS 工程/脚本和完整业务链路未验收；MIT、自部署、用户填写三家官方 AI、Chrome 与人工上传 PDF 的确认范围保持。

## 依据与验证

- Vercel 插件查询官方资料，直接读取 Web Interface Guidelines、Geist 色彩/排版；不创建或关联 Vercel 项目，不改变自部署交付形态。
- 指定的两份 shadcn SKILL 均已读取。前端执行 `pnpm dlx shadcn@latest info --json` 确认 radix-nova/Radix、Tailwind v4、Lucide 和 @/ 别名；CLI docs 查询 Field/Button/Card/Dialog/Tabs/Select 并读取官方页面。未执行 init/add/apply，组件、依赖和主题均未改。
- Google TypeScript 官方指南已读取；按本项目 Nest/Node 环境落实风格，不将其表述为 Google 专用 NestJS 服务架构。自动 lint/格式化规则须在实际建立 Nest 工程后验证。
- 文档检查覆盖 49 份 Markdown，346 个本地链接/锚点；PRD/Plan 唯一来源与编号、既有验收编号保留及 `git diff --check` 通过。仅规范/说明和设计变更，原始需求 01、前后端代码、依赖、数据库、容器和部署未改；纯文档没有运行应用测试。

## main 交付

需求/服务设计阶段已推送 main，提交 `2c58235178b87fecf8d8b0f1f0ccc224ffd655b1`。远端查询未发现 Actions 运行或 commit checks/status 项，不能表述为 CI 通过。规范与目录变更按负责人授权继续提交、推送 main，实际提交与同步结果以 Git 记录为准；仓库尚未接入远端 CI。

未执行应用发布、真实 AI 调用或 BOSS 发送。后续实现按 BACKLOG，规范完成不等于 UI/后端迁移已完成。
