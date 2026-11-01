"""CV resource API endpoints following Google API Design Guide (AIP-121)."""

from typing import Optional
from fastapi import APIRouter, Depends, Header, Query, UploadFile, File, Response, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import NotFoundError
from app.core.security import get_current_owner
from app.schemas.cv import (
    CVResource,
    CreateCVRequest,
    ListCVsResponse,
    UpdateCVRequest,
)
from app.services.cv_service import CVService

router = APIRouter(prefix="/cvs", tags=["cvs"])


@router.get(
    "",
    response_model=ListCVsResponse,
    summary="List CVs",
    operation_id="listCvs",
)
def list_cvs(
    page_size: int = Query(50, alias="pageSize", ge=1, le=100),
    page_token: Optional[str] = Query(None, alias="pageToken"),
    db: Session = Depends(get_db),
    _owner: str = Depends(get_current_owner),
) -> ListCVsResponse:
    """Retrieve a paginated list of CVs owned by the user."""
    resources, next_token, total = CVService.list_cvs(
        db=db,
        page_size=page_size,
        page_token=page_token,
    )
    return ListCVsResponse(
        cvs=resources,
        next_page_token=next_token,
        total_size=total,
    )


@router.post(
    "",
    response_model=CVResource,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new CV",
    operation_id="createCv",
)
def create_cv(
    req: CreateCVRequest,
    db: Session = Depends(get_db),
    _owner: str = Depends(get_current_owner),
) -> CVResource:
    """Create a new CV with initial profile and default module sections."""
    return CVService.create_cv(db=db, req=req)


@router.get(
    "/{cv_id}",
    response_model=CVResource,
    summary="Get a CV by ID",
    operation_id="getCv",
)
def get_cv(
    cv_id: str,
    db: Session = Depends(get_db),
    _owner: str = Depends(get_current_owner),
) -> CVResource:
    """Get the full content and state of a single CV."""
    return CVService.get_cv(db=db, cv_id=cv_id)


@router.patch(
    "/{cv_id}",
    response_model=CVResource,
    summary="Update a CV conditionally",
    operation_id="updateCv",
)
def update_cv(
    cv_id: str,
    req: UpdateCVRequest,
    if_match: Optional[str] = Header(None, alias="If-Match"),
    db: Session = Depends(get_db),
    _owner: str = Depends(get_current_owner),
) -> CVResource:
    """Update CV contents conditionally with concurrency checking via ETag."""
    return CVService.update_cv(
        db=db,
        cv_id=cv_id,
        req=req,
        if_match=if_match,
    )


@router.delete(
    "/{cv_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a CV",
    operation_id="deleteCv",
)
def delete_cv(
    cv_id: str,
    if_match: Optional[str] = Header(None, alias="If-Match"),
    db: Session = Depends(get_db),
    _owner: str = Depends(get_current_owner),
) -> Response:
    """Delete an existing CV resource."""
    CVService.delete_cv(db=db, cv_id=cv_id, if_match=if_match)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{cv_id}/avatar",
    response_model=CVResource,
    summary="Upload an avatar for a CV",
    operation_id="uploadCvAvatar",
)
def upload_avatar(
    cv_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _owner: str = Depends(get_current_owner),
) -> CVResource:
    """Upload and attach a personal avatar image to the CV."""
    return CVService.save_avatar(db=db, cv_id=cv_id, file=file)


@router.get(
    "/{cv_id}/avatar",
    summary="Retrieve CV avatar image",
    operation_id="getCvAvatar",
)
def get_avatar(
    cv_id: str,
) -> FileResponse:
    """Download the current avatar image for the CV."""
    path = CVService.get_avatar_path(cv_id)
    if not path:
        raise NotFoundError(f"Avatar for CV '{cv_id}' not found.")
    return FileResponse(path)
