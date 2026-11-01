"""Business logic for CV creation, updating, versioning, and avatar handling."""

import hashlib
import json
import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Tuple

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AbortedError, InvalidArgumentError, NotFoundError
from app.models.cv import CVModel
from app.schemas.common import to_rfc3339
from app.schemas.cv import (
    CVResource,
    CreateCVRequest,
    ProfileSchema,
    SectionItemSchema,
    SectionSchema,
    StyleSettingsSchema,
    UpdateCVRequest,
)


def _compute_etag(cv_id: str, display_name: str, updated_at: datetime, payload_dict: dict) -> str:
    """Compute an ETag hash from resource content and timestamp."""
    serialized = json.dumps(payload_dict, sort_keys=True, default=str)
    raw = f"{cv_id}:{display_name}:{updated_at.isoformat()}:{serialized}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:16]


def _model_to_resource(model: CVModel) -> CVResource:
    """Transform an internal SQLAlchemy CVModel to a public Google AIP-121 CVResource."""
    return CVResource(
        name=f"cvs/{model.id}",
        id=model.id,
        display_name=model.display_name,
        etag=model.etag,
        profile=ProfileSchema(**(model.profile or {})),
        sections=[SectionSchema(**sec) for sec in (model.sections or [])],
        style_settings=StyleSettingsSchema(**(model.style_settings or {})),
        create_time=to_rfc3339(model.create_time),
        update_time=to_rfc3339(model.update_time),
    )


def _default_sections() -> List[dict]:
    """Default module sections for a newly created CV."""
    return [
        {
            "id": "sec-summary",
            "type": "summary",
            "title": "个人简介",
            "visible": True,
            "content": {
                "type": "doc",
                "content": [
                    {
                        "type": "paragraph",
                        "content": [
                            {"type": "text", "text": "热爱技术的前端工程师，拥有扎实的系统设计与工程化经验。"}
                        ],
                    }
                ],
            },
            "items": [],
        },
        {
            "id": "sec-experience",
            "type": "experience",
            "title": "工作经历",
            "visible": True,
            "content": None,
            "items": [
                {
                    "id": "item-exp-1",
                    "title": "科技创新有限公司",
                    "subtitle": "高级前端开发工程师",
                    "dateRange": "2022.06 - 至今",
                    "location": "北京",
                    "description": {
                        "type": "doc",
                        "content": [
                            {
                                "type": "paragraph",
                                "content": [
                                    {"type": "text", "text": "负责核心工作流系统重构，提升页面渲染与操作响应性能 40%。"}
                                ],
                            }
                        ],
                    },
                    "tags": ["React", "Next.js", "TypeScript"],
                }
            ],
        },
        {
            "id": "sec-education",
            "type": "education",
            "title": "教育背景",
            "visible": True,
            "content": None,
            "items": [
                {
                    "id": "item-edu-1",
                    "title": "清华大学",
                    "subtitle": "计算机科学与技术 · 本科",
                    "dateRange": "2018.09 - 2022.06",
                    "location": "北京",
                    "description": None,
                    "tags": [],
                }
            ],
        },
        {
            "id": "sec-projects",
            "type": "project",
            "title": "项目经历",
            "visible": True,
            "content": None,
            "items": [
                {
                    "id": "item-proj-1",
                    "title": "高性能富文本协同平台",
                    "subtitle": "核心开发者",
                    "dateRange": "2023.03 - 2023.12",
                    "location": "",
                    "description": {
                        "type": "doc",
                        "content": [
                            {
                                "type": "paragraph",
                                "content": [
                                    {"type": "text", "text": "基于 Tiptap 与 CRDT 实现多端低延迟状态同步与版本冲突回滚机制。"}
                                ],
                            }
                        ],
                    },
                    "tags": ["Tiptap", "WebSockets"],
                }
            ],
        },
        {
            "id": "sec-skills",
            "type": "skill",
            "title": "专业技能",
            "visible": True,
            "content": None,
            "items": [
                {
                    "id": "item-skill-1",
                    "title": "前端开发",
                    "subtitle": "精通 TypeScript, React, Next.js, Tailwind CSS, Tiptap",
                    "dateRange": "",
                    "location": "",
                    "description": None,
                    "tags": ["React", "TypeScript", "Next.js"],
                }
            ],
        },
    ]


