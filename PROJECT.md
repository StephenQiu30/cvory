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

仓库包含 Next.js 前端与唯一 NestJS/TypeScript 后端，均使用 pnpm 锁定依赖，数据库为 MySQL。现有模块包括账户/会话/GitHub、CV/历史/预设、照片、公开快照及 PDF。历史 Python 源码、测试和 uv 清单已移除，历史由 Git 承载。邮箱恢复/注销、DOCX/PDF 导入、PNG、AI、Chrome 插件及站主首页仍按 BACKLOG 实施；不以源码删除或局部验证代表完整产品验收。尚未接入远端 CI。

## 3. 技术选型

前端采用 Next.js、shadcn/ui + Radix UI、Tiptap 与 Geist，目标后端采用负责人明确指定的 NestJS + TypeScript，数据库继续使用 MySQL。固定前端基线、服务边界及配套工具建议、GitHub 身份与插件/AI 服务设计只在[产品设计 02](docs/design/02-CV制作管理与展示设计.md)维护。目录、编码和 API 通用规范由本文件维护，不在产品设计或业务需求中复制。

依赖版本线与升级取舍按产品设计执行，清单和锁文件位置见 §3.4。目标前后端各自以 pnpm-lock.yaml 固定版本；不保留 uv/Python 运行依赖；实际验证范围见 HANDOVER。

### 3.1 后端 TypeScript 与 NestJS 规范

