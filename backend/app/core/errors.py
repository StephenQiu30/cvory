"""Google AIP-193 error modeling and exception handlers."""

from typing import Any, Dict, List, Optional
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    """Base application exception following Google AIP-193."""

    def __init__(
        self,
        code: int,
        message: str,
        status: str,
        details: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.details = details or []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "status": self.status,
                "details": self.details,
            }
        }


class InvalidArgumentError(AppError):
    """HTTP 400 / INVALID_ARGUMENT."""

    def __init__(
        self,
        message: str = "Invalid argument provided.",
        field_violations: Optional[List[Dict[str, str]]] = None,
    ) -> None:
        details = []
        if field_violations:
            details.append({
                "@type": "type.googleapis.com/google.rpc.BadRequest",
                "fieldViolations": field_violations,
            })
        super().__init__(
            code=400,
            message=message,
            status="INVALID_ARGUMENT",
            details=details,
        )


class UnauthenticatedError(AppError):
    """HTTP 401 / UNAUTHENTICATED."""

    def __init__(self, message: str = "Authentication required.") -> None:
        super().__init__(
            code=401,
            message=message,
            status="UNAUTHENTICATED",
            details=[{
                "@type": "type.googleapis.com/google.rpc.ErrorInfo",
                "reason": "AUTH_REQUIRED",
                "domain": "cvory.api",
            }],
        )


class PermissionDeniedError(AppError):
    """HTTP 403 / PERMISSION_DENIED."""

    def __init__(self, message: str = "Permission denied.") -> None:
        super().__init__(
            code=403,
            message=message,
            status="PERMISSION_DENIED",
            details=[{
                "@type": "type.googleapis.com/google.rpc.ErrorInfo",
                "reason": "PERMISSION_DENIED",
                "domain": "cvory.api",
            }],
        )


class NotFoundError(AppError):
    """HTTP 404 / NOT_FOUND."""

    def __init__(self, message: str = "Resource not found.") -> None:
        super().__init__(
            code=404,
            message=message,
            status="NOT_FOUND",
            details=[{
                "@type": "type.googleapis.com/google.rpc.ResourceInfo",
                "description": message,
            }],
        )


class AbortedError(AppError):
    """HTTP 409 / ABORTED for concurrent modification conflicts."""

    def __init__(self, message: str = "Concurrent modification conflict. Resource was updated elsewhere.") -> None:
        super().__init__(
            code=409,
            message=message,
            status="ABORTED",
            details=[{
                "@type": "type.googleapis.com/google.rpc.ErrorInfo",
                "reason": "CONCURRENCY_CONFLICT",
                "domain": "cvory.api",
            }],
        )


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """Handle custom AppError instances."""
    return JSONResponse(status_code=exc.code, content=exc.to_dict())


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Convert FastAPI/Pydantic validation errors into Google AIP-193 format (400 INVALID_ARGUMENT)."""
    field_violations = []
    for err in exc.errors():
        loc = err.get("loc", ())
        field_name = ".".join(str(item) for item in loc if item not in ("body", "query", "path"))
        field_violations.append({
            "field": field_name or "body",
            "description": err.get("msg", "Invalid value"),
        })

    error_response = {
        "error": {
            "code": 400,
            "message": "Request validation failed.",
            "status": "INVALID_ARGUMENT",
            "details": [{
                "@type": "type.googleapis.com/google.rpc.BadRequest",
                "fieldViolations": field_violations,
            }],
        }
    }
    return JSONResponse(status_code=400, content=error_response)


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Handle generic Starlette/FastAPI HTTPExceptions in Google AIP-193 format."""
    status_map = {
        400: "INVALID_ARGUMENT",
        401: "UNAUTHENTICATED",
        403: "PERMISSION_DENIED",
        404: "NOT_FOUND",
        409: "ABORTED",
    }
    status_str = status_map.get(exc.status_code, "INTERNAL")
    error_response = {
        "error": {
            "code": exc.status_code,
            "message": exc.detail if isinstance(exc.detail, str) else "HTTP error occurred.",
            "status": status_str,
            "details": [],
        }
    }
    return JSONResponse(status_code=exc.status_code, content=error_response)
