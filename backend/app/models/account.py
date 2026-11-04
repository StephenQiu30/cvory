"""Account, session, style preset and publication persistence."""
from sqlalchemy import Column, String, DateTime, JSON, Text, LargeBinary, Integer
from app.core.database import Base


class AccountModel(Base):
    __tablename__ = "accounts"
    id = Column(String(36), primary_key=True)
    email = Column(String(254), unique=True, nullable=False)
    password_hash = Column(String(256), nullable=False)
    display_name = Column(String(80), nullable=False)
    avatar = Column(Text, nullable=True)
    public_id = Column(String(36), unique=True, nullable=False)
    email_verified_at = Column(DateTime, nullable=True)
    status = Column(String(16), nullable=False, default="active", server_default="active")
    delete_requested_at = Column(DateTime, nullable=True)
    purge_after = Column(DateTime, nullable=True)

    @property
    def email_verified(self):
        return self.email_verified_at is not None


class SessionModel(Base):
    __tablename__ = "account_sessions"
    token_hash = Column(String(64), primary_key=True)
    owner_id = Column(String(36), index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)


class AccountActionTokenModel(Base):
    __tablename__ = "account_action_tokens"
    id = Column(String(36), primary_key=True)
    owner_id = Column(String(36), nullable=False, index=True)
    purpose = Column(String(24), nullable=False)
    target_email = Column(String(254), nullable=False)
    token_hash = Column(String(64), nullable=False, unique=True)
    created_at = Column(DateTime, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
    consumed_at = Column(DateTime, nullable=True)


class MailJobModel(Base):
    __tablename__ = "account_mail_jobs"
    id = Column(String(36), primary_key=True)
    owner_id = Column(String(36), nullable=False, index=True)
    action_token_id = Column(String(36), nullable=True)
    status = Column(String(16), nullable=False, default="queued")
    attempts = Column(Integer, nullable=False, default=0)
    encrypted_payload = Column(LargeBinary, nullable=True)
    created_at = Column(DateTime, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    next_attempt_at = Column(DateTime, nullable=True)
    lease_until = Column(DateTime, nullable=True)


class MailRateLimitModel(Base):
    __tablename__ = "account_mail_limits"
    key = Column(String(64), primary_key=True)
    count = Column(Integer, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)


class AccountDeletionJobModel(Base):
    __tablename__ = "account_deletion_jobs"
    id = Column(String(36), primary_key=True)
    owner_id = Column(String(36), nullable=False, unique=True)
    status = Column(String(16), nullable=False)
    attempts = Column(Integer, nullable=False, default=0)
    next_attempt_at = Column(DateTime, nullable=False)
    lease_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime, nullable=True)


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
