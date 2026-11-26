"""Single active data contract for modular customizable resumes (NFR-CV-03)."""

from typing import Literal

from pydantic import BaseModel, Field

CVORY_CONTRACT_VERSION = 1

SupportedTemplateId = Literal["classic-single", "compact-single", "chinese-letter"]
AvatarAlignment = Literal["left", "right", "hidden"]
ResumeFontFamily = Literal["sans", "serif"]
ResumeSpacingPreset = Literal["compact", "standard", "relaxed"]
ResumeSectionType = Literal[
    "education",
    "work",
    "projects",
    "skills",
    "campus",
    "awards",
    "other",
    "research",
    "portfolio",
    "summary",
    "custom",
]


class CustomFieldItem(BaseModel):
    """Dynamic key-value field in the basics section."""

    id: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=40)
    value: str = Field(default="", max_length=240)
    visible: bool = True


class BasicsSection(BaseModel):
    """Candidate profile, avatar settings, job intention, and custom fields."""

    full_name: str = Field(default="", max_length=80)
    phone: str = Field(default="", max_length=40)
    email: str = Field(default="", max_length=120)
    avatar_url: str = Field(default="", max_length=512)
    avatar_alignment: AvatarAlignment = "right"
    gender: str = Field(default="", max_length=20)
    age: str = Field(default="", max_length=20)
    location: str = Field(default="", max_length=80)
    wechat: str = Field(default="", max_length=80)
    github: str = Field(default="", max_length=200)
    website: str = Field(default="", max_length=200)
    degree: str = Field(default="", max_length=40)
    work_years: str = Field(default="", max_length=40)
    expected_salary: str = Field(default="", max_length=60)
    job_status: str = Field(default="", max_length=60)
    target_role: str = Field(default="", max_length=80)
    expected_city: str = Field(default="", max_length=60)
    custom_fields: list[CustomFieldItem] = Field(default_factory=list)


class ResumeSectionItem(BaseModel):
    """A single entry within a preset or custom section."""

    id: str = Field(min_length=1, max_length=64)
    title: str = Field(default="", max_length=160)
    subtitle: str = Field(default="", max_length=160)
    start_month: str = Field(default="", max_length=16)
    end_month: str = Field(default="", max_length=16)
    is_current: bool = False
    location: str = Field(default="", max_length=80)
    link: str = Field(default="", max_length=300)
    content_html: str = Field(default="", max_length=20_000)


class ResumeSection(BaseModel):
    """Modular section supporting both preset categories and user-defined custom sections."""

    id: str = Field(min_length=1, max_length=64)
    type: ResumeSectionType
    title: str = Field(min_length=1, max_length=60)
    visible: bool = True
    items: list[ResumeSectionItem] = Field(default_factory=list)
    rich_text_html: str = Field(default="", max_length=20_000)


class StyleOverrides(BaseModel):
    """Per-resume typography overrides; unset values follow active template defaults."""

    font_family: ResumeFontFamily | None = None
    font_size_pt: Literal[9, 10, 11, 12] | None = None
    line_height: float | None = Field(default=None, ge=1.1, le=2.0)
    spacing: ResumeSpacingPreset | None = None
    accent_color: str | None = Field(default=None, max_length=32)


class ResumeContent(BaseModel):
    """Complete structured resume document stored as PostgreSQL JSONB."""

    basics: BasicsSection = Field(default_factory=BasicsSection)
    style_overrides: StyleOverrides = Field(default_factory=StyleOverrides)
    sections: list[ResumeSection] = Field(default_factory=list)
