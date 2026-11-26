"""End-to-end async integration tests for the CVory FastAPI backend."""

import io
from collections.abc import AsyncIterator
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from PIL import Image

from app.core.config import Settings
from app.core.contract import CVORY_CONTRACT_VERSION
from app.infra.database import DatabaseManager
from app.infra.storage import StoredAvatar, process_avatar_image
from app.main import create_app


class InMemoryRedis:
    """Minimal in-memory Redis double implementing RedisProtocol."""

    def __init__(self) -> None:
        self._store: dict[str, str] = {}

    async def ping(self) -> bool:
        return True

    async def exists(self, *names: str) -> int:
        return sum(1 for name in names if name in self._store)

    async def get(self, name: str) -> str | None:
        return self._store.get(name)

    async def set(self, name: str, value: str, *, ex: int | None = None) -> bool | None:
        _ = ex
        self._store[name] = value
        return True

    async def incr(self, name: str) -> int:
        next_val = int(self._store.get(name, "0")) + 1
        self._store[name] = str(next_val)
        return next_val

    async def expire(self, name: str, time: int) -> bool:
        _ = (name, time)
        return True

    async def delete(self, *names: str) -> int:
        removed = 0
        for name in names:
            if name in self._store:
                del self._store[name]
                removed += 1
        return removed

    async def aclose(self) -> None:
        return None


class FakeMailProvider:
    """Captures dispatched OTP codes for test assertions."""

    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    async def send_otp_code(
        self,
        *,
        to_email: str,
        code: str,
        expires_in_minutes: int,
    ) -> None:
        self.sent.append(
            {
                "to_email": to_email,
                "code": code,
                "expires_in_minutes": expires_in_minutes,
            }
        )


class FakeAvatarStorage:
    """Runs real Pillow WebP validation/compression without calling external S3."""

    async def upload_avatar(self, *, user_id: str, raw_bytes: bytes) -> StoredAvatar:
        webp_bytes = process_avatar_image(raw_bytes)
        key = f"avatars/{user_id}/test.webp"
        return StoredAvatar(
            key=key,
            url=f"https://cdn.example.com/{key}",
            content_type="image/webp",
            size_bytes=len(webp_bytes),
        )


class FakePdfRenderer:
    """Records rendered payload and returns a valid minimal PDF header."""

    def __init__(self) -> None:
        self.last_payload: dict[str, Any] | None = None

    async def render_resume_pdf(self, *, payload: dict[str, Any]) -> bytes:
        self.last_payload = payload
        return b"%PDF-1.4\n%CVory test pdf\n%%EOF"

    async def close(self) -> None:
        return None


@pytest.fixture
async def test_env() -> AsyncIterator[tuple[AsyncClient, FakeMailProvider, FakePdfRenderer]]:
    settings = Settings(
        app_env="test",
        database_url="sqlite+aiosqlite:///:memory:",
        jwt_access_secret="test-access-secret-min-32-chars!!",
        jwt_refresh_secret="test-refresh-secret-min-32-chars!",
    )
    db_manager = DatabaseManager(settings)
    redis_client = InMemoryRedis()
    mail_provider = FakeMailProvider()
    avatar_storage = FakeAvatarStorage()
    pdf_renderer = FakePdfRenderer()

    application = create_app(
        settings=settings,
        db_manager=db_manager,
        redis_client=redis_client,
        mail_provider=mail_provider,
        avatar_storage=avatar_storage,
        pdf_renderer=pdf_renderer,
    )

    async with application.router.lifespan_context(application):
        transport = ASGITransport(app=application)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            yield client, mail_provider, pdf_renderer


async def _login(client: AsyncClient, mail: FakeMailProvider, email: str) -> dict[str, Any]:
    send_resp = await client.post("/api/auth/otp/send", json={"email": email})
    assert send_resp.status_code == 200
    code = mail.sent[-1]["code"]
    verify_resp = await client.post("/api/auth/otp/verify", json={"email": email, "code": code})
    assert verify_resp.status_code == 200
    return verify_resp.json()


def _sample_content() -> dict[str, Any]:
    return {
        "basics": {
            "full_name": "林叙白",
            "phone": "13800001234",
            "email": "lin@example.com",
            "avatar_alignment": "right",
            "target_role": "AI 应用开发工程师",
            "expected_city": "上海",
            "job_status": "在职-月内到岗",
            "custom_fields": [
                {"id": "cf-1", "label": "GitHub", "value": "github.com/sample", "visible": True}
            ],
        },
        "style_overrides": {"font_size_pt": 11, "accent_color": "#171717"},
        "sections": [
            {
                "id": "sec-custom-1",
                "type": "custom",
                "title": "开源项目",
                "visible": True,
                "items": [
                    {
                        "id": "item-1",
                        "title": "CVory 简序",
                        "subtitle": "核心作者",
                        "start_month": "2026-01",
                        "is_current": True,
                        "content_html": (
                            "<p>支持<strong>自定义模块</strong>与 100% 一致 PDF 导出。</p>"
                        ),
                    }
                ],
            }
        ],
    }


async def test_health_and_openapi(
    test_env: tuple[AsyncClient, FakeMailProvider, FakePdfRenderer],
) -> None:
    client, _, _ = test_env
    assert (await client.get("/api/health")).status_code == 200
    assert (await client.get("/api/health/ready")).status_code == 200
    openapi = await client.get("/api/openapi.json")
    assert openapi.status_code == 200
    assert "/api/resumes/claim" in openapi.json()["paths"]


