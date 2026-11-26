"""Pydantic v2 request and response schemas driving OpenAPI 3.1 generation."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from app.core.contract import CVORY_CONTRACT_VERSION, ResumeContent, SupportedTemplateId


class HealthResponse(BaseModel):
    status: Literal["ok"]
    contract_version: int = CVORY_CONTRACT_VERSION


class ReadinessResponse(BaseModel):
    status: Literal["ready", "degraded"]
    postgres: Literal["up", "down"]
    redis: Literal["up", "down"]


class SendOtpRequest(BaseModel):
    email: EmailStr


class SendOtpResponse(BaseModel):
    sent: bool
    expires_in_seconds: int
    retry_after_seconds: int


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")


class AuthUserResponse(BaseModel):
    id: str
    email: EmailStr


class AuthTokensResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in_seconds: int
    user: AuthUserResponse


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class LogoutResponse(BaseModel):
    logged_out: bool


class ResumeSummaryResponse(BaseModel):
    id: str
    title: str
    template_id: SupportedTemplateId
    contract_version: int
    version: int
    share_enabled: bool
    share_token: str | None = None
    created_at: datetime
    updated_at: datetime


class ResumeDetailResponse(ResumeSummaryResponse):
    content: ResumeContent


class ResumeListResponse(BaseModel):
    items: list[ResumeSummaryResponse]


class CreateResumeRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    template_id: SupportedTemplateId
    contract_version: int
    content: ResumeContent = Field(default_factory=ResumeContent)


class SaveResumeRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    template_id: SupportedTemplateId
    contract_version: int
    expected_version: int = Field(ge=1)
    content: ResumeContent


class ClaimResumeRequest(BaseModel):
    client_draft_id: str = Field(min_length=1, max_length=128)
    title: str = Field(min_length=1, max_length=120)
    template_id: SupportedTemplateId
    contract_version: int
    content: ResumeContent


class ClaimResumeResponse(BaseModel):
    resume: ResumeDetailResponse
    already_claimed: bool


class DuplicateResumeRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)


class ToggleShareRequest(BaseModel):
    enabled: bool


class ToggleShareResponse(BaseModel):
    id: str
    share_enabled: bool
    share_token: str | None = None


class PublicSharedResumeResponse(BaseModel):
    title: str
    template_id: SupportedTemplateId
    contract_version: int
    content: ResumeContent
    updated_at: datetime


class DeleteResumeResponse(BaseModel):
    id: str
    deleted_at: datetime


class ResumeJsonExportPayload(BaseModel):
    contract_version: int
    title: str = Field(min_length=1, max_length=120)
    template_id: SupportedTemplateId
    content: ResumeContent


class AvatarUploadResponse(BaseModel):
    key: str
    url: str
    content_type: str
    size_bytes: int


class ExportSnapshotPdfRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    template_id: SupportedTemplateId
    contract_version: int
    content: ResumeContent
