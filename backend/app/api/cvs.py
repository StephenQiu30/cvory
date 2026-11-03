"""CV resource API endpoints following Google API Design Guide (AIP-121)."""

import base64
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
    summary="获取简历列表",
    description="以分页形式列举当前所有者名下的全部简历文档。遵循 Google AIP-158 分页标准，返回当前页项目和下一页游标 nextPageToken。",
    operation_id="listCvs",
)
def list_cvs(
    page_size: int = Query(50, alias="pageSize", ge=1, le=100, description="单页最大返回数量（1-100）"),
    page_token: Optional[str] = Query(None, alias="pageToken", description="分页标记游标，上一页返回的 nextPageToken"),
    db: Session = Depends(get_db),
    _owner: str = Depends(get_current_owner),
) -> ListCVsResponse:
    """Retrieve a paginated list of CVs owned by the user."""
    resources, next_token, total = CVService.list_cvs(
        db=db,
        page_size=page_size,
        page_token=page_token,
        owner_id=_owner,
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
    summary="新建一份个人简历",
    description="创建一个独立可编辑的简历资源。服务端会自动生成唯一 UUID、初始化基础结构，并生成初始 ETag。",
    operation_id="createCv",
)
def create_cv(
    req: CreateCVRequest,
    db: Session = Depends(get_db),
    _owner: str = Depends(get_current_owner),
) -> CVResource:
    """Create a new CV with initial profile and default module sections."""
    return CVService.create_cv(db=db, req=req, owner_id=_owner)


@router.get(
    "/{cv_id}",
    response_model=CVResource,
    summary="获取单个简历详情",
    description="根据简历 UUID 获取完整的内容、模块数据及当前版本 ETag。",
    operation_id="getCv",
)
def get_cv(
    cv_id: str,
    db: Session = Depends(get_db),
    _owner: str = Depends(get_current_owner),
) -> CVResource:
    """Get the full content and state of a single CV."""
    return CVService.get_cv(db=db, cv_id=cv_id, owner_id=_owner)


@router.patch(
    "/{cv_id}",
    response_model=CVResource,
    summary="条件局部更新简历内容",
    description="""
更新指定简历的内容。遵循 Google AIP-154 并发校验规则：
* 必须在请求头 `If-Match` 或请求体内 `etag` 携带修改前持有的版本 ETag。
* 若远端已更新导致 ETag 不一致，服务返回 `409 ABORTED`，保护用户数据不被静默覆盖。
* 支持 `updateMask` 字段掩码按需更新特定字段（如 `displayName,profile,sections`）。
""",
    operation_id="updateCv",
)
def update_cv(
    cv_id: str,
    req: UpdateCVRequest,
    if_match: Optional[str] = Header(None, alias="If-Match", description="修改前持有的 ETag 特征值（支持双引号包裹）"),
    db: Session = Depends(get_db),
    _owner: str = Depends(get_current_owner),
) -> CVResource:
    """Update CV contents conditionally with concurrency checking via ETag."""
    return CVService.update_cv(
        db=db,
        cv_id=cv_id,
        req=req,
        if_match=if_match,
        owner_id=_owner,
    )


@router.delete(
    "/{cv_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除指定简历",
    description="永久移除指定简历及其关联的私有头像资源。支持可选的 `If-Match` 请求头保证并发删除安全。",
    operation_id="deleteCv",
)
def delete_cv(
    cv_id: str,
    if_match: Optional[str] = Header(None, alias="If-Match", description="持有的 ETag 特征值"),
    db: Session = Depends(get_db),
    _owner: str = Depends(get_current_owner),
) -> Response:
    """Delete an existing CV resource."""
    CVService.delete_cv(db=db, cv_id=cv_id, if_match=if_match, owner_id=_owner)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{cv_id}/avatar",
    response_model=CVResource,
    summary="上传并绑定简历头像",
    description="为简历上传个人照片。图片将转存到服务持久目录，更新简历资料中的 `avatarUrl` 并刷新 ETag。",
    operation_id="uploadCvAvatar",
)
def upload_avatar(
    cv_id: str,
    file: UploadFile = File(..., description="头像图片文件（支持 PNG、JPEG、WEBP 格式）"),
    db: Session = Depends(get_db),
    _owner: str = Depends(get_current_owner),
) -> CVResource:
    """Upload and attach a personal avatar image to the CV."""
    return CVService.save_avatar(db=db, cv_id=cv_id, file=file, owner_id=_owner)


@router.get(
    "/{cv_id}/avatar",
    summary="读取简历头像图片",
    description="获取指定简历上传保存的头像原始图片文件。",
    operation_id="getCvAvatar",
)
def get_avatar(
    cv_id: str,
    db: Session = Depends(get_db),
    _owner: str = Depends(get_current_owner),
) -> Response:
    """Download the owned resume photo, including embedded normalized content."""
    cv = CVService.get_cv(db, cv_id, _owner)
    if cv.profile.avatar_url and cv.profile.avatar_url.startswith("data:image/"):
        header, encoded = cv.profile.avatar_url.split(",", 1)
        return Response(base64.b64decode(encoded), media_type=header[5:].split(";")[0])
    path = CVService.get_avatar_path(cv_id)
    if not path:
        raise NotFoundError(f"Avatar for CV '{cv_id}' not found.")
    return FileResponse(path)
