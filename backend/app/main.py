"""Main application entrypoint for CVory backend with organized Swagger documentation."""

from contextlib import asynccontextmanager
from typing import Any, Dict
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import api_router
from app.core.config import settings
from app.core.database import Base, engine
from app.core.errors import (
    AppError,
    app_error_handler,
    http_exception_handler,
    validation_error_handler,
)
from app.schemas.common import GoogleErrorResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context for setup and teardown."""
    # Ensure database tables exist
    Base.metadata.create_all(bind=engine)
    # Ensure data directory exists
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    yield


tags_metadata = [
    {
        "name": "cvs",
        "description": "CV 个人简历核心资源管理接口（创建、列表、详情、条件局部更新、删除、头像上传等）。遵循 Google AIP-121 与 AIP-154 规范。",
    },
    {
        "name": "system",
        "description": "系统健康检查与探针接口。",
    },
]

common_responses: Dict[int | str, Dict[str, Any]] = {
    400: {
        "model": GoogleErrorResponse,
        "description": "请求参数不合法 (INVALID_ARGUMENT)，携带 fieldViolations 字段明细",
    },
    401: {
        "model": GoogleErrorResponse,
        "description": "未经授权或所有者凭证缺失 (UNAUTHENTICATED)",
    },
    403: {
        "model": GoogleErrorResponse,
        "description": "拒绝访问 (PERMISSION_DENIED)",
    },
    404: {
        "model": GoogleErrorResponse,
        "description": "请求的资源未找到 (NOT_FOUND)",
    },
    409: {
        "model": GoogleErrorResponse,
        "description": "并发版本冲突 (ABORTED)，资源已被其他修改，ETag 不匹配",
    },
}

app = FastAPI(
    title="简序 · CVory 业务服务 API",
    version="1.0.0",
    description="""
## 简序 · CVory 后端 RESTful 接口文档

遵循 **[Google API Design Guide](https://docs.cloud.google.com/apis/design)** (AIP) 规范设计：

* **资源导向**：对外接口使用标准 REST/JSON，资源名格式为 `cvs/{id}`。
* **参数与模型命名**：服务内部使用 `snake_case`，对外 JSON 使用 `lowerCamelCase`。
* **并发一致性控制**：`PATCH` 更新支持 `If-Match` 请求头或正文 `etag`，冲突返回 `409 ABORTED`。
* **统一错误模型**：全站错误响应均采用 Google AIP-193 格式，请求校验错误统一归一化为 `400 INVALID_ARGUMENT`。
* **时间表示**：统一使用 RFC 3339 UTC 格式字符串（例如 `2026-11-01T14:30:00Z`）。
    """,
    lifespan=lifespan,
    openapi_tags=tags_metadata,
    responses=common_responses,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    swagger_ui_parameters={
        "docExpansion": "list",
        "filter": True,
        "displayRequestDuration": True,
        "persistAuthorization": True,
    },
)

# Exception handlers adhering to Google AIP-193
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)

# CORS middleware for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.api_prefix)


@app.get(
    "/healthz",
    tags=["system"],
    summary="系统健康检查探针",
    description="用于容器存活与就绪探针检查服务状态。",
)
def health_check():
    """Simple healthcheck endpoint."""
    return {"status": "ok", "app": settings.app_name}


@app.middleware("http")
async def no_store_responses(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response
