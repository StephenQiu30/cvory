# 简序 · CVory 贡献与提交规范

本文件维护仓库的代码提交、协作流程与工程贡献准则。

## 1. Git 提交信息规范 (Conventional Commits)

本项目采用规范化的提交信息格式：

```text
<type>(<scope>): <description>
```

示例：
- `feat(cv): 支持经历模块增删与显示隐藏`
- `fix(api): 修复 ETag 缺失时返回 400 INVALID_ARGUMENT 校验问题`
- `build(docker): 新增前后端 docker-compose 启动配置与环境变量模板`
- `docs(swagger): 完善后端 OpenAPI 描述与错误响应模型`
- `refactor(client): 使用 axios 与 umi-openapi 生成前端 API 客户端`

### 1.1 Type（提交类型）

| Type | 说明 |
| --- | --- |
| `feat` | 新增功能（feature） |
| `fix` | 修复问题（bug fix） |
| `docs` | 仅涉及文档变动 |
| `style` | 代码格式调整（空格、格式化等，不改变运行逻辑） |
| `refactor` | 代码重构（既不修复 bug 也不增加新功能） |
| `perf` | 性能提升与优化 |
| `test` | 增加测试用例或修正已有测试 |
| `build` | 依赖管理、构建流程或 Docker 变更（如 uv, pnpm, Dockerfile） |
| `ci` | 持续集成与流水线相关配置 |
| `chore` | 其他不修改 src 或测试代码的日常维护任务 |

### 1.2 Scope（影响范围）

建议使用的作用域范围（全部采用小写）：
- `cv`: CV 核心业务逻辑
- `api`: 后端 API 路由与接口
- `ui`: 前端界面组件与样式
- `client`: 前端 API 请求与数据客户端
- `db`: 数据库模型、连接与迁移
- `docker`: 容器化与 Compose 编排
- `docs`: 文档工作区
- `deps`: 第三方依赖包更新

### 1.3 Description（简短描述）

- 使用祈使语气、现在时态，语言以中文为主。
- 首字母小写，结尾不加句号。
- 清晰表达本次提交的核心目的与变动内容。

---

## 2. 敏感信息与配置管理

- 任何 API 密钥、数据库真实密码、私有 Token 严禁提交至 Git 仓库。
- 环境变量统一在本地 `.env`（后端或根目录）及 `frontend/.env.local` 维护，只入库 `.env.example`。
