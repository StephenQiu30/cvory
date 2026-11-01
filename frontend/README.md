# CVory 前端工程

基于 Next.js 16 + React 19 + Tailwind CSS v4 + Tiptap 构建的个人 CV 制作与展示前端。

## 本地开发与构建

- **安装依赖**：`pnpm install`
- **启动开发环境**：`pnpm dev`（访问 `http://localhost:3000`）
- **类型检查与构建**：`pnpm build`
- **代码规范检查**：`pnpm lint`

## 接口代理与代码生成

- 通过 `next.config.ts` 中的 rewrites 规则，将 `/api/:path*` 自动转发至本地后端 `http://127.0.0.1:8000/api/:path*`。
- 执行 `pnpm run openapi`（或 `pnpm run openapi2ts`），通过 `@umijs/openapi` 基于 `openapi2ts.config.ts` 配置自动拉取后端 OpenAPI 描述并生成客户端请求方法与类型定义。
