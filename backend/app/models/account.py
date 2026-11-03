"""Account, session, style preset and publication persistence."""
from sqlalchemy import Column, String, DateTime, JSON, Text
from app.core.database import Base


class AccountModel(Base):
    __tablename__ = "accounts"
    id = Column(String(36), primary_key=True)
    email = Column(String(254), unique=True, nullable=False)
    password_hash = Column(String(256), nullable=False)
    display_name = Column(String(80), nullable=False)
    avatar = Column(Text, nullable=True)
    public_id = Column(String(36), unique=True, nullable=False)


class SessionModel(Base):
    __tablename__ = "account_sessions"
    token_hash = Column(String(64), primary_key=True)
    owner_id = Column(String(36), index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)


class PublicationModel(Base):
    __tablename__ = "publications"
    owner_id = Column(String(36), primary_key=True)
    source_id = Column(String(36), nullable=False)
    source_name = Column(String(255), nullable=False)
    document = Column(JSON, nullable=False)
    update_time = Column(DateTime, nullable=False)


class PublicationReviewModel(Base):
    __tablename__ = "publication_reviews"
    id = Column(String(36), primary_key=True)
    owner_id = Column(String(36), index=True, nullable=False)
    source_id = Column(String(36), nullable=False)
    source_name = Column(String(255), nullable=False)
    document = Column(JSON, nullable=False)
    expires_at = Column(DateTime, nullable=False)


class PresetModel(Base):
    __tablename__ = "style_presets"
    id = Column(String(36), primary_key=True)
    owner_id = Column(String(36), index=True, nullable=False)
    display_name = Column(String(80), nullable=False)
    settings = Column(JSON, nullable=False)
