# 项目接手文档

任务调度只在 [BACKLOG](BACKLOG.md)。

## 全局状态展示与异常处理

修复分支为 `codex/unify-global-status`。视觉合同见 [DESIGN §5.1](DESIGN.md#51-全局状态与异常反馈)；[桌面](https://www.figma.com/design/sLNuFRPH0Zg6gF8YfNNCsR?node-id=166-38664)和[手机](https://www.figma.com/design/sLNuFRPH0Zg6gF8YfNNCsR?node-id=166-38699)状态稿先于代码同步，保留可编辑图层。

StatusMessage 统一错误、成功、说明与处理中；LoadingState 统一读取占位，StatusBadge 展示保存、邮箱及发布状态；StatusPage 统一页面异常、404 和未公开结果。API 状态码的中文提示集中处理，不展示服务端错误原文；登录过期依据错误码决定入口。新操作清除旧结果，重试保留输入并展示进度。样式改名／删除的错误留在对应弹窗内，复制失败提供手动复制提示。

验证使用独立临时 SQLite、模拟邮件与 example.com 合成账户；生产构建下完整 Playwright 套件 22 项通过，无跳过。新增 6 项覆盖网络失败重试、成功被错误替换及输入保留、密码校验与退出失败、复制失败手动恢复、404／未公开／服务端异常、样式弹窗内的失败反馈。故障通过浏览器拦截及指向不可用后端的第二个前端进程注入。检查了桌面、手机及深色反馈，无页面横向溢出。

`pnpm lint`、生产构建及构建内类型检查通过，lint 仅保留 `postcss.config.mjs` 的既有匿名默认导出警告；文档相对链接与空白检查通过。生产数据和部署未修改，后端代码未改、后端单测未重跑。这些检查不替代 MySQL 持久化、部署与恢复的完整链路验收。

交付目标为 `main`；提交、合并和推送结果以 Git 记录为准。

工程规则见 [PROJECT](PROJECT.md)，业务合同见 [产品设计 02](docs/design/02-CV制作管理与展示设计.md)。
