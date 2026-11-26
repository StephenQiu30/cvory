"""Async SMTP mail provider configured for NetEase 163 Mail."""

import logging
from email.message import EmailMessage
from typing import Protocol

import aiosmtplib

from app.core.config import Settings
from app.core.security import redact_email

logger = logging.getLogger(__name__)


class MailProvider(Protocol):
    """Abstract mail dispatcher protocol."""

    async def send_otp_code(self, *, to_email: str, code: str, expires_in_minutes: int) -> None: ...


class SmtpMailService:
    """Sends OTP emails via standard SMTP (default: NetEase 163 smtp.163.com:465 SSL)."""

    def __init__(self, settings: Settings) -> None:
        self._host = settings.smtp_host
        self._port = settings.smtp_port
        self._use_tls = settings.smtp_secure
        self._user = settings.smtp_user
        self._password = settings.smtp_pass
        self._from_addr = settings.smtp_from

    async def send_otp_code(
        self,
        *,
        to_email: str,
        code: str,
        expires_in_minutes: int,
    ) -> None:
        """Dispatches a 6-digit login verification code without logging PII."""
        message = EmailMessage()
        message["From"] = self._from_addr
        message["To"] = to_email
        message["Subject"] = "简序 · 邮箱登录验证码"
        message.set_content(
            f"您的简序登录验证码为 {code}，{expires_in_minutes} 分钟内有效，请勿泄露给他人。"
        )

        await aiosmtplib.send(
            message,
            hostname=self._host,
            port=self._port,
            use_tls=self._use_tls,
            username=self._user or None,
            password=self._password or None,
            timeout=15.0,
        )
        logger.info("OTP email dispatched to %s", redact_email(to_email))
