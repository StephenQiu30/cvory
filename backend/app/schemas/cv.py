"""Pydantic schemas for CV resources and API contracts."""

from typing import Any, List, Optional, Literal
from pydantic import model_validator, field_validator
from app.schemas.content import validate_content
from pydantic import Field
from app.schemas.common import CamelModel


class ProfileSchema(CamelModel):
    """Personal contact and basic information."""

    full_name: str = Field(default="", description="姓名", examples=["张三"])
    headline: str = Field(default="", description="专业定位或一句话头衔", examples=["资深前端开发工程师"])
    email: str = Field(default="", description="联系电子邮箱", examples=["contact@example.com"])
    phone: str = Field(default="", description="联系电话", examples=["+86 138 0000 0000"])
    location: str = Field(default="", description="常驻城市", examples=["北京"])
    website: str = Field(default="", description="个人网站或 GitHub 主页", examples=["https://github.com/example"])
    github: str = ""
    wechat: str = ""
    job_status: str = ""
    expected_location: str = ""
    experience_years: str = ""
    expected_salary: str = ""
    hidden_fields: List[str] = Field(default_factory=list)
    photo_hidden: bool = False
    photo_position: Literal["left", "right"] = "right"
    photo_x: int = Field(default=50, ge=0, le=100)
    photo_y: int = Field(default=50, ge=0, le=100)
    photo_scale: float = Field(default=1, ge=1, le=3)
    avatar_url: Optional[str] = Field(default=None, description="个人头像资源访问 URL")


class SectionItemSchema(CamelModel):
    """An individual entry inside a repeatable experience section."""

    id: str = Field(..., description="子项稳定唯一标识 ID", examples=["item-exp-1"])
    title: str = Field(default="", description="主标题（公司、学校或项目名）", examples=["字节跳动"])
    subtitle: str = Field(default="", description="副标题（职位、专业或角色）", examples=["高级前端工程师"])
    date_range: str = Field(default="", description="起止时间跨度", examples=["2022.06 - 至今"])
    location: str = Field(default="", description="所在地城市或办公地点", examples=["北京"])
    description: Any = Field(default=None, description="详细职责与产出说明，支持 Tiptap JSON 格式或纯文本")
    start_date: str = Field(default="", pattern=r"^(|\d{4}-(0[1-9]|1[0-2]))$")
    end_date: str = Field(default="", pattern=r"^(|\d{4}-(0[1-9]|1[0-2]))$")
    current: bool = False
    degree: str = ""
    education_type: str = ""
    department: str = ""
    link: str = ""
    tags: List[str] = Field(default_factory=list, description="技术栈或高亮标签列表", examples=[["React", "TypeScript"]])


    _content_validation = field_validator("description")(validate_content)

    @model_validator(mode="after")
    def validate_dates(self):
        if not self.current and self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("End month must not precede start month.")
        return self


class SectionSchema(CamelModel):
    """A CV section (e.g. summary, education, experience, skills, custom)."""

    id: str = Field(..., description="模块稳定唯一标识 ID", examples=["sec-experience"])
    type: Literal["summary", "experience", "education", "project", "skill", "custom"] = Field(..., description="模块类型：summary, experience, education, project, skill, custom", examples=["experience"])
    title: str = Field(..., description="模块对外展示标题", examples=["工作经历"])
    visible: bool = Field(default=True, description="模块是否可见（隐藏不会删除数据）")
    content: Any = Field(default=None, description="直接富文本正文（常用于 summary 简介模块）")
    items: List[SectionItemSchema] = Field(default_factory=list, description="模块内的重复子项列表")

    _content_validation = field_validator("content")(validate_content)


class StyleSettingsSchema(CamelModel):
    """Typography and layout style parameters."""

    accent: Literal["ink", "blue", "graphite"] = "ink"
    template_id: Literal["standard", "compact", "timeline"] = Field(default="standard", description="排版模板标识：standard（标准）或 compact（紧凑）", examples=["standard"])
    font_size: int = Field(default=15, description="正文字号基线大小（像素 px）", ge=12, le=20, examples=[15])
    line_height: float = Field(default=1.5, description="正文排版行高比例", ge=1.2, le=2.0, examples=[1.5])
    margin: int = Field(default=24, description="页面外边距尺寸（像素 px）", ge=12, le=48, examples=[24])


class CVResource(CamelModel):
    """Complete CV resource schema conforming to Google AIP-121."""

    name: str = Field(..., description="资源稳定唯一资源名称，格式：cvs/{id}", examples=["cvs/29059b42-f1bb-481e-8b8c-9aec4d288035"])
    id: str = Field(..., description="简历唯一标识 UUID", examples=["29059b42-f1bb-481e-8b8c-9aec4d288035"])
    display_name: str = Field(..., description="用户设定的简历名称", examples=["我的前端开发简历"])
    etag: str = Field(..., description="当前版本的内容特征哈希 ETag，用于并发安全修改校验", examples=["2188972beb9238fc"])
    profile: ProfileSchema = Field(..., description="个人基本信息与联系方式")
    sections: List[SectionSchema] = Field(..., description="有序的简历内容模块列表")
    style_settings: StyleSettingsSchema = Field(..., description="纸张排版与文字样式预设")
    create_time: str = Field(..., description="创建时间（RFC 3339 UTC 格式）", examples=["2026-11-01T14:30:00Z"])
    update_time: str = Field(..., description="最近一次更新时间（RFC 3339 UTC 格式）", examples=["2026-11-01T14:32:00Z"])


class CreateCVRequest(CamelModel):
    """Request payload for creating a new CV."""

    request_id: Optional[str] = Field(default=None, max_length=64)
    display_name: str = Field(..., min_length=1, max_length=255, description="新简历的显示名称", examples=["我的个人简历"])
    profile: Optional[ProfileSchema] = Field(None, description="初始个人基本信息（可选，默认提供空白框架）")
    sections: Optional[List[SectionSchema]] = Field(None, description="初始模块列表（可选，默认提供常用起步模块）")
    style_settings: Optional[StyleSettingsSchema] = Field(None, description="排版样式参数（可选，默认标准排版）")

    @field_validator("display_name")
    @classmethod
    def validate_name(cls, value):
        if not value.strip():
            raise ValueError("Display name is required.")
        return value.strip()


class UpdateCVRequest(CamelModel):
    """Request payload for updating an existing CV."""

    display_name: Optional[str] = Field(None, min_length=1, max_length=255, description="更新后的简历名称")
    profile: Optional[ProfileSchema] = Field(None, description="更新后的个人信息")
    sections: Optional[List[SectionSchema]] = Field(None, description="更新后的完整模块列表（支持调整排序与可见性）")
    style_settings: Optional[StyleSettingsSchema] = Field(None, description="更新后的排版样式参数")
    etag: Optional[str] = Field(None, description="当前持有的资源 ETag。必须与服务端一致，否则拒绝写入并返回 409 ABORTED")
    update_mask: Optional[str] = Field(None, description="字段掩码列表，逗号分隔，例如：displayName,profile,sections")

    @field_validator("display_name")
    @classmethod
    def validate_name(cls, value):
        if value is not None and not value.strip():
            raise ValueError("Display name is required.")
        return value.strip() if value is not None else None


class ListCVsResponse(CamelModel):
    """Response payload for listing CVs conforming to Google AIP-158."""

    cvs: List[CVResource] = Field(default_factory=list, description="简历资源列表")
    next_page_token: str = Field(default="", description="下一页分页游标 Token；若为空则说明已是最后一页")
    total_size: int = Field(default=0, description="当前所有者名下的简历总数量")
