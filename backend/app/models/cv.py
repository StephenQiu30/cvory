"""SQLAlchemy models for CV resources."""

from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, JSON
from app.core.database import Base


class CVModel(Base):
    """Database representation of a CV resource."""

    __tablename__ = "cvs"

    id = Column(String(36), primary_key=True, index=True)
    display_name = Column(String(255), nullable=False)
    etag = Column(String(64), nullable=False)
    
    # Structured JSON content
    profile = Column(JSON, nullable=False, default=dict)
    sections = Column(JSON, nullable=False, default=list)
    style_settings = Column(JSON, nullable=False, default=dict)

    create_time = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    update_time = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
