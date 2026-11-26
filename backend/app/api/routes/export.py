"""Playwright-backed pixel-identical A4 PDF export routes."""

import re
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session, get_pdf_renderer
from app.api.routes.resumes import _assert_contract_version, _get_owned_active_resume
from app.core.security import TokenPayload
from app.infra.pdf_renderer import PdfRenderer
from app.schemas.api_schemas import ExportSnapshotPdfRequest

router = APIRouter(tags=["export"])

_INVALID_FILENAME_RE = re.compile(r'[\\/:*?"<>|\r\n]+')


def _sanitize_pdf_filename(title: str) -> str:
    cleaned = _INVALID_FILENAME_RE.sub("_", title).strip(" ._")
    return f"{cleaned or 'cvory-resume'}.pdf"


def _build_pdf_response(pdf_bytes: bytes, title: str) -> Response:
    filename = _sanitize_pdf_filename(title)
    encoded = quote(filename)
    disposition = f"attachment; filename=\"resume.pdf\"; filename*=UTF-8''{encoded}"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": disposition,
            "Cache-Control": "no-store",
        },
    )


@router.post(
    "/export/pdf",
    summary="导出任意前端简历快照为与预览 100% 一致的 A4 PDF（支持游客直接导出）",
    responses={200: {"content": {"application/pdf": {}}}},
)
async def export_snapshot_pdf(
    body: ExportSnapshotPdfRequest,
    renderer: Annotated[PdfRenderer, Depends(get_pdf_renderer)],
) -> Response:
    """Renders a submitted current-contract resume snapshot to A4 PDF via Playwright."""
    _assert_contract_version(body.contract_version)
    pdf_bytes = await renderer.render_resume_pdf(payload=body.model_dump(mode="json"))
    if not pdf_bytes:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="PDF 渲染返回空文件",
        )
    return _build_pdf_response(pdf_bytes, body.title)


@router.post(
    "/resumes/{resume_id}/export/pdf",
    summary="导出指定云端简历为 A4 PDF",
    responses={200: {"content": {"application/pdf": {}}}},
)
async def export_saved_resume_pdf(
    resume_id: str,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
    renderer: Annotated[PdfRenderer, Depends(get_pdf_renderer)],
) -> Response:
    """Exports an authenticated user's persisted resume to A4 PDF."""
    resume = await _get_owned_active_resume(db, current_user.user_id, resume_id)
    payload = {
        "title": resume.title,
        "template_id": resume.template_id,
        "contract_version": resume.contract_version,
        "content": resume.content,
    }
    pdf_bytes = await renderer.render_resume_pdf(payload=payload)
    return _build_pdf_response(pdf_bytes, resume.title)
