"""Resume CRUD, optimistic-lock auto-save, idempotent claim, duplicate, JSON I/O, and sharing."""

import secrets
from datetime import UTC, datetime
from typing import Annotated, cast

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.core.contract import CVORY_CONTRACT_VERSION, ResumeContent, SupportedTemplateId
from app.core.security import TokenPayload
from app.models.entities import Resume, ResumeClaim
from app.schemas.api_schemas import (
    ClaimResumeRequest,
    ClaimResumeResponse,
    CreateResumeRequest,
    DeleteResumeResponse,
    DuplicateResumeRequest,
    ResumeDetailResponse,
    ResumeJsonExportPayload,
    ResumeListResponse,
    ResumeSummaryResponse,
    SaveResumeRequest,
    ToggleShareRequest,
    ToggleShareResponse,
)

router = APIRouter(prefix="/resumes", tags=["resumes"])


def _assert_contract_version(version: int) -> None:
    if version != CVORY_CONTRACT_VERSION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "CONTRACT_UNSUPPORTED",
                "message": f"不支持的契约版本：{version}，当前仅支持版本 {CVORY_CONTRACT_VERSION}",
            },
        )


def _to_summary(resume: Resume) -> ResumeSummaryResponse:
    return ResumeSummaryResponse(
        id=resume.id,
        title=resume.title,
        template_id=cast(SupportedTemplateId, resume.template_id),
        contract_version=resume.contract_version,
        version=resume.version,
        share_enabled=resume.share_enabled,
        share_token=resume.share_token if resume.share_enabled else None,
        created_at=resume.created_at,
        updated_at=resume.updated_at,
    )


def _to_detail(resume: Resume) -> ResumeDetailResponse:
    return ResumeDetailResponse(
        id=resume.id,
        title=resume.title,
        template_id=cast(SupportedTemplateId, resume.template_id),
        contract_version=resume.contract_version,
        version=resume.version,
        share_enabled=resume.share_enabled,
        share_token=resume.share_token if resume.share_enabled else None,
        created_at=resume.created_at,
        updated_at=resume.updated_at,
        content=ResumeContent.model_validate(resume.content),
    )


async def _get_owned_active_resume(
    db: AsyncSession,
    user_id: str,
    resume_id: str,
) -> Resume:
    resume = await db.get(Resume, resume_id)
    if resume is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="简历稿件不存在")
    if resume.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该简历稿件")
    if resume.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail={
                "code": "DOC_DELETED",
                "message": "该简历稿件已被删除",
                "deleted_at": resume.deleted_at.isoformat(),
            },
        )
    return resume