后端代码以 [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)为规范基线，采用 NestJS + TypeScript strict；模块组织、依赖注入与生命周期参照 [NestJS 官方文档](https://docs.nestjs.com/)；HTTP 接口继续遵循 [Google API Design Guide](https://docs.cloud.google.com/apis/design)。框架更换不改变资源、所有权、etag 和错误语义。旧数据兼容由 SQL/TypeScript 显式迁移及固定 scrypt 测试向量维护，不保留第二套运行时。

- 按实际业务使用 Module、Controller 和可注入 Service；Controller 只处理 HTTP，Service 负责业务与事务，Guard/Pipe/Filter 分别处理权限、输入和错误；不为每个动作新增独立模块或通用 repository 框架。
- 类型/类使用 PascalCase，字段/方法使用 lowerCamelCase，不给接口加 I 前缀；后端文件按 Google 风格使用 snake_case，保留 Nest 职责后缀，如 `cv_version.service.ts`、`create_cv.dto.ts`。前端文件命名继续按 §3.2，不混用两端约定。
- 使用命名导出、明确导入，优先 const、需要重新赋值时用 let，不使用 var。字符串使用单引号，语句显式分号；局部值允许类型推断，公共接口标明契约类型。用 unknown 接收不可信数据，缩窄/运行时校验后使用，不用 any、非空断言或双重断言逃避校验。只抛出 Error，异步操作必须等待或显式处理失败，不吞异常。
- Google 指南约束代码写法；Nest 的装饰器、DTO 类和依赖注入按框架执行，Node 模块/编译配置按目标 Nest 版本验证，不照搬 Google 内部构建环境。业务状态和接口语义分别由 design 与 §3.3 定义；不将代码风格称为一套 Google 专用 NestJS 架构。
- 请求和响应使用具体 DTO 类，`class-validator` 与 ValidationPipe 校验输入，`@nestjs/swagger` 生成 OpenAPI；响应也需显式投影/序列化白名单，TS 类型或 Swagger 装饰器不替代实际数据校验。
- 单例 provider 不存请求 owner 或跨用户可变状态；从会话 Guard 的请求上下文取得身份。数据库操作使用事务和条件更新，捕获具体错误并转换为 PROJECT §3.3 的稳定响应。
- I/O 使用异步接口，解析、图片和重型文件处理移到受限独立 Node 进程，不在主事件循环执行无界 CPU/同步文件工作。超时、取消和进程清理显式处理，不以静默捕获或忽略 Promise 伪装成功。
- 日志只记录必要元数据，不记录完整私有简历、Cookie 或模型密钥；应用启动验证配置，退出释放数据库连接、浏览器和任务进程。依赖注入用于实际服务替换和测试，不搭建多余抽象层。

Nest 工程以 TypeScript strict、ESLint/typescript-eslint 与 Stylistic 校验类型、无 any/未使用变量、const/let、单引号和分号，Prettier 统一两空格及无对象括号空格。Nest DTO 的确定赋值由装饰器/校验承接；工具覆盖不等于 Google 指南全部语义条款自动检查。命令见 §8。

### 3.2 前端代码规范

界面以 Vercel Web Interface Guidelines 与 Geist 为参照，视觉/交互映射唯一维护在 [DESIGN](DESIGN.md)。组件按负责人指定的两份 shadcn 技能执行，当前项目为 Radix 系列，配置事实见产品设计 §4.1；不混用 Base UI API，不引入另一套整站组件系统。

- 目录职责按 §3.4 执行。页面专用组件靠近所属路由，实际出现复用时再提取；接口访问以外的内容转换及通用函数放 `src/lib/`。
- 独立读取并行发起，避免可消除的请求瀑布；编辑器等重型交互按需加载，向客户端只传必要数据。公开页面与私有请求分别处理缓存，不使用跨请求缓存共享 owner 内容。性能改动以实际测量验证，不为引用指南机械引入状态/缓存库。
- 默认使用 Server Components；Tiptap、表单及依赖浏览器交互的组件明确使用客户端边界。浏览器代码不导入服务端配置、数据库驱动或私密凭据。
- 基础界面组件统一使用 `src/components/ui/` 的 shadcn/ui + Radix UI；页面复用组件与根 DESIGN 的语义变量，简历正文和打印模板独立于管理界面样式。组件使用 PascalCase，组件文件使用 kebab-case。
- API 访问集中在 `src/lib/api/`，共用请求与错误处理。生成的接口类型同目录保存并标明来源，不手工修改；服务端数据不能靠类型断言跳过错误判断。表单、编辑器与本地状态各有明确职责，同一正文不维护多个保存源。
- 按功能组织组件和适用测试；不预建空模块、共享包或全局状态平台。具体依赖及版本线见产品设计，不在本节重复列出。

### 3.3 API 规范

接口采用 [Google API Design Guide](https://docs.cloud.google.com/apis/design) 的资源导向 REST/JSON 约定，使用 NestJS DTO、ValidationPipe、统一异常 Filter 和 `@nestjs/swagger` OpenAPI 落实。以下为本项目适用约定；产品行为与资源字段仍由对应设计定义。

| 范围 | 本项目约定 |
| --- | --- |
| 资源与命名 | 以 CV、样式预设、当前公开结果为资源。稳定资源名如 name: cvs/{id}，用户标题用 displayName；TypeScript 字段与 JSON 使用 lowerCamelCase，存量数据库 snake_case 通过服务端映射保留 |
| 路径与操作 | 对外前缀 /api，资源用复数名词；读取 GET、创建 POST、局部更新 PATCH、删除 DELETE。标准方法无法表达的动作才用自定义方法，如 POST /api/cvs/{id}:copy；保存不触发发布 |
| 更新与并发 | PATCH 使用 updateMask 指定更新字段，明确空值与清空语义；正文 JSON 可作为整体字段替换，不要求逐节点路径。已有 CV 的更新和删除携带服务端输出的 etag，条件写入不匹配返回 HTTP 409 / ABORTED，缺少必需 etag 返回 400 / INVALID_ARGUMENT；保持本地输入供处理 |
| 列表与时间 | 列表从起点支持 pageSize/pageToken 和 nextPageToken，token 不承载授权；不因此增加复杂筛选 UI。createTime/updateTime 由服务端产生，RFC 3339/UTC 表达 |
| 成功与错误 | 成功直接返回声明的资源/列表或文件，不套统一成功码。错误按 Google HTTP/JSON 形式返回 error 对象，含 code、message、status、details，HTTP 状态真实；请求校验统一为 400 / INVALID_ARGUMENT，通过 ValidationPipe 的 exceptionFactory 和全局 Filter 统一校验错误，不透传框架默认错误结构 |
| 可处理错误 | 未登录 401 / UNAUTHENTICATED、无权限 403 / PERMISSION_DENIED、不存在 404 / NOT_FOUND；details 包含 ErrorInfo 提供稳定 reason/domain，字段校验使用 BadRequest.fieldViolations。message 面向开发者使用英文，中文界面按稳定原因给出操作提示，不解析英文文案，也不向客户端暴露堆栈或私有资料 |
| 接口契约 | NestJS 请求/响应 DTO、路由声明及其生成的 OpenAPI 是对外 API 唯一来源，声明稳定 operationId、状态码及错误模型。前端基于 OpenAPI 与 axios + @umijs/openapi 生成 TypeScript 接口与类型定义；不手写第二份接口类型或仅靠 Zod 断言响应可信 |

文件上传和二进制下载声明内容类型及失败响应；不把 PDF 或备份强制包装成 JSON。实现时验证成功、未登录、非法输入和并发冲突的实际响应；接口变更同步 OpenAPI、生成类型和调用方，不维护第二份手写 API 合同。采用 REST/JSON，不为套用指南增加 gRPC 或 Protobuf 服务。

### 3.4 工程目录与依赖边界

`frontend/` 和 `backend/` 是固定目录，不再作为候选。以下结构标明目标职责；Nest 身份/CV/GitHub 模块已建立，未列为现有的能力仍按需迁移。历史 Python 代码已删除。实施时保留存量数据，只创建实际需要的文件，不用占位文件提前铺满目录。

```text
CV/
├── frontend/                            # Next.js；现有页面按需演进
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx              # 根壳、字体和全局样式入口
│   │   │   ├── globals.css             # 唯一全局主题 token 入口
│   │   │   ├── (public)/               # 目标：首页和 /u/{publicId}
│   │   │   ├── (workspace)/            # 目标：/workspace、账户与配置页面
│   │   │   ├── cvs/[id]/               # 编辑路由和 _components，独立页面壳
│   │   │   └── print/[ticket]/         # 受控固定快照打印视图
│   │   ├── components/
│   │   │   ├── ui/                    # shadcn Radix 基础组件源码
│   │   │   ├── layout/                # 共享页面壳
│   │   │   ├── resume/                # 跨场景复用正文/模板与文件界面
│   │   │   ├── account/               # 账户与身份交互
│   │   │   └── shared/                # 已出现复用的状态/对话框组合
│   │   ├── lib/
│   │   │   ├── api/                   # 统一请求、生成客户端/类型
│   │   │   ├── resume/                # 纯内容转换与文档模型适配
│   │   │   └── utils.ts               # cn 等小型通用函数
│   │   └── hooks/                     # 确有跨页面复用时建立
│   ├── public/                        # 仅可公开静态资源
│   ├── tests/                         # 浏览器与跨流程验证
│   ├── components.json
│   ├── package.json
│   └── pnpm-lock.yaml
├── backend/                            # 唯一 NestJS/TypeScript 后端
│   ├── src/
│   │   ├── main.ts                    # 启动、Pipe/Filter、OpenAPI
│   │   ├── app.module.ts              # 模块组合与生命周期
│   │   ├── config/                    # 配置读取和启动校验
│   │   ├── common/                    # 复用 Guard/Filter/请求上下文
│   │   ├── database/                  # mysql2 provider、连接/事务与显式迁移
│   │   └── modules/
│   │       ├── account/               # 身份、会话、资料与生命周期
│   │       ├── cvs/                   # CV、用途副本、修订历史与样式
│   │       │   ├── cvs.module.ts
│   │       │   ├── cvs.controller.ts
│   │       │   ├── cvs.service.ts
│   │       │   ├── dto/               # 如 create_cv.dto.ts
│   │       │   └── cvs.service.spec.ts
│   │       ├── files/                 # 导入候选、资源、PDF/PNG与备份
│   │       │   └── workers/           # 受限解析/渲染进程，如 pdf_render.worker.ts
│   │       ├── publication/           # 筛选候选、发布/撤回与匿名快照
│   │       ├── github/                # 公开仓库来源同步与项目素材
│   │       ├── ai/                    # 私有配置、三家 provider 与分析报告
│   │       │   └── providers/         # 统一接口和官方适配
│   │       └── delivery/              # 规则、设备配对、沟通/招呼与结果
│   ├── migrations/                    # 版本化 SQL/旧迁移；不在 API 启动时执行
│   ├── test/                          # API/真实 MySQL 集成验证
│   ├── package.json
│   ├── pnpm-lock.yaml
│   └── tsconfig.json
├── docs/                               # 正式文档与必要附件
└── PROJECT.md                          # 工程规范唯一入口
```

- 目标前后端均用 Node.js/TypeScript，各自在 `frontend/`、`backend/` 管理 package.json 和 pnpm-lock.yaml。负责人已明确要求删除历史 Python 实现；仓库只保留 NestJS 后端与 pnpm 依赖。删除前把现有制作页面依赖的资料、照片、预设、公开和 PDF 接口迁入 Nest，未完成的邮箱恢复/注销明确关闭，不将清理描述为所有需求完成。根目录不另建一套应用依赖，`docs/` 不承载运行工程。
- 路由组只组织 Next.js 页面壳，不改变 URL：`(workspace)/workspace/page.tsx` 才对应 `/workspace`；现有 `(workspace)/page.tsx` 仍是 `/`，首页切换须按发布能力实施，不能只移动文件就声称路由已改。路由私有组件留 `_components/`，复用后再提取；app 页面只编排，不承载数据库/模型密钥。
- 后端按业务 Module 组织 Controller/Service/DTO，数据库模型与对外 DTO 分离；Guard 校验 owner，Service 控制事务。按实际需要拆文件，不为每个操作增加 repository 等中间层。
- 后端模块以公开 Service/注入 token 协作，不跨模块访问对方私有 ORM 查询或导入 Controller；common 只放已复用基础设施，config 只管配置，database 不放业务规则，workers 不自行绕过授权写正式对象。存储字段、DTO 与领域状态分别维护，不将 ORM 模型直出匿名接口。
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
  - 目录 `backend/`，Node.js 24 + pnpm 12，NestJS 12、TypeScript 5.9、mysql2 3，精确版本见锁文件。
  - `pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm build`、`pnpm openapi`。
  - `CVORY_TEST_MYSQL_URL` 通过环境提供后运行 `pnpm test`，使用随机隔离 MySQL 库。
  - `pnpm db:migrate` 显式建表/迁移，`pnpm start` 启动首切片；完整迁移边界与配置见 [backend/README](backend/README.md)。
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

现有 NestJS 实现覆盖身份、资料、CV 条件保存/历史、副本、样式、照片、DOCX/文字 PDF 受限候选解析、PDF 与公开快照；制作端提供富文本／Markdown 切换、串行自动保存与账户隔离的本机恢复，Markdown/JSON 交换由前端和统一 API 协作。DOCX/PDF 样本、扫描提示、限额、取消清理和实际浏览器流程尚待完整验收。Python 源码删除，部署入口统一 Node；仍须区分代码、隔离验收与实际部署。邮箱恢复和注销入口关闭，不处理旧任务；未完成注销任务阻止就绪，业务库恢复需独立检查墓碑及账户状态。其余完整目标与未完成范围以 BACKLOG/HANDOVER 为准。数据库迁移显式执行，旧 CV 不自动归给首个注册者。

未要求时不提交、推送或发布。仓库尚未接入 CI；后续获授权推送须单独核对远端必需检查，不以本地结果代替。代码提交标题严格遵循 [CONTRIBUTING](CONTRIBUTING.md) 的 `type(scope): description` 规范。
