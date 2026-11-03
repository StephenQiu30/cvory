"""Business logic for CV creation, updating, versioning, and avatar handling."""

import base64
import logging
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
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.services.image_service import normalize_image
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
    profile = dict(model.profile or {})
    url = profile.get("avatar_url")
    if url and url.startswith(f"{settings.api_prefix}/cvs/{model.id}/avatar"):
        path = CVService.get_avatar_path(model.id)
        if path and path.stat().st_size <= 2_097_152:
            suffix = "jpeg" if path.suffix.lower() in {".jpg", ".jpeg"} else path.suffix.lstrip(".")
            profile["avatar_url"] = normalize_image(f"data:image/{suffix};base64," + base64.b64encode(path.read_bytes()).decode())
    return CVResource(
        name=f"cvs/{model.id}",
        id=model.id,
        display_name=model.display_name,
        etag=model.etag,
        profile=ProfileSchema(**profile),
        sections=[SectionSchema(**sec) for sec in (model.sections or [])],
        style_settings=StyleSettingsSchema(**(model.style_settings or {})),
        create_time=to_rfc3339(model.create_time),
        update_time=to_rfc3339(model.update_time),
    )


def _default_sections() -> List[dict]:
    """Default module sections for a newly created CV."""
    return [dict(id=f"sec-{kind}", type=kind, title=title, visible=True, content=None, items=[])
            for kind, title in [("summary", "个人简介"), ("experience", "工作经历"),
                                ("project", "项目经历"), ("education", "教育经历"), ("skill", "专业技能")]]


class CVService:
    """Service providing CV CRUD and business operations."""

    @staticmethod
    def list_cvs(
        db: Session,
        page_size: int = 50,
        page_token: Optional[str] = None,
        owner_id: str = "legacy",
    ) -> Tuple[List[CVResource], str, int]:
        """List CVs with simple pagination."""
        query = db.query(CVModel).filter(CVModel.owner_id == owner_id).order_by(CVModel.update_time.desc())
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
    def get_cv(db: Session, cv_id: str, owner_id: str = "legacy") -> CVResource:
        """Fetch a single CV by ID or raise NotFoundError."""
        model = db.query(CVModel).filter(CVModel.id == cv_id, CVModel.owner_id == owner_id).first()
        if not model:
            raise NotFoundError(f"CV with ID '{cv_id}' was not found.")
        return _model_to_resource(model)

    @staticmethod
    def create_cv(db: Session, req: CreateCVRequest, owner_id: str = "legacy") -> CVResource:
        """Create a new independent CV."""
        cv_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{owner_id}:{req.request_id}")) if req.request_id else str(uuid.uuid4())
        existing = db.query(CVModel).filter_by(id=cv_id, owner_id=owner_id).first()
        if existing:
            return _model_to_resource(existing)
        now = datetime.now(timezone.utc)

        profile_data = (req.profile or ProfileSchema()).model_dump(by_alias=False)

        if profile_data.get("avatar_url", "") and profile_data["avatar_url"].startswith("data:"):
            profile_data["avatar_url"] = normalize_image(profile_data["avatar_url"])
        elif profile_data.get("avatar_url"):
            raise InvalidArgumentError("Backups must contain embedded photo data.")

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
            owner_id=owner_id,
            display_name=req.display_name,
            etag=initial_etag,
            profile=profile_data,
            sections=sections_data,
            style_settings=style_data,
            create_time=now,
            update_time=now,
        )

        db.add(model)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            if not req.request_id:
                raise
            return CVService.get_cv(db, cv_id, owner_id)
        db.refresh(model)
        return _model_to_resource(model)

    @staticmethod
    def update_cv(
        db: Session,
        cv_id: str,
        req: UpdateCVRequest,
        if_match: Optional[str] = None,
        owner_id: str = "legacy",
    ) -> CVResource:
        """Update a CV conditionally with ETag / updateMask validation."""
        model = db.query(CVModel).filter(CVModel.id == cv_id, CVModel.owner_id == owner_id).first()
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

        allowed = {"displayName": "display_name", "profile": "profile", "sections": "sections", "styleSettings": "style_settings"}
        mask = [m.strip() for m in req.update_mask.split(",")] if req.update_mask else list(allowed)
        if any(m not in allowed for m in mask):
            raise InvalidArgumentError("Unsupported update mask.")
        values = {}
        for external, internal in allowed.items():
            value = getattr(req, internal)
            if external in mask and value is not None:
                values[internal] = [v.model_dump() for v in value] if isinstance(value, list) else value.model_dump() if hasattr(value, "model_dump") else value
        if "profile" in values:
            url = values["profile"].get("avatar_url")
            if url and url.startswith("data:"):
                values["profile"]["avatar_url"] = normalize_image(url)
            elif url and not url.startswith(f"{settings.api_prefix}/cvs/{cv_id}/avatar"):
                raise InvalidArgumentError("Only uploaded resume photos are allowed.")
        values["update_time"] = datetime.now(timezone.utc)
        values["etag"] = uuid.uuid4().hex[:16]
        changed = db.query(CVModel).filter(CVModel.id == cv_id, CVModel.owner_id == owner_id, CVModel.etag == provided_etag).update(values, synchronize_session=False)
        if changed != 1:
            db.rollback()
            raise AbortedError()
        db.commit()
        db.expire_all()
        return CVService.get_cv(db, cv_id, owner_id)

    @staticmethod
    def delete_cv(db: Session, cv_id: str, if_match: Optional[str] = None, owner_id: str = "legacy") -> None:
        """Delete an existing CV."""
        model = db.query(CVModel).filter(CVModel.id == cv_id, CVModel.owner_id == owner_id).first()
        if not model:
            raise NotFoundError(f"CV with ID '{cv_id}' was not found.")

        if not if_match:
            raise InvalidArgumentError("ETag is required for deletion.")
        if model.etag != if_match.strip('"'):
            raise AbortedError()
        changed = db.query(CVModel).filter_by(id=cv_id, owner_id=owner_id, etag=if_match.strip('"')).delete(synchronize_session=False)
        if changed != 1:
            db.rollback()
            raise AbortedError()

        db.commit()
        # Clean legacy files only after the conditional database delete succeeds.
        avatar_dir = settings.data_dir / "avatars"
        if avatar_dir.exists():
            for f in avatar_dir.glob(f"{cv_id}.*"):
                try:
                    f.unlink()
                except OSError:
                    logging.getLogger(__name__).warning("Unable to remove a legacy photo after CV deletion.")

    @staticmethod
    def save_avatar(db: Session, cv_id: str, file: UploadFile, owner_id: str = "legacy") -> CVResource:
        """Save avatar file and update profile.avatar_url."""
        model = db.query(CVModel).filter(CVModel.id == cv_id, CVModel.owner_id == owner_id).first()
        if not model:
            raise NotFoundError(f"CV with ID '{cv_id}' was not found.")

        import base64
        raw = file.file.read(2_097_153)
        if len(raw) > 2_097_152:
            raise InvalidArgumentError("Photo exceeds 2 MB.")
        mime = file.content_type or "image/png"
        image = normalize_image(f"data:{mime};base64," + base64.b64encode(raw).decode())

        # Update profile avatarUrl
        profile = dict(model.profile or {})
        profile["avatar_url"] = image
        return CVService.update_cv(
            db, cv_id, UpdateCVRequest(profile=ProfileSchema(**profile), etag=model.etag, update_mask="profile"), owner_id=owner_id
        )

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