@router.get("", response_model=ResumeListResponse, summary="获取当前账号下的活跃岗位简历列表")
async def list_resumes(
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> ResumeListResponse:
    """Lists active resumes for the authenticated user ordered by recent edit."""
    result = await db.execute(
        select(Resume)
        .where(Resume.user_id == current_user.user_id, Resume.deleted_at.is_(None))
        .order_by(Resume.updated_at.desc())
    )
    rows = result.scalars().all()
    return ResumeListResponse(items=[_to_summary(row) for row in rows])


@router.get("/{resume_id}", response_model=ResumeDetailResponse, summary="获取指定简历完整内容")
async def get_resume_detail(
    resume_id: str,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> ResumeDetailResponse:
    """Returns full JSONB resume content and current optimistic lock version."""
    resume = await _get_owned_active_resume(db, current_user.user_id, resume_id)
    return _to_detail(resume)


@router.post(
    "",
    response_model=ResumeDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="新建岗位简历稿件",
)
async def create_resume(
    body: CreateResumeRequest,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> ResumeDetailResponse:
    """Creates a new resume under the single active contract."""
    _assert_contract_version(body.contract_version)
    resume = Resume(
        user_id=current_user.user_id,
        title=body.title.strip(),
        template_id=body.template_id,
        contract_version=CVORY_CONTRACT_VERSION,
        version=1,
        content=body.content.model_dump(mode="json"),
    )
    db.add(resume)
    await db.commit()
    await db.refresh(resume)
    return _to_detail(resume)


@router.put(
    "/{resume_id}",
    response_model=ResumeDetailResponse,
    summary="防抖自动保存简历（带版本号乐观锁）",
)
async def save_resume(
    resume_id: str,
    body: SaveResumeRequest,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> ResumeDetailResponse:
    """Saves resume content atomically if expected_version matches current version."""
    _assert_contract_version(body.contract_version)
    resume = await _get_owned_active_resume(db, current_user.user_id, resume_id)

    if body.expected_version != resume.version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "VERSION_CONFLICT",
                "message": "该简历已在另一台设备更新，请先拉取最新版本",
                "current_version": resume.version,
                "updated_at": resume.updated_at.isoformat(),
            },
        )

    resume.title = body.title.strip()
    resume.template_id = body.template_id
    resume.content = body.content.model_dump(mode="json")
    resume.version += 1
    resume.updated_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(resume)
    return _to_detail(resume)


@router.post(
    "/claim",
    response_model=ClaimResumeResponse,
    summary="幂等认领单份游客本机草稿至当前账号",
)
async def claim_guest_draft(
    body: ClaimResumeRequest,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> ClaimResumeResponse:
    """Idempotently claims a guest local draft using (user_id, client_draft_id)."""
    _assert_contract_version(body.contract_version)
    draft_id = body.client_draft_id.strip()

    existing_claim_res = await db.execute(
        select(ResumeClaim).where(
            ResumeClaim.user_id == current_user.user_id,
            ResumeClaim.client_draft_id == draft_id,
        )
    )
    existing_claim = existing_claim_res.scalar_one_or_none()
    if existing_claim is not None:
        resume = await _get_owned_active_resume(db, current_user.user_id, existing_claim.resume_id)
        return ClaimResumeResponse(resume=_to_detail(resume), already_claimed=True)

    resume = Resume(
        user_id=current_user.user_id,
        title=body.title.strip(),
        template_id=body.template_id,
        contract_version=CVORY_CONTRACT_VERSION,
        version=1,
        content=body.content.model_dump(mode="json"),
    )
    db.add(resume)
    await db.flush()

    claim = ResumeClaim(
        user_id=current_user.user_id,
        client_draft_id=draft_id,
        resume_id=resume.id,
    )
    db.add(claim)
    await db.commit()
    await db.refresh(resume)
    return ClaimResumeResponse(resume=_to_detail(resume), already_claimed=False)


@router.post(
    "/{resume_id}/duplicate",
    response_model=ResumeDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="复制为独立岗位简历副本",
)
async def duplicate_resume(
    resume_id: str,
    body: DuplicateResumeRequest,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> ResumeDetailResponse:
    """Creates an independent copy of an existing resume with a new document ID."""
    source = await _get_owned_active_resume(db, current_user.user_id, resume_id)
    copy_title = body.title.strip() if body.title else f"{source.title}（副本）"
    duplicated = Resume(
        user_id=current_user.user_id,
        title=copy_title,
        template_id=source.template_id,
        contract_version=CVORY_CONTRACT_VERSION,
        version=1,
        content=dict(source.content),
    )
    db.add(duplicated)
    await db.commit()
    await db.refresh(duplicated)
    return _to_detail(duplicated)


@router.post(
    "/import",
    response_model=ResumeDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="导入 JSON 简历备份创建新稿件",
)
async def import_resume_json(
    body: ResumeJsonExportPayload,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> ResumeDetailResponse:
    """Imports a validated current-contract JSON backup as a new resume."""
    _assert_contract_version(body.contract_version)
    resume = Resume(
        user_id=current_user.user_id,
        title=body.title.strip(),
        template_id=body.template_id,
        contract_version=CVORY_CONTRACT_VERSION,
        version=1,
        content=body.content.model_dump(mode="json"),
    )
    db.add(resume)
    await db.commit()
    await db.refresh(resume)
    return _to_detail(resume)


@router.get(
    "/{resume_id}/export/json",
    response_model=ResumeJsonExportPayload,
    summary="导出简历结构化 JSON 备份",
)
async def export_resume_json(
    resume_id: str,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> ResumeJsonExportPayload:
    """Exports the resume in the portable single-contract JSON backup format."""
    resume = await _get_owned_active_resume(db, current_user.user_id, resume_id)
    return ResumeJsonExportPayload(
        contract_version=resume.contract_version,
        title=resume.title,
        template_id=cast(SupportedTemplateId, resume.template_id),
        content=ResumeContent.model_validate(resume.content),
    )


@router.patch(
    "/{resume_id}/share",
    response_model=ToggleShareResponse,
    summary="开启或关闭在线只读分享链接",
)
async def toggle_share(
    resume_id: str,
    body: ToggleShareRequest,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> ToggleShareResponse:
    """Enables or disables the read-only public share link for a resume."""
    resume = await _get_owned_active_resume(db, current_user.user_id, resume_id)
    resume.share_enabled = body.enabled
    if body.enabled and not resume.share_token:
        resume.share_token = secrets.token_urlsafe(18)
    await db.commit()
    await db.refresh(resume)
    return ToggleShareResponse(
        id=resume.id,
        share_enabled=resume.share_enabled,
        share_token=resume.share_token if resume.share_enabled else None,
    )


@router.delete(
    "/{resume_id}",
    response_model=DeleteResumeResponse,
    summary="软删除岗位简历（同时失效公开分享）",
)
async def delete_resume(
    resume_id: str,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> DeleteResumeResponse:
    """Soft-deletes a resume and disables its share link."""
    resume = await _get_owned_active_resume(db, current_user.user_id, resume_id)
    now = datetime.now(UTC)
    resume.deleted_at = now
    resume.share_enabled = False
    await db.commit()
    return DeleteResumeResponse(id=resume.id, deleted_at=now)
