# 项目交接记录

## 完整数据库 schema 与本机服务重启

- 后端唯一 SQL 定义为 [`backend/schema.sql`](backend/schema.sql)。`pnpm db:schema` 显式应用该完整结构；API 启动只校验所需表和兼容列，不自动执行 DDL。已移除版本化 migration SQL、迁移执行器和版本记录依赖；测试夹具改用 schema 应用器。
- 应用命令只创建缺失表、补齐兼容字段并扩展账户列容量，不删除表、字段或数据。修改 schema 前生成了本机备份 `/tmp/cvory-before-schema-1794296490399.sql`，权限为 `0600`。
- 本机 MySQL 9.7.1 的 `cvory` 库已应用 schema。应用前后均为 1 个账户、3 份 CV；22 张当前应用所需表已就绪，既有的 `auth_attempts` 表保留。
- Nest API 通过本地 pnpm 在 `http://localhost:4321` 运行；Next.js 开发服务在 `http://localhost:1234`。`/api/health` 与首页均返回 HTTP 200。这是本机开发进程，不是 Docker Compose 容器部署。
- 后端 `typecheck`、`lint`、`format:check`、`build` 与 `git diff --check` 通过。未运行测试套件、浏览器产品验收、真实 GitHub/AI/BOSS 流程或 Docker 镜像构建。

后续顺序与未完成验收见 [BACKLOG](BACKLOG.md)。
