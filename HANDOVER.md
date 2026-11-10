# 项目交接记录

## AI 简历分析与岗位匹配

- 增加 NestJS AI 模块、owner 隔离的 provider 设置、连接测试、输入预览、已保存 CV/历史版本分析、报告读取和分页。用户分别填写火山引擎 Ark、DeepSeek、OpenAI 官方 API Key 与模型；固定官方地址，服务端禁止重定向。OpenAI 使用 Responses API 且关闭 response storage，另两家使用官方 Chat Completions JSON mode。
- 迁移 `007_ai_resume_analysis` 创建密钥、用量和报告表；迁移仍需由部署者显式运行。API Key 与分析输入/报告正文使用部署者配置的 AES-256-GCM 密钥加密，正文和索引记录在第 7 天后清理；报告/用量读接口按 owner 隔离。部署者必须备份并保持 `AI_ENCRYPTION_KEY` 稳定，丢失或更换会使既有密文无法读取。
- 编辑器可先审阅确切发送内容，再选择诊断、岗位匹配、段落改进或招呼草稿。默认排除联系方式、照片、隐藏字段与隐藏模块；服务端核验证据字段和原文。建议只应用于当前且未变化的目标私有草稿，不能直接修改历史、发布快照或投递材料。
- CVory 不设置请求、输入/输出 token 或金额上限；供应商费用由用户承担。连接测试也可能收费。相同 request ID 不重复调用；超时、断流、5xx 或不完整响应保留可得用量并记为未知，不自动重放。响应中断时前端按 request ID 取回报告；遗留运行记录超过 3 分钟转为未知，仍按 7 天期限清理。

## 工程检查与验收边界

- 后端 `pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm openapi` 通过；OpenAPI 由 Nest 构建生成。
- 前端 `pnpm openapi`、`pnpm exec tsc --noEmit`、`pnpm build` 通过；`pnpm lint` 为 0 个错误、1 条既有 `postcss.config.mjs` 匿名默认导出警告。`git diff --check` 通过。
- 未添加或运行测试套件，未运行浏览器验收、隔离 MySQL/迁移、真实 AI 提供商请求或部署。AC-AI-01～07 的完整产品验收仍待完成；静态检查不代表模型质量、供应商计费/数据政策或生产恢复已验证。
- 仓库尚无远端 CI；本地结果不代表远端检查或部署通过。

下一项按 [BACKLOG](BACKLOG.md) 继续。