class CVService:
    """Service providing CV CRUD and business operations."""

    @staticmethod
    def list_cvs(
        db: Session,
        page_size: int = 50,
        page_token: Optional[str] = None,
    ) -> Tuple[List[CVResource], str, int]:
        """List CVs with simple pagination."""
        query = db.query(CVModel).order_by(CVModel.update_time.desc())
        total_size = query.count()

        offset = 0
        if page_token:
            try:
                offset = int(page_token)
            except ValueError:
                offset = 0

        models = query.offset(offset).limit(page_size).all()
        next_offset = offset + len(models)
        next_page_token = str(next_offset) if next_offset < total_size else ""

        resources = [_model_to_resource(m) for m in models]
        return resources, next_page_token, total_size

    @staticmethod
    def get_cv(db: Session, cv_id: str) -> CVResource:
        """Fetch a single CV by ID or raise NotFoundError."""
        model = db.query(CVModel).filter(CVModel.id == cv_id).first()
        if not model:
            raise NotFoundError(f"CV with ID '{cv_id}' was not found.")
        return _model_to_resource(model)

    @staticmethod
    def create_cv(db: Session, req: CreateCVRequest) -> CVResource:
        """Create a new independent CV."""
        cv_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        profile_data = req.profile.model_dump(by_alias=False) if req.profile else {
            "full_name": "我的姓名",
            "headline": "专业工程师",
            "email": "contact@example.com",
            "phone": "+86 138 0000 0000",
            "location": "北京",
            "website": "https://github.com",
            "avatar_url": None,
        }

        sections_data = (
            [sec.model_dump(by_alias=False) for sec in req.sections]
            if req.sections is not None
            else _default_sections()
        )

        style_data = (
            req.style_settings.model_dump(by_alias=False)
            if req.style_settings
            else {
                "template_id": "standard",
                "font_size": 15,
                "line_height": 1.5,
                "margin": 24,
            }
        )

        initial_etag = _compute_etag(cv_id, req.display_name, now, {
            "profile": profile_data,
            "sections": sections_data,
            "style_settings": style_data,
        })

        model = CVModel(
            id=cv_id,
            display_name=req.display_name,
            etag=initial_etag,
            profile=profile_data,
            sections=sections_data,
            style_settings=style_data,
            create_time=now,
            update_time=now,
        )

        db.add(model)
        db.commit()
        db.refresh(model)
        return _model_to_resource(model)

    @staticmethod
    def update_cv(
        db: Session,
        cv_id: str,
        req: UpdateCVRequest,
        if_match: Optional[str] = None,
    ) -> CVResource:
        """Update a CV conditionally with ETag / updateMask validation."""
        model = db.query(CVModel).filter(CVModel.id == cv_id).first()
        if not model:
            raise NotFoundError(f"CV with ID '{cv_id}' was not found.")

        # Concurrency verification according to Google AIP-154 & PROJECT §3.3
        provided_etag = req.etag or (if_match.strip('"') if if_match else None)
        if not provided_etag:
            raise InvalidArgumentError("ETag is required for conditional update to prevent data loss.")

        if provided_etag != model.etag:
            raise AbortedError(
                "Resource state conflict. The CV has been modified elsewhere (ETag mismatch)."
            )

        # Apply updates
        now = datetime.now(timezone.utc)
        mask = [m.strip() for m in req.update_mask.split(",")] if req.update_mask else None

        def should_update(field_name: str) -> bool:
            return mask is None or field_name in mask

        if req.display_name is not None and should_update("displayName"):
            model.display_name = req.display_name

        if req.profile is not None and should_update("profile"):
            model.profile = req.profile.model_dump(by_alias=False)

        if req.sections is not None and should_update("sections"):
            model.sections = [sec.model_dump(by_alias=False) for sec in req.sections]

        if req.style_settings is not None and should_update("styleSettings"):
            model.style_settings = req.style_settings.model_dump(by_alias=False)

        model.update_time = now
        model.etag = _compute_etag(model.id, model.display_name, now, {
            "profile": model.profile,
            "sections": model.sections,
            "style_settings": model.style_settings,
        })

        db.commit()
        db.refresh(model)
        return _model_to_resource(model)

    @staticmethod
    def delete_cv(db: Session, cv_id: str, if_match: Optional[str] = None) -> None:
        """Delete an existing CV."""
        model = db.query(CVModel).filter(CVModel.id == cv_id).first()
        if not model:
            raise NotFoundError(f"CV with ID '{cv_id}' was not found.")

        if if_match:
            clean_if_match = if_match.strip('"')
            if clean_if_match != model.etag:
                raise AbortedError("Resource state conflict while deleting CV (ETag mismatch).")

        # Clean avatar if exists
        avatar_dir = settings.data_dir / "avatars"
        if avatar_dir.exists():
            for f in avatar_dir.glob(f"{cv_id}.*"):
                try:
                    f.unlink()
                except OSError:
                    pass

        db.delete(model)
        db.commit()

    @staticmethod
    def save_avatar(db: Session, cv_id: str, file: UploadFile) -> CVResource:
        """Save avatar file and update profile.avatar_url."""
        model = db.query(CVModel).filter(CVModel.id == cv_id).first()
        if not model:
            raise NotFoundError(f"CV with ID '{cv_id}' was not found.")

        ext = Path(file.filename or "").suffix.lower()
        if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
            ext = ".png"

        avatar_dir = settings.data_dir / "avatars"
        avatar_dir.mkdir(parents=True, exist_ok=True)

        target_file = avatar_dir / f"{cv_id}{ext}"
        with target_file.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Update profile avatarUrl
        profile = dict(model.profile or {})
        profile["avatar_url"] = f"{settings.api_v1_str}/cvs/{cv_id}/avatar"
        model.profile = profile

        now = datetime.now(timezone.utc)
        model.update_time = now
        model.etag = _compute_etag(model.id, model.display_name, now, {
            "profile": model.profile,
            "sections": model.sections,
            "style_settings": model.style_settings,
        })

        db.commit()
        db.refresh(model)
        return _model_to_resource(model)

    @staticmethod
    def get_avatar_path(cv_id: str) -> Optional[Path]:
        """Find the saved avatar file path for a CV ID."""
        avatar_dir = settings.data_dir / "avatars"
        if not avatar_dir.exists():
            return None
        for p in avatar_dir.glob(f"{cv_id}.*"):
            if p.is_file():
                return p
        return None
