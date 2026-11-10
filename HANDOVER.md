# 项目交接记录

## 站主首页与 GitHub 项目发布

- `/` 使用运行环境 `SITE_OWNER_PUBLIC_ID` 读取指定站主的公开快照；未设置或尚未发布时展示空状态，不推断首个登录用户。`/u/{publicId}` 与首页复用相同只读页面和匿名接口；简历目录链接到个人简介、有效简历模块及精选项目。
- 原简历工作区迁至 `/workspace`；顶部导航、简历编辑返回、公开设置和登录退出后的工作区链接已同步。桌面使用侧边目录，窄屏使用横向目录；链接有明确焦点态和触控高度。
- 新增显式 SQL 迁移 `006_github_featured_projects`，按账户保存最多 12 个仓库候选、顺序和独立的个人贡献。保存或刷新项目时服务端按已绑定 GitHub 数字 ID 重查仓库公开状态；发布预览再核验并取新元数据。保存候选不改变公开快照，只有确认发布后才更新；项目简介、stars 与个人贡献分开呈现。
- GitHub API 合同及前端生成客户端已同步。公开接口设置 `no-store`；撤回后站点继续从唯一发布快照读取，不提供旧项目候选给访客。

## 工程检查与验收边界

- 后端 `pnpm openapi`、`pnpm typecheck`、`pnpm lint`、`pnpm format:check` 通过；`openapi` 包含后端构建。
- 前端 `pnpm openapi`、`pnpm build` 通过；`pnpm lint` 为 0 错误、1 个既有 `postcss.config.mjs` 匿名默认导出警告；首次构建发现并删除了孤立的 `.next/dev/types/validator.ts` 生成缓存，随后生产构建通过。`git diff --check` 通过。
- 原工作区浏览器流程入口已改为 `/workspace`，但未运行测试套件或真实浏览器；未执行数据库迁移、真实 GitHub 请求、公网部署或匿名隐私端到端检查。因此 PRD 07/08 仍未完成验收。
- 当前仓库尚未接入远端 CI。推送后应单独核对远端状态；本地检查不代表真实服务或产品验收。

下一项按 [BACKLOG](BACKLOG.md) 继续。
