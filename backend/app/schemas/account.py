"""Account and filtered public document contracts."""
import re
from pydantic import Field, field_validator
from app.schemas.common import CamelModel
from app.schemas.cv import ProfileSchema, SectionSchema, StyleSettingsSchema


class Credentials(CamelModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=10, max_length=128)
    display_name: str = Field(default="", max_length=80)

    @field_validator("email")
    @classmethod
    def email_format(cls, value):
        value = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Invalid email address.")
        return value


class AccountResource(CamelModel):
    id: str
    email: str
    display_name: str
    avatar: str | None = None
    public_id: str


class AccountUpdate(CamelModel):
    display_name: str = Field(min_length=1, max_length=80)
    avatar: str | None = None

    @field_validator("display_name")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Display name is required.")
        return value.strip()


class ResumeDocument(CamelModel):
    profile: ProfileSchema
    sections: list[SectionSchema]
    style_settings: StyleSettingsSchema


class PublicSelection(CamelModel):
    source_id: str
    etag: str
    fields: list[str]
    section_ids: list[str]


class PublicationReview(CamelModel):
    id: str
    source_name: str
    document: ResumeDocument


class PublishRequest(CamelModel):
    review_id: str


class PublicationStatus(CamelModel):
    published: bool
    source_name: str = ""
    update_time: str = ""
    public_id: str


class StylePreset(CamelModel):
    id: str
    display_name: str = Field(min_length=1, max_length=80)
    settings: StyleSettingsSchema
