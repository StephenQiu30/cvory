# CVory NestJS 后端

唯一后端运行时为 NestJS + TypeScript、Node.js 24、pnpm 12、MySQL。模块包括账户、CV/历史/预设、GitHub、公开展示、图片、DOCX/文字 PDF 候选解析与 PDF/PNG 导出，规则见 [PROJECT](../PROJECT.md)。

## 开发与运行

在 `backend/` 执行，将 [.env.example](.env.example) 合并到本机 `.env`，先建立独立数据库和用户。

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm db:migrate
pnpm exec playwright install chromium
pnpm start
```

默认端口 `4321`。`PUBLIC_APP_ORIGIN` 与浏览器公开入口一致，HTTPS 时启用 Secure Cookie；`FRONTEND_INTERNAL_URL` 是 PDF 子进程访问的受控前端来源。反向代理不自动信任任意转发地址。API 前缀 `/api`，`/api/health` 校验显式迁移及数据库就绪，不替代应用完整验收。

`pnpm db:migrate` 运行已编译的迁移入口，可在只有生产依赖的镜像执行。开发修改迁移源码后先 `pnpm build`，或使用 `pnpm db:migrate:dev`；启动 API 不建表或修改 schema。

GitHub 由部署者填写 OAuth App Client ID/Secret，回调 `${PUBLIC_APP_ORIGIN}/api/account/github/callback`。只申请 `read:user`，access token 不入库、不读私库。旧 scrypt/会话保留；新 GitHub 账户不创建假邮箱/密码，新增邮箱注册默认关闭。

## 数据与处理边界

- 显式迁移建立兼容 SQL 基线、补齐旧 owner/lifecycle 字段、创建身份/历史及公开版本约束，并扩大账户照片字段。保留已有表、owner、publicId 和 JSON snake_case，DDL 中断可重入；备份后在副本演练。
- `pnpm db:migrate --assign-legacy-to <账户ID或邮箱>` 是管理员显式认领命令，目标必须唯一且活跃；平常迁移不认领 `legacy` CV。
- `CV_HISTORY_LIMIT` 默认 50、范围 1～500，包含当前版本；保存时裁剪超限历史，没有按天过期。首次修改存量 CV 保留旧版，空保存不追加；恢复幂等另建私有 CV。
- 图片限 JPEG/PNG/WebP、2 MiB、20M 像素；受限子进程解码、去元数据并规范化，照片随 JSON/历史保存。旧 `data/avatars/{cvId}.*` 仅读取本 CV 本地文件，不远程抓取；资源缺失明确失败，不擦掉旧引用。
- DOCX/文字 PDF 单文件限 10 MiB；签名核验后写入 `DATA_DIR/imports/` 的权限受限临时目录，由有时间和 V8 堆限额的独立 Node 子进程解析。成功、失败和客户端取消后清理，进程异常遗留项按 TTL 清除；扫描 PDF 不调用 OCR。具体预算和候选契约见[产品设计 02 §3、§4.3](../docs/design/02-CV制作管理与展示设计.md#43-内容文件与-pdf-的协作)，完整样本验收状态见 [HANDOVER](../HANDOVER.md)。
- PDF 固定来源 etag/快照，使用受限 Node/Chromium 子进程、临时票据和固定前端来源；并发 2，75 秒超时、取消/失败清理进程和票据，结束重新检查所有权/账户状态。
- PNG 从相同固定 PDF 使用 PDF.js Node Canvas 逐页渲染；144 DPI、最多 30 页、单页边长 4,096 px、总像素 64M、输出 50 MiB，子进程堆 256 MiB、45 秒超时，并与其他文件任务共用 2 个进程名额。单页下载 PNG，多页 ZIP 按页码排序；文件样本和容器资源验收见 [HANDOVER](../HANDOVER.md)。
- 公开候选绑定来源 etag 和当前公开版本，发布/撤回拒绝过期输入；匿名数据只包含筛选快照。GitHub 绑定或已验证的存量身份可发布，未验证新邮箱不能绕过。
- 邮箱恢复和注销尚未开放；`DELETION_ENABLED=true` 或数据库有未完成注销任务时不允许就绪。旧状态/任务/墓碑不删除；启用过的注销与备份恢复需单独完成迁移验收。

## 检查与接口生成

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm openapi
```

Nest DTO/路由与共享运行时校验生成唯一 `openapi.json`。前端在 `frontend/` 运行 `pnpm openapi` 生成客户端；输入默认值、可空字段及 AIP 动作由生成配置处理，不手改生成文件。

真实 MySQL 集成测试：通过环境安全提供可创建/删除隔离库的 `CVORY_TEST_MYSQL_URL`，执行 `pnpm test`。测试创建随机 `cvory_nest_test_*` 库并清理；缺配置会失败而不是跳过，不应使用真实账户或业务库运行场景。

浏览器夹具在编译测试后运行 `node dist-test/test/browser_server.js`，仅监听 `127.0.0.1:4323`，真实 MySQL 和本地 HTTP，GitHub 外部身份/仓库模拟；Ctrl+C 清理测试库。前端默认测试入口 `http://127.0.0.1:3123`，命令见 [frontend/README](../frontend/README.md)。真实 GitHub、公网部署与备份恢复需独立验收。
