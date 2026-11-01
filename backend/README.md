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