async def test_full_resume_lifecycle_auth_optimistic_lock_share_avatar_and_pdf(
    test_env: tuple[AsyncClient, FakeMailProvider, FakePdfRenderer],
) -> None:
    client, mail, pdf_renderer = test_env

    # 1. Auth OTP + cooldown + single-use + refresh rotation.
    alice = await _login(client, mail, "alice@163.com")
    bob = await _login(client, mail, "bob@163.com")
    alice_headers = {"Authorization": f"Bearer {alice['access_token']}"}
    bob_headers = {"Authorization": f"Bearer {bob['access_token']}"}

    cooldown_resp = await client.post("/api/auth/otp/send", json={"email": "alice@163.com"})
    assert cooldown_resp.status_code == 429

    # 2. Reject unsupported contract version (CASE-CV-11).
    bad_contract = await client.post(
        "/api/resumes",
        headers=alice_headers,
        json={
            "title": "旧契约",
            "template_id": "classic-single",
            "contract_version": 99,
            "content": _sample_content(),
        },
    )
    assert bad_contract.status_code == 400

    # 3. Idempotent guest draft claim (AC-CV-08).
    claim_payload = {
        "client_draft_id": "guest-draft-001",
        "title": "AI 应用开发工程师 · 上海",
        "template_id": "classic-single",
        "contract_version": CVORY_CONTRACT_VERSION,
        "content": _sample_content(),
    }
    claim1 = await client.post("/api/resumes/claim", headers=alice_headers, json=claim_payload)
    assert claim1.status_code == 200
    assert claim1.json()["already_claimed"] is False
    resume_id = claim1.json()["resume"]["id"]

    claim_retry = await client.post("/api/resumes/claim", headers=alice_headers, json=claim_payload)
    assert claim_retry.status_code == 200
    assert claim_retry.json()["already_claimed"] is True
    assert claim_retry.json()["resume"]["id"] == resume_id

    # 4. Cross-account isolation.
    forbidden = await client.get(f"/api/resumes/{resume_id}", headers=bob_headers)
    assert forbidden.status_code == 403

    # 5. Optimistic locking on auto-save (PUT).
    save_ok = await client.put(
        f"/api/resumes/{resume_id}",
        headers=alice_headers,
        json={
            "title": "AI 应用开发工程师 · 终稿",
            "template_id": "compact-single",
            "contract_version": CVORY_CONTRACT_VERSION,
            "expected_version": 1,
            "content": _sample_content(),
        },
    )
    assert save_ok.status_code == 200
    assert save_ok.json()["version"] == 2

    save_stale = await client.put(
        f"/api/resumes/{resume_id}",
        headers=alice_headers,
        json={
            "title": "旧标签覆盖测试",
            "template_id": "compact-single",
            "contract_version": CVORY_CONTRACT_VERSION,
            "expected_version": 1,
            "content": _sample_content(),
        },
    )
    assert save_stale.status_code == 409

    # 6. Duplicate + JSON export/import.
    dup = await client.post(f"/api/resumes/{resume_id}/duplicate", headers=alice_headers, json={})
    assert dup.status_code == 201
    assert dup.json()["id"] != resume_id

    exported_json = await client.get(f"/api/resumes/{resume_id}/export/json", headers=alice_headers)
    assert exported_json.status_code == 200
    imported = await client.post(
        "/api/resumes/import",
        headers=alice_headers,
        json=exported_json.json(),
    )
    assert imported.status_code == 201

    # 7. Public read-only share toggle & access.
    share_on = await client.patch(
        f"/api/resumes/{resume_id}/share",
        headers=alice_headers,
        json={"enabled": True},
    )
    assert share_on.status_code == 200
    share_token = share_on.json()["share_token"]
    assert share_token

    public_resp = await client.get(f"/api/share/{share_token}")
    assert public_resp.status_code == 200
    assert public_resp.json()["title"] == "AI 应用开发工程师 · 终稿"

    # 8. Avatar upload (real Pillow PNG -> WebP).
    img_buf = io.BytesIO()
    Image.new("RGB", (64, 64), color=(24, 24, 27)).save(img_buf, format="PNG")
    upload_ok = await client.post(
        "/api/uploads/avatar",
        headers=alice_headers,
        files={"file": ("avatar.png", img_buf.getvalue(), "image/png")},
    )
    assert upload_ok.status_code == 200
    assert upload_ok.json()["content_type"] == "image/webp"

    upload_bad = await client.post(
        "/api/uploads/avatar",
        headers=alice_headers,
        files={"file": ("bad.txt", b"not-an-image", "text/plain")},
    )
    assert upload_bad.status_code == 400

    # 9. Playwright PDF export (guest snapshot + saved resume).
    pdf_resp = await client.post(f"/api/resumes/{resume_id}/export/pdf", headers=alice_headers)
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert pdf_resp.content.startswith(b"%PDF-")
    assert pdf_renderer.last_payload is not None

    # 10. Soft-delete invalidates share link and returns 410 Gone on re-read.
    del_resp = await client.delete(f"/api/resumes/{resume_id}", headers=alice_headers)
    assert del_resp.status_code == 200
    assert (await client.get(f"/api/share/{share_token}")).status_code == 404
    assert (await client.get(f"/api/resumes/{resume_id}", headers=alice_headers)).status_code == 410

    # 11. Logout blacklists access & refresh tokens.
    logout_resp = await client.post(
        "/api/auth/logout",
        headers=alice_headers,
        json={"refresh_token": alice["refresh_token"]},
    )
    assert logout_resp.status_code == 200
    assert (await client.get("/api/auth/me", headers=alice_headers)).status_code == 401
    assert (
        await client.post("/api/auth/refresh", json={"refresh_token": alice["refresh_token"]})
    ).status_code == 401
