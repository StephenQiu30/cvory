"""Short-lived print contexts rendered by the shared Next.js resume component."""
import secrets
import threading
import time
from fastapi import APIRouter, Depends, Response, Query
from playwright.sync_api import sync_playwright, Error as PlaywrightError
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.core.errors import AppError, NotFoundError, AbortedError
from app.core.security import get_current_owner
from app.schemas.account import ResumeDocument
from app.services.cv_service import CVService
from app.models.account import AccountModel

router = APIRouter(tags=["files"])
_contexts: dict[str, tuple[float, ResumeDocument, str]] = {}
_lock = threading.Lock()
_slots = threading.BoundedSemaphore(2)


@router.get("/print/{ticket}", response_model=ResumeDocument, operation_id="getPrintContext")
def print_context(ticket: str, db: Session = Depends(get_db)):
    with _lock:
        context = _contexts.get(ticket)
    if not context or context[0] < time.monotonic():
        raise NotFoundError()
    account = db.get(AccountModel, context[2])
    if not account or account.status != "active":
        raise NotFoundError()
    return context[1]


@router.get("/cvs/{cv_id}/pdf", operation_id="exportCvPdf", responses={200: {"content": {"application/pdf": {}}}})
def pdf(cv_id: str, etag: str = Query(...), db: Session = Depends(get_db), owner: str = Depends(get_current_owner)):
    cv = CVService.get_cv(db, cv_id, owner)
    if cv.etag != etag:
        raise AbortedError("Resume changed before export. Save and retry.")
    snapshot = ResumeDocument(profile=cv.profile, sections=cv.sections, style_settings=cv.style_settings)
    if not _slots.acquire(blocking=False):
        raise AppError(429, "PDF renderer is busy.", "RESOURCE_EXHAUSTED")
    ticket = secrets.token_urlsafe(32)
    with _lock:
        _contexts[ticket] = (time.monotonic() + 120, snapshot, owner)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
            try:
                page = browser.new_page()
                page.goto(f"{settings.frontend_internal_url}/print/{ticket}", wait_until="networkidle", timeout=60000)
                page.wait_for_selector('[data-print-ready="true"]', timeout=30000)
                page.evaluate("async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.complete ? Promise.resolve() : i.decode())); }")
                content = page.pdf(format="A4", print_background=True, display_header_footer=False, prefer_css_page_size=True)
            finally:
                browser.close()
        db.expire_all()
        account = db.query(AccountModel).filter_by(id=owner).with_for_update().first()
        if not account or account.status != "active":
            raise NotFoundError()
        return Response(content, media_type="application/pdf", headers={"Content-Disposition": 'attachment; filename="cvory-resume.pdf"', "Cache-Control": "no-store"})
    except PlaywrightError as exc:
        raise AppError(503, "PDF renderer unavailable. Retry after checking Chromium installation.", "UNAVAILABLE") from exc
    finally:
        with _lock:
            _contexts.pop(ticket, None)
        _slots.release()
