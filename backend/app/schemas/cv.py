"""Pydantic schemas for CV resources and API contracts."""

from typing import Any, List, Optional
from pydantic import Field
from app.schemas.common import CamelModel


class ProfileSchema(CamelModel):
    """Personal contact and basic information."""

    full_name: str = ""
    headline: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    website: str = ""
    avatar_url: Optional[str] = None


class SectionItemSchema(CamelModel):
    """An individual entry inside a repeatable experience section."""

    id: str
    title: str = ""
    subtitle: str = ""
    date_range: str = ""
    location: str = ""
    description: Any = None
    tags: List[str] = Field(default_factory=list)


class SectionSchema(CamelModel):
    """A CV section (e.g. summary, education, experience, skills, custom)."""

    id: str
    type: str  # summary, experience, education, project, skill, custom
    title: str
    visible: bool = True
    content: Any = None
    items: List[SectionItemSchema] = Field(default_factory=list)


class StyleSettingsSchema(CamelModel):
    """Typography and layout style parameters."""

    template_id: str = "standard"
    font_size: int = 15
    line_height: float = 1.5
    margin: int = 24


class CVResource(CamelModel):
    """Complete CV resource schema conforming to Google AIP-121."""

    name: str  # Format: "cvs/{id}"
    id: str
    display_name: str
    etag: str
    profile: ProfileSchema
    sections: List[SectionSchema] = Field(default_factory=list)
    style_settings: StyleSettingsSchema
    create_time: str
    update_time: str


class CreateCVRequest(CamelModel):
    """Request payload for creating a new CV."""

    display_name: str = Field(..., min_length=1, max_length=255)
    profile: Optional[ProfileSchema] = None
    sections: Optional[List[SectionSchema]] = None
    style_settings: Optional[StyleSettingsSchema] = None


class UpdateCVRequest(CamelModel):
    """Request payload for updating an existing CV."""

    display_name: Optional[str] = Field(None, min_length=1, max_length=255)
    profile: Optional[ProfileSchema] = None
    sections: Optional[List[SectionSchema]] = None
    style_settings: Optional[StyleSettingsSchema] = None
    etag: Optional[str] = None
    update_mask: Optional[str] = None


class ListCVsResponse(CamelModel):
    """Response payload for listing CVs conforming to Google AIP-158."""

    cvs: List[CVResource] = Field(default_factory=list)
    next_page_token: str = ""
    total_size: int = 0
