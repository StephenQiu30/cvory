"""Unit and integration tests for CV API endpoints."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app

# In-memory SQLite for reproducible, fast unit testing
TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_database():
    """Create fresh tables for every test."""
    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)


def test_health_check(client):
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_list_cvs_empty(client):
    response = client.get("/api/cvs")
    assert response.status_code == 200
    data = response.json()
    assert "cvs" in data
    assert data["cvs"] == []
    assert data["totalSize"] == 0


def test_create_and_get_cv(client):
    create_payload = {
        "displayName": "我的前端工程师简历",
    }
    response = client.post("/api/cvs", json=create_payload)
    assert response.status_code == 201
    created = response.json()

    assert created["displayName"] == "我的前端工程师简历"
    assert created["name"].startswith("cvs/")
    assert created["id"] is not None
    assert created["etag"] is not None
    assert "createTime" in created
    assert "updateTime" in created
    assert len(created["sections"]) > 0

    cv_id = created["id"]
    get_res = client.get(f"/api/cvs/{cv_id}")
    assert get_res.status_code == 200
    fetched = get_res.json()
    assert fetched["id"] == cv_id
    assert fetched["displayName"] == "我的前端工程师简历"


def test_update_cv_with_etag_concurrency(client):
    # 1. Create CV
    res = client.post("/api/cvs", json={"displayName": "初版简历"})
    assert res.status_code == 201
    cv = res.json()
    cv_id = cv["id"]
    initial_etag = cv["etag"]

    # 2. Update without ETag -> should fail with 400 INVALID_ARGUMENT
    fail_no_etag = client.patch(
        f"/api/cvs/{cv_id}",
        json={"displayName": "尝试无 ETag 修改"},
    )
    assert fail_no_etag.status_code == 400
    err = fail_no_etag.json()
    assert err["error"]["status"] == "INVALID_ARGUMENT"

    # 3. Update with wrong ETag -> should fail with 409 ABORTED (concurrency conflict)
    fail_wrong_etag = client.patch(
        f"/api/cvs/{cv_id}",
        json={"displayName": "尝试冲突修改", "etag": "wrong-hash-123"},
    )
    assert fail_wrong_etag.status_code == 409
    err = fail_wrong_etag.json()
    assert err["error"]["status"] == "ABORTED"

    # 4. Update with correct ETag -> should succeed and yield a new ETag
    update_res = client.patch(
        f"/api/cvs/{cv_id}",
        json={
            "displayName": "更新后的简历",
            "etag": initial_etag,
            "profile": {
                "fullName": "张三",
                "headline": "资深前端专家",
                "email": "zhangsan@example.com",
                "phone": "+86 138 0000 0001",
                "location": "上海",
                "website": "https://cvory.dev",
            },
        },
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["displayName"] == "更新后的简历"
    assert updated["profile"]["fullName"] == "张三"
    assert updated["etag"] != initial_etag

    # 5. Try updating again with the OLD initial_etag -> should fail with 409 ABORTED
    stale_update = client.patch(
        f"/api/cvs/{cv_id}",
        json={"displayName": "旧标签再次修改", "etag": initial_etag},
    )
    assert stale_update.status_code == 409


def test_validation_error_shape(client):
    # Empty displayName should fail min_length=1 validation
    res = client.post("/api/cvs", json={"displayName": ""})
    assert res.status_code == 400
    err = res.json()
    assert err["error"]["status"] == "INVALID_ARGUMENT"
    assert len(err["error"]["details"]) > 0
    assert "@type" in err["error"]["details"][0]
    assert "fieldViolations" in err["error"]["details"][0]


def test_delete_cv(client):
    res = client.post("/api/cvs", json={"displayName": "待删除简历"})
    cv = res.json()
    cv_id = cv["id"]

    del_res = client.delete(f"/api/cvs/{cv_id}")
    assert del_res.status_code == 204

    # Now get should return 404
    get_res = client.get(f"/api/cvs/{cv_id}")
    assert get_res.status_code == 404
    err = get_res.json()
    assert err["error"]["status"] == "NOT_FOUND"
