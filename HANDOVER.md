# 项目接手文档

任务调度只在 [BACKLOG](BACKLOG.md)。

## 登录与注册弹窗

日期：2026-11-04（Asia/Shanghai）。Figma 中的桌面和手机登录画板已改为邮箱密码弹窗，并增加注册状态；设计入口为 [登录弹窗](https://www.figma.com/design/sLNuFRPH0Zg6gF8YfNNCsR?node-id=95-44747)、[手机登录](https://www.figma.com/design/sLNuFRPH0Zg6gF8YfNNCsR?node-id=95-44947)。

共享账户状态提供登录与注册弹窗；简历库、账户设置和编辑器使用同一入口。关闭弹窗保留原页面并恢复触发焦点。编辑器会话失效后重新登录不会丢弃草稿，保存由用户重新触发。账户认证和服务端权限模型未更改。

### 验证

- 隔离 SQLite、临时存储与本地前后端运行 Playwright：11 项测试通过，覆盖原有制作与发布流程，以及手机弹窗关闭与焦点、会话过期保留草稿、重新登录保存、设置页内登录后继续操作。桌面 1440px、手机 390px 实际截图检查弹窗，页面无横向溢出。
- 前端 `pnpm build`、`pnpm lint` 通过；lint 保留 `postcss.config.mjs` 既有匿名默认导出警告。
- 未执行真实部署、完整无障碍审计或跨浏览器验收。验证使用合成账户，不访问用户现有数据。

### 运行边界

实际服务需要 MySQL、私有文件目录和正确的前后端地址；存量数据库需先执行 `backend/migrations/001_account_ownership.py`，旧 CV 不自动分配。PDF 依赖 Chromium 和受控打印入口；打印上下文目前在单个后端进程内短期保存。邮件验证、密码找回和真实互联网部署尚未提供。

工程规则见 [PROJECT](PROJECT.md)，业务与实施合同见 [产品设计 02](docs/design/02-CV制作管理与展示设计.md)，视觉见 [DESIGN](DESIGN.md)。
