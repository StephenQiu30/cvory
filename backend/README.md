# CVory 后端工程

FastAPI 业务服务，遵循 Google Python Style Guide 与 Google API Design Guide (AIP)。

## 本地开发与测试

- **依赖同步**：`uv sync`
- **运行单元测试**：`uv run pytest -v`
- **启动服务**：`uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`
- **API 文档**：服务启动后访问 `http://127.0.0.1:8000/api/docs`

## 数据库与配置

- 默认连接：`mysql+pymysql://root:123456@127.0.0.1:3306/cvory?charset=utf8mb4`
- 环境变量可在 `.env` 中覆盖，参考 `.env.example`。

## 账户、迁移与 PDF

认证采用邮箱密码注册登录和 HttpOnly 会话 Cookie，不再使用开发模式免认证或 owner token。注册邮箱尚未验证，没有邮件发送或密码重置接口。

已有数据库先执行 `uv run python migrations/001_account_ownership.py`。旧 CV 保持 legacy 归属；需要接管时，注册目标账户后由管理者执行 `uv run python migrations/001_account_ownership.py --assign-legacy-to <目标邮箱>`。迁移不会自动分配给第一位注册者。

PDF 依赖 `uv run playwright install chromium`，并通过 `FRONTEND_INTERNAL_URL` 访问受控 Next.js 打印路由。打印上下文只在单个后端进程短期存在，结束即清理。容器包含 Chromium 安装步骤。

API 的 Pydantic/OpenAPI 是唯一合同。修改接口后执行：

```bash
uv run python -c 'import json; from app.main import app; open("openapi.json", "w").write(json.dumps(app.openapi(), ensure_ascii=False, indent=2))'
```

再在 `frontend/` 执行 `pnpm run openapi`，不手改生成的客户端。运行证据与边界见 [HANDOVER](../HANDOVER.md)。
