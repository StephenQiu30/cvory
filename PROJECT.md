# 项目规范

本文件是工程规则与文档维护方式的唯一入口。产品方案见 design，用户结果与验收见 PRD，视觉见根 DESIGN；这些内容不再混入业务需求。

## 1. 项目标识

| 项 | 值 |
| --- | --- |
| 产品名称 | 简序 · CVory，采用选定的 C/V 纸页图形 |
| 视觉方向 | 白纸黑灰、Geist 排版、无边框界面与少量蓝色点缀；具体参数见 [DESIGN](DESIGN.md) |
| 本地目录 | CV，保持不变 |
| 交付形态 | 开源自部署，MIT 已选；根 LICENSE/第三方声明尚待补齐 |
| 公开仓库 | [StephenQiu30/cvory](https://github.com/StephenQiu30/cvory)，默认分支 main |
| 技术包名 | frontend / cvory-backend（当前工程包名） |

## 2. 仓库现状

仓库包含需求与设计体系文档，以及已建立的 Next.js 前端 (`frontend/`) 与 FastAPI 后端 (`backend/`) 工程，包含 CV 制作、文件、公开展示和邮箱账户生命周期的实现。目标后端改为 NestJS + TypeScript，尚未建立 NestJS 工程或迁移现有服务；目标是开源自部署、GitHub 登录的个人简历/求职工具；GitHub、DOCX/PDF 导入、PNG、AI 和 BOSS 插件仍按设计评审，不把文档视作现有代码。依赖通过 pnpm 与 uv 分别管理，数据库使用 MySQL。尚未接入远端 CI。

## 3. 技术选型

前端采用 Next.js、shadcn/ui + Radix UI、Tiptap 与 Geist，目标后端采用负责人明确指定的 NestJS + TypeScript，数据库继续使用 MySQL。固定前端基线、服务边界及配套工具建议、GitHub 身份与插件/AI 服务设计只在[产品设计 02](docs/design/02-CV制作管理与展示设计.md)维护。目录、编码和 API 通用规范由本文件维护，不在产品设计或业务需求中复制。

依赖版本线与升级取舍按产品设计执行，清单和锁文件位置见 §3.4。目标前后端各自以 pnpm-lock.yaml 固定版本；现有 Python 后端的 uv.lock 仅描述迁移前实现；实际验证范围见 HANDOVER。

### 3.1 后端 TypeScript 与 NestJS 规范

后端采用 NestJS + TypeScript strict，组织和生命周期参照 [NestJS 官方文档](https://docs.nestjs.com/)；HTTP 接口继续遵循 [Google API Design Guide](https://docs.cloud.google.com/apis/design)。框架更换不改变资源、所有权、etag 和错误语义。现有 Python 代码仅作为待迁移实现与数据兼容依据，不继续作为目标技术栈。

- 按实际业务使用 Module、Controller 和可注入 Service；Controller 只处理 HTTP，Service 负责业务与事务，Guard/Pipe/Filter 分别处理权限、输入和错误；不为每个动作新增独立模块或通用 repository 框架。
- 类型/类 PascalCase、字段/方法 camelCase、文件 kebab-case，遵循 Nest 的 `.module.ts`、`.controller.ts`、`.service.ts` 职责命名。开启 strict，不用 any/类型断言跳过外部 JSON 的运行时校验。
- 请求和响应使用具体 DTO 类，`class-validator` 与 ValidationPipe 校验输入，`@nestjs/swagger` 生成 OpenAPI；响应也需显式投影/序列化白名单，TS 类型或 Swagger 装饰器不替代实际数据校验。
- 单例 provider 不存请求 owner 或跨用户可变状态；从会话 Guard 的请求上下文取得身份。数据库操作使用事务和条件更新，捕获具体错误并转换为 PROJECT §3.3 的稳定响应。
- I/O 使用异步接口，解析、图片和重型文件处理移到受限独立 Node 进程，不在主事件循环执行无界 CPU/同步文件工作。超时、取消和进程清理显式处理，不以静默捕获或忽略 Promise 伪装成功。
- 日志只记录必要元数据，不记录完整私有简历、Cookie 或模型密钥；应用启动验证配置，退出释放数据库连接、浏览器和任务进程。依赖注入用于实际服务替换和测试，不搭建多余抽象层。

检查脚本在 Nest 工程建立并验证后登记 §8；设计阶段不创建空工程或将不存在的脚本计为通过。

### 3.2 前端代码规范

- 目录职责按 §3.4 执行。页面专用组件靠近所属路由，实际出现复用时再提取；接口访问以外的内容转换及通用函数放 `src/lib/`。
- 默认使用 Server Components；Tiptap、表单及依赖浏览器交互的组件明确使用客户端边界。浏览器代码不导入服务端配置、数据库驱动或私密凭据。
- 基础界面组件统一使用 `src/components/ui/` 的 shadcn/ui + Radix UI；页面复用组件与根 DESIGN 的语义变量，简历正文和打印模板独立于管理界面样式。组件使用 PascalCase，组件文件使用 kebab-case。
- API 访问集中在 `src/lib/api/`，共用请求与错误处理。生成的接口类型同目录保存并标明来源，不手工修改；服务端数据不能靠类型断言跳过错误判断。表单、编辑器与本地状态各有明确职责，同一正文不维护多个保存源。
- 按功能组织组件和适用测试；不预建空模块、共享包或全局状态平台。具体依赖及版本线见产品设计，不在本节重复列出。

### 3.3 API 规范

接口采用 [Google API Design Guide](https://docs.cloud.google.com/apis/design) 的资源导向 REST/JSON 约定，使用 NestJS DTO、ValidationPipe、统一异常 Filter 和 `@nestjs/swagger` OpenAPI 落实。以下为本项目适用约定；产品行为与资源字段仍由对应设计定义。

| 范围 | 本项目约定 |
| --- | --- |
| 资源与命名 | 以 CV、样式预设、当前公开结果为资源。稳定资源名如 name: cvs/{id}，用户标题用 displayName；TypeScript 字段与 JSON 使用 lowerCamelCase，存量数据库 snake_case 通过 ORM 映射保留 |
| 路径与操作 | 对外前缀 /api，资源用复数名词；读取 GET、创建 POST、局部更新 PATCH、删除 DELETE。标准方法无法表达的动作才用自定义方法，如 POST /api/cvs/{id}:copy；保存不触发发布 |
| 更新与并发 | PATCH 使用 updateMask 指定更新字段，明确空值与清空语义；正文 JSON 可作为整体字段替换，不要求逐节点路径。已有 CV 的更新和删除携带服务端输出的 etag，条件写入不匹配返回 HTTP 409 / ABORTED，缺少必需 etag 返回 400 / INVALID_ARGUMENT；保持本地输入供处理 |
| 列表与时间 | 列表从起点支持 pageSize/pageToken 和 nextPageToken，token 不承载授权；不因此增加复杂筛选 UI。createTime/updateTime 由服务端产生，RFC 3339/UTC 表达 |
| 成功与错误 | 成功直接返回声明的资源/列表或文件，不套统一成功码。错误按 Google HTTP/JSON 形式返回 error 对象，含 code、message、status、details，HTTP 状态真实；请求校验统一为 400 / INVALID_ARGUMENT，通过 ValidationPipe 的 exceptionFactory 和全局 Filter 统一校验错误，不透传框架默认错误结构 |
| 可处理错误 | 未登录 401 / UNAUTHENTICATED、无权限 403 / PERMISSION_DENIED、不存在 404 / NOT_FOUND；details 包含 ErrorInfo 提供稳定 reason/domain，字段校验使用 BadRequest.fieldViolations。message 面向开发者使用英文，中文界面按稳定原因给出操作提示，不解析英文文案，也不向客户端暴露堆栈或私有资料 |
| 接口契约 | NestJS 请求/响应 DTO、路由声明及其生成的 OpenAPI 是对外 API 唯一来源，声明稳定 operationId、状态码及错误模型。前端基于 OpenAPI 与 axios + @umijs/openapi 生成 TypeScript 接口与类型定义；不手写第二份接口类型或仅靠 Zod 断言响应可信 |

文件上传和二进制下载声明内容类型及失败响应；不把 PDF 或备份强制包装成 JSON。实现时验证成功、未登录、非法输入和并发冲突的实际响应；接口变更同步 OpenAPI、生成类型和调用方，不维护第二份手写 API 合同。采用 REST/JSON，不为套用指南增加 gRPC 或 Protobuf 服务。

### 3.4 工程目录与依赖边界

`frontend/` 和 `backend/` 是固定目录，不再作为候选。以下是目标工程的最小结构；当前 backend/ 仍为 Python/FastAPI，Nest 目录尚未建立。实施时按能力迁移并保留已有内容，只创建实际需要的文件，不用占位文件提前铺满目录。

```text
CV/
├── frontend/                    # Next.js 前端工程
│   ├── src/
│   │   ├── app/                 # 页面、布局和路由专用组件
│   │   ├── components/
│   │   │   ├── layout/          # 共享 BasicLayout、Header、Footer
│   │   │   └── ui/              # shadcn/ui + Radix UI 基础组件
│   │   └── lib/
│   │       └── api/             # API 请求封装与生成类型
│   ├── public/                  # 可直接公开的静态资源
│   ├── package.json
│   └── pnpm-lock.yaml
├── backend/                     # 目标 NestJS + TypeScript 工程，尚未迁移
│   ├── src/
│   │   ├── main.ts              # 启动、全局 Pipe/Filter、OpenAPI 和生命周期
│   │   ├── app.module.ts        # 根模块组合
│   │   ├── common/             # 实际复用的 Guard、Filter 和配置
│   │   ├── database/           # 数据库 provider 与事务访问
│   │   └── modules/            # 按账户、CV、文件、公开、AI、投递等业务组织
│   ├── prisma/                # 采用 Prisma 时的 schema 和版本化迁移
│   ├── test/                  # API/集成测试；局部测试可与业务文件相邻
│   ├── package.json
│   ├── pnpm-lock.yaml
│   └── tsconfig.json
├── docs/                        # 正式文档与最终附件
└── PROJECT.md                   # 工程规范入口；其他根文档职责见 §3.5
```

- 目标前后端均用 Node.js/TypeScript，各自在 `frontend/`、`backend/` 管理 package.json 和 pnpm-lock.yaml。迁移前不删除 Python 清单/uv.lock；移除旧运行时须在替代链路及数据兼容验收后执行。根目录不另建一套应用依赖，`docs/` 不承载运行工程。
- 后端按业务 Module 组织 Controller/Service/DTO，数据库模型与对外 DTO 分离；Guard 校验 owner，Service 控制事务。按实际需要拆文件，不为每个操作增加 repository 等中间层。
- 前端通过 HTTP/OpenAPI 使用后端；Next.js 不直接访问 MySQL，后端不跨目录导入前端源码。PDF 渲染通过受控打印视图协作，具体流程见产品设计。
- 公共头像或附件必须经过发布规则筛选；私有 CV、上传文件、生成 PDF、数据库数据与备份不放 `frontend/public/`、`docs/` 或 Git，运行位置通过部署配置指定。
- 环境变量按进程配置；前端本地配置放 `frontend/.env.local`，后端放 `backend/.env`，真实值不入库。必要示例仅列变量名和非敏感示例；仅允许公开的值使用 `NEXT_PUBLIC_` 前缀。
- 缓存、构建产物、虚拟环境及测试临时文件不入库；建立工程时同步忽略规则。运行命令注明执行目录，实际可用命令登记 §8；当前不写入尚未验证的启动命令。

## 3.5 文档工作区

- docs 是唯一文档目录，也是 Obsidian vault，不建设知识库网站，不存 README、代码、脚本、依赖或生成目录。根规范、BACKLOG、HANDOVER 留在仓库根目录，通过相对链接引用。
- 一项完整业务需求对应一份产品 design；一个 design 可拆多份 PRD，一个 PRD 可拆多份 Plan。每份 PRD 的来源 design 唯一，每份 Plan 的来源 PRD 唯一。按可独立交付与验证的用户结果拆分，不为按钮、技术层或每次对话建立文档。
- [业务需求 04](docs/requirement/04-个人CV制作与管理需求说明.md)对应产品设计 02，派生 CV 和账户能力的 PRD 与 Plan。治理设计 01 维护文档规则，不作为产品需求拆分。
- 原始诉求 01 保留原文，首次入库为 `d3e89cf216377d0a907358667bd5eac454afde8b`。04 是可维护的业务说明，只写目标、角色、能力和边界。重复补充中的业务内容归并到 04；过程指令和规范不作为独立需求文件。来源历史可查 Git，不为补齐编号改名原始文件。
- 工程目录、通用编码与 API 规范只在 PROJECT，产品技术方案和取舍只在 design，用户范围与验收只在 PRD，执行步骤只在 Plan，优先级/依赖/状态只在 BACKLOG，最近交付证据只在 HANDOVER。规范修改不反向扩写业务需求。
- 不在项目写入过程确认单、中间稿、提示词、原始工具输出、临时截图、重复调研摘要或未采用候选。必要结论并入正式正文，只保留会继续使用的最终附件。临时分析在项目外或会话中完成。
- 文档各目录独立编号，00 导航是入口；使用 NN-中文名.md，父子来源显式链接。原始文件名及业务 ID 不因重排改写，已整理的条目 ID 不无故重编号。
- Obsidian 使用核心功能、相对 Markdown 链接，自动链接更新关闭；通用配置可入库，个人布局/缓存/回收站不入库，不使用社区插件。

## 8. 质量与验收

工程已建立真实启动、检查、测试与构建验证命令，禁止跳过检查虚构通过。

- **目标 NestJS 后端 (`backend/`)**
  - 尚未建立 package.json、构建、lint、单元/集成测试及启动脚本；待实现后登记实际执行的命令，不以设计稿中的候选脚本算通过。
  - 目标运行时延用项目 Node.js 24 LTS 和 pnpm，数据库继续 MySQL。NestJS/ORM/解析工具精确版本在集成验证后锁定。
- **迁移前 Python 后端 (`backend/`，现存命令)**
  - 依赖安装与同步：`cd backend && uv sync`
  - 单元与集成测试：`cd backend && uv run pytest -v`
  - 启动业务服务：`cd backend && uv run uvicorn app.main:app --host 127.0.0.1 --port 8000`
  - 本地环境依赖：Python 3.12+、MySQL 8.4/9.x（数据库 `cvory`，utf8mb4）
- **前端 (`frontend/`)**
  - 依赖安装：`cd frontend && pnpm install`
  - OpenAPI 客户端生成：`cd frontend && pnpm run openapi`（基于后端 Swagger/OpenAPI 生成类型与服务）
  - 类型检查与生产构建：`cd frontend && pnpm build`
  - 启动开发服务：`cd frontend && pnpm dev`（默认端口 3000）
  - 代码规范检查：`cd frontend && pnpm lint`
  - 浏览器与文件合同检查：`cd frontend && pnpm exec playwright test`（需隔离后端与前端运行环境，配置见 frontend/README）
- **容器化编排 (`docker-compose.yml`)**
  - 校验与启动：`docker compose up -d`（服务前后端，复用宿主机已运行的 MySQL）
  - 查看日志与状态：`docker compose logs -f`、`docker compose ps`
  - 停止服务：`docker compose down`
- **文档检查**：相对链接、锚点、大小写、编号、来源关系、业务覆盖与事实；纯文档变更使用 `git diff --check`。

## 9. 当前边界

应用已实现简历制作与条件保存、独立副本、三套模板及个人预设、JSON／Markdown 交换、PDF 生成和按字段公开展示，并提供邮箱密码注册登录。目标补充 GitHub 登录与公开项目、Markdown 编辑模式、DOCX/文字 PDF 导入、PNG 导出、站主首页、三家官方 AI 预设（部署者自填配置）和 Chrome 插件（人工上传 PDF，插件筛选/沟通/招呼）。目标后端为 NestJS + TypeScript，现存 FastAPI 仍未迁移，Python 检查不能代表 NestJS 验收。当前只开展需求与服务设计评审，不启动实现；完整目标以业务需求和产品设计为准，实现范围和验证边界以 BACKLOG 与 HANDOVER 为准；代码存在及局部测试不代表完整链路已经可靠。数据库存量迁移须显式执行，旧 CV 不自动分配给首个注册者；邮箱验证、密码恢复和注销已有代码，完整生命周期、真实互联网部署及恢复验收仍须独立完成。

未要求时不提交、推送或发布。仓库尚未接入 CI；后续获授权推送须单独核对远端必需检查，不以本地结果代替。代码提交标题严格遵循 [CONTRIBUTING](CONTRIBUTING.md) 的 `type(scope): description` 规范。
