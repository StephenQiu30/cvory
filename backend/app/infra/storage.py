"""S3-compatible avatar storage with Pillow validation, EXIF stripping, and WebP compression."""

import asyncio
import io
import uuid
from dataclasses import dataclass
from typing import Protocol

import boto3
from fastapi import HTTPException, status
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import Settings

MAX_AVATAR_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MiB
MAX_AVATAR_DIMENSION = 512
ALLOWED_IMAGE_FORMATS = frozenset({"JPEG", "PNG", "WEBP"})


@dataclass(frozen=True)
class StoredAvatar:
    """Metadata returned after uploading a processed avatar."""

    key: str
    url: str
    content_type: str
    size_bytes: int


class AvatarStorageProvider(Protocol):
    """Protocol for uploading processed user avatars."""

    async def upload_avatar(self, *, user_id: str, raw_bytes: bytes) -> StoredAvatar: ...


def process_avatar_image(raw_bytes: bytes) -> bytes:
    """Validates, auto-orients, strips EXIF, resizes, and encodes avatar image as WebP."""
    if not raw_bytes or len(raw_bytes) > MAX_AVATAR_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="头像文件为空或超过 5MB 大小限制",
        )

    try:
        with Image.open(io.BytesIO(raw_bytes)) as img:
            if img.format not in ALLOWED_IMAGE_FORMATS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="仅支持 PNG、JPEG 或 WebP 格式图片",
                )
            normalized = ImageOps.exif_transpose(img).convert("RGB")
            normalized.thumbnail((MAX_AVATAR_DIMENSION, MAX_AVATAR_DIMENSION))
            output = io.BytesIO()
            normalized.save(output, format="WEBP", quality=85, method=6)
            return output.getvalue()
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无法解析上传的图片文件",
        ) from exc


class S3AvatarStorage:
    """Uploads processed WebP avatars to any S3-compatible bucket (OSS / MinIO / R2)."""

    def __init__(self, settings: Settings) -> None:
        self._bucket = settings.s3_bucket
        self._public_base_url = settings.s3_public_base_url.rstrip("/")
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url or None,
            region_name=settings.s3_region,
            aws_access_key_id=settings.s3_access_key_id or None,
            aws_secret_access_key=settings.s3_secret_access_key or None,
        )

    async def upload_avatar(self, *, user_id: str, raw_bytes: bytes) -> StoredAvatar:
        """Processes the avatar image and uploads it to S3."""
        webp_bytes = await asyncio.to_thread(process_avatar_image, raw_bytes)
        object_key = f"avatars/{user_id}/{uuid.uuid4().hex}.webp"

        await asyncio.to_thread(
            self._client.put_object,
            Bucket=self._bucket,
            Key=object_key,
            Body=webp_bytes,
            ContentType="image/webp",
            CacheControl="public, max-age=31536000, immutable",
        )

        return StoredAvatar(
            key=object_key,
            url=f"{self._public_base_url}/{object_key}",
            content_type="image/webp",
            size_bytes=len(webp_bytes),
        )
