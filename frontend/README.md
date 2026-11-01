# CVory 前端工程

基于 Next.js 16 + React 19 + Tailwind CSS v4 + Tiptap 构建的个人 CV 制作与展示前端。

## 本地开发与构建

- **安装依赖**：`pnpm install`
- **启动开发环境**：`pnpm dev`（访问 `http://localhost:3000`）
- **类型检查与构建**：`pnpm build`
- **代码规范检查**：`pnpm lint`

## 接口代理

通过 `next.config.ts` 中的 rewrites 规则，将 `/api/v1/:path*` 自动转发至本地后端 `http://127.0.0.1:8000/api/v1/:path*`。
