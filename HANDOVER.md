# 项目接手文档

任务调度唯一入口为 [BACKLOG](BACKLOG.md)。

## 唯一 NestJS 后端与 Python 清理

负责人已授权合并 main、推送及移除历史 Python 实现。仓库以 Next.js + NestJS/TypeScript + MySQL 为唯一运行链路：删除 34 个 Python 源文件及 pyproject/uv.lock，旧源码由 Git 历史承载；数据库、私有文件、真实 .env 和原有 Docker 卷未改动。Compose/Dockerfile、默认端口、示例配置、显式 SQL/TypeScript 迁移和前端均已统一。

Nest 承接账户资料、旧 scrypt/会话与密码修改、GitHub 无邮箱登录/安全绑定、本人公开仓库、CV/历史/预设、图片、公开快照与 PDF。前端只使用 Nest 生成的 `openapi.json`/单一 API namespace，区分输入默认值与输出字段，并生成可空类型；没有第二套 Python 合同。

公开候选绑定来源 etag 和当前公开版本，发布/撤回做条件更新；匿名端仅返回筛选快照，当前公开来源受删除保护。图片在有界子进程解码，兼容旧本 CV 磁盘头像；列表先查询有序 ID 再读取 JSON，并顺序规范化旧照片，避免大照片耗尽 MySQL 排序缓冲或自触发并发上限。PDF 固定输入、限制来源/并发/时间，取消和超时清理票据/子进程；平台拒绝进程组信号时安全降级，清理错误不会令 API 退出。

## 验证证据

- 本机 Node.js 24.19.0、pnpm 12.4.2、MySQL 9.7.1。后端 `pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm build`、`pnpm openapi` 通过；真实 HTTP/MySQL 测试 25 项通过，全部使用随机 `cvory_nest_test_*` 库及合成数据，测试库剩余 0 个；临时容器与前端/夹具进程均已停止。
- 覆盖旧密码/会话、无邮箱身份/重放/绑定冲突、跨账户、ETag 并发、幂等创建/恢复、保留范围/空保存、图片/未知字段/请求大小、发布隐私与过期拒绝、旧 schema 重入与 legacy 归属、未完成注销任务阻止就绪。
- 前端类型检查、lint、生产构建通过；未修改 `postcss.config.mjs` 的一个既有匿名默认导出警告保留，无 lint 错误。
- 使用生产 Next.js、真实 Chromium/HTTP/MySQL 与模拟 GitHub 外部边界，执行完整 Playwright：25 项通过、无跳过。包括故障服务单独实例、桌面/手机、条件保存、历史恢复、Markdown/JSON、图片独立、公开/撤回、Tiptap 及实际 PDF 下载。
- `docker compose config --quiet`、Node 生产镜像构建通过。镜像内显式迁移与健康检查、PNG→JPEG、实际 PDF（38,766 字节）、取消两次后重新导出及就绪验证通过；生产依赖不含 TypeScript/旧 Python 应用清单。镜像 `pnpm --version` 在无网络模式下输出 12.4.2。
- 容器软件源使用 HTTPS，并从官方 Node 信任库引导 slim 镜像证书；依赖/生产依赖/编译分阶段，运行时不临时下载 pnpm。
- 独立审查的旧头像并发问题已补失败场景并修复；真实集成另发现大 JSON 排序失败，使用 ID 排序后取文档修复。实际浏览器发现 PDF 清理信号权限错误导致 API 退出，修复后本机及 Linux 容器 PDF/取消恢复通过。
- 文档检查覆盖 52 份 Markdown，本地链接/锚点及 `git diff --check` 通过；调研中的旧代码依据改为固定 Git 快照，原始需求正文不变。

## 运行与未完成边界

运行和备份要求见 [backend/README](backend/README.md)、[frontend/README](frontend/README.md) 与根 [README](README.md)。启动不自动迁移；SQL DDL 不整批回滚。切换/回退需先备份并在副本演练，管理员显式认领 legacy，不自动认领或重置数据。

邮箱恢复、注销/撤销及删除墓碑重放尚未由 Nest 实现，相关入口关闭；有未完成注销任务时拒绝就绪，保留任务、墓碑和密钥，恢复旧备份须独立核对删除记录。删除源码不等于这些能力已验收。Markdown 持续编辑、DOCX/文字 PDF、PNG、站主首页、项目选入/发布、AI、Chrome 插件、MIT 根许可证及第三方声明继续按 BACKLOG 实施。

真实 GitHub 授权、公网部署和备份恢复仍待独立验收；没有执行业务库迁移、真实邮件/模型/BOSS 动作或生产部署。交付目标为 main，提交和远端同步以 Git 引用核对；仓库未配置远端 CI，本地结果不冒充远端检查。
