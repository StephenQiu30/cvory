"""Common schema bases and utilities."""

from datetime import datetime, timezone
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


def to_rfc3339(dt: datetime) -> str:
    """Format datetime as RFC 3339 UTC string."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


class CamelModel(BaseModel):
    """Pydantic model that automatically converts snake_case to lowerCamelCase."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class FieldViolation(CamelModel):
    """Field-level validation error detail conforming to Google AIP-193."""

    field: str = Field(..., description="发生校验错误的字段路径")
    description: str = Field(..., description="具体的错误原因说明")


class ErrorDetail(CamelModel):
    """Google AIP-193 generic error detail object."""

    type_url: str = Field(..., alias="@type", description="错误详情类型标识 URL")
    field_violations: Optional[List[FieldViolation]] = Field(None, description="字段校验详情列表")
    reason: Optional[str] = Field(None, description="标准错误原因代码")
    domain: Optional[str] = Field(None, description="发生错误的业务域")


class ErrorBody(CamelModel):
    """Google AIP-193 standard error payload."""

    code: int = Field(..., description="HTTP 状态码")
    message: str = Field(..., description="面向开发者的英文错误描述")
    status: str = Field(..., description="Google RPC 标准状态码，如 INVALID_ARGUMENT, ABORTED, NOT_FOUND")
    details: List[ErrorDetail] = Field(default_factory=list, description="错误扩展明细")


class GoogleErrorResponse(CamelModel):
    """Standard error response wrapper schema for OpenAPI documentation."""

    error: ErrorBody
