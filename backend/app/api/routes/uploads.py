"""Avatar upload endpoint backed by Pillow compression and S3-compatible storage."""

from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile

from app.api.deps import get_avatar_storage, get_current_user
from app.core.security import TokenPayload
from app.infra.storage import AvatarStorageProvider
from app.schemas.api_schemas import AvatarUploadResponse

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post(
    "/avatar",
    response_model=AvatarUploadResponse,
    summary="上传简历头像（Pillow 校验压缩为 WebP 并存入 S3 兼容存储）",
)
async def upload_avatar(
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    storage: Annotated[AvatarStorageProvider, Depends(get_avatar_storage)],
    file: Annotated[UploadFile, File(description="PNG / JPEG / WebP 头像文件，最大 5MB")],
) -> AvatarUploadResponse:
    """Processes and uploads an avatar image to S3-compatible object storage."""
    raw_bytes = await file.read()
    stored = await storage.upload_avatar(user_id=current_user.user_id, raw_bytes=raw_bytes)
    return AvatarUploadResponse(
        key=stored.key,
        url=stored.url,
        content_type=stored.content_type,
        size_bytes=stored.size_bytes,
    )
