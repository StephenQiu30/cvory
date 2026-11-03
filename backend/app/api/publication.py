"""Filter saved documents before they cross the anonymous boundary."""
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.errors import AbortedError, InvalidArgumentError, NotFoundError
from app.core.security import get_current_owner
from app.models.account import AccountModel, PublicationModel, PublicationReviewModel
from app.schemas.account import ResumeDocument, PublicSelection, PublicationReview, PublishRequest, PublicationStatus
from app.schemas.cv import ProfileSchema
from app.schemas.content import has_text
from app.schemas.common import to_rfc3339
from app.services.cv_service import CVService

router = APIRouter(tags=["publication"])
FIELD_NAMES = {"email", "phone", "location", "website", "github", "wechat", "jobStatus", "expectedLocation", "experienceYears", "expectedSalary"}


def projection(cv, selection):
    raw = cv.profile.model_dump(by_alias=True)
    allowed = set(selection.fields) - set(cv.profile.hidden_fields)
    profile = {"fullName": raw["fullName"], "headline": raw["headline"]}
    for key in FIELD_NAMES & allowed:
        profile[key] = raw.get(key, "")
    if "avatarUrl" in allowed and not cv.profile.photo_hidden and cv.profile.avatar_url and cv.profile.avatar_url.startswith("data:image/"):
        for key in ("avatarUrl", "photoPosition", "photoX", "photoY", "photoScale"):
            profile[key] = raw[key]
    sections = []
    for section in cv.sections:
        if section.id not in selection.section_ids or not section.visible:
            continue
        section = section.model_copy(deep=True)
        section.items = [item for item in section.items if item.title.strip() or item.subtitle.strip() or has_text(item.description)]
        if section.items or has_text(section.content):
            sections.append(section)
    return ResumeDocument(profile=ProfileSchema(**profile), sections=sections, style_settings=cv.style_settings)


@router.get("/publication", response_model=PublicationStatus, operation_id="getPublication")
def status(db: Session = Depends(get_db), owner: str = Depends(get_current_owner)):
    publication = db.get(PublicationModel, owner)
    account = db.get(AccountModel, owner)
    return PublicationStatus(published=publication is not None, public_id=account.public_id, source_name=publication.source_name if publication else "", update_time=to_rfc3339(publication.update_time) if publication else "")


@router.post("/publication:preview", response_model=PublicationReview, operation_id="previewPublication")
def preview(payload: PublicSelection, db: Session = Depends(get_db), owner: str = Depends(get_current_owner)):
    cv = CVService.get_cv(db, payload.source_id, owner)
    if cv.etag != payload.etag:
        raise AbortedError()
    if not cv.profile.full_name.strip():
        raise InvalidArgumentError("Resume name is required for publication.")
    document = projection(cv, payload)
    review = PublicationReviewModel(id=str(uuid.uuid4()), owner_id=owner, source_id=cv.id, source_name=cv.display_name, document=document.model_dump(by_alias=True), expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=30))
    db.query(PublicationReviewModel).filter(PublicationReviewModel.owner_id == owner, PublicationReviewModel.expires_at < datetime.now(timezone.utc).replace(tzinfo=None)).delete()
    db.add(review)
    db.commit()
    return PublicationReview(id=review.id, source_name=review.source_name, document=document)


@router.post("/publication:publish", response_model=PublicationStatus, operation_id="publishPublication")
def publish(payload: PublishRequest, db: Session = Depends(get_db), owner: str = Depends(get_current_owner)):
    review = db.query(PublicationReviewModel).filter_by(id=payload.review_id, owner_id=owner).first()
    if not review or review.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
        raise NotFoundError("Review expired. Refresh preview.")
    CVService.get_cv(db, review.source_id, owner)
    publication = db.get(PublicationModel, owner)
    if not publication:
        publication = PublicationModel(owner_id=owner)
        db.add(publication)
    publication.source_id = review.source_id
    publication.source_name = review.source_name
    publication.document = review.document
    publication.update_time = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    return status(db, owner)


@router.delete("/publication", status_code=204, operation_id="withdrawPublication")
def withdraw(db: Session = Depends(get_db), owner: str = Depends(get_current_owner)):
    db.query(PublicationModel).filter_by(owner_id=owner).delete()
    db.commit()


@router.get("/public/{public_id}", response_model=ResumeDocument, operation_id="getPublicResume")
def public_resume(public_id: str, db: Session = Depends(get_db)):
    account = db.query(AccountModel).filter_by(public_id=public_id).first()
    result = db.get(PublicationModel, account.id) if account else None
    if not result:
        raise NotFoundError()
    return ResumeDocument(**result.document)
