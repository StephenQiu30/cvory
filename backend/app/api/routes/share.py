"""Public read-only shared resume route."""

from typing import Annotated, cast

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.core.contract import ResumeContent, SupportedTemplateId
from app.models.entities import Resume
from app.schemas.api_schemas import PublicSharedResumeResponse

router = APIRouter(prefix="/share", tags=["share"])


@router.get(
    "/{share_token}",
    response_model=PublicSharedResumeResponse,
    summary="通过只读分享 Token 获取公开简历",
)
async def get_shared_resume(
    share_token: str,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> PublicSharedResumeResponse:
    """Returns a read-only shared resume when sharing is enabled and not deleted."""
    result = await db.execute(
        select(Resume).where(
            Resume.share_token == share_token,
            Resume.share_enabled.is_(True),
            Resume.deleted_at.is_(None),
        )
    )
    resume = result.scalar_one_or_none()
    if resume is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="分享链接不存在或已关闭",
        )
    return PublicSharedResumeResponse(
        title=resume.title,
        template_id=cast(SupportedTemplateId, resume.template_id),
        contract_version=resume.contract_version,
        content=ResumeContent.model_validate(resume.content),
        updated_at=resume.updated_at,
    )
