"""Account isolation, frozen publication and resume field regression coverage."""
import base64
import io
from datetime import datetime, timedelta
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.core.database import Base, get_db
from app.models.account import AccountModel, SessionModel
from app.schemas.cv import SectionItemSchema


@pytest.fixture
def clients(tmp_path):
    engine = create_engine("sqlite://", connect_args={"check_same_thread":False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine)
    def override():
        with sessions() as db:
            yield db
    app.dependency_overrides[get_db] = override
    first, second, anonymous = TestClient(app), TestClient(app), TestClient(app)
    for i, client in enumerate([first, second]):
        assert client.post("/api/account:register", json={"email":f"user{i}@example.com", "password":"correct-long-password"}).status_code == 201
    yield first, second, anonymous, sessions
    app.dependency_overrides.clear()
    engine.dispose()


def create(client, **kwargs):
    payload = {"displayName":"PRIVATE_SOURCE_NAME", "profile":{"fullName":"Public Name", "email":"PRIVATE_EMAIL@example.com", "phone":"PRIVATE_PHONE", "location":"Shanghai", "hiddenFields":["phone"]}, "sections":[{"id":"education", "type":"education", "title":"Education", "visible":True, "items":[{"id":"one", "title":"Public University", "subtitle":"CS", "degree":"Bachelor", "startDate":"2020-09", "endDate":"2024-06", "description":"Public education body"}]},{"id":"private", "type":"experience", "title":"PRIVATE_MODULE", "visible":False, "items":[{"id":"two", "title":"PRIVATE_COMPANY"}]}], **kwargs}
    response = client.post("/api/cvs", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_auth_and_cookie_lifecycle(clients):
    first,second,anon,dbs=clients
    assert anon.get("/api/cvs").status_code==401
    assert anon.post("/api/account:login", json={"email":"user0@example.com","password":"incorrect-password"}).status_code==401
    login=anon.post("/api/account:login",json={"email":"USER0@EXAMPLE.COM","password":"correct-long-password"})
    assert login.status_code==200
    assert "httponly" in login.headers["set-cookie"].lower()
    assert "samesite=lax" in login.headers["set-cookie"].lower()
    assert anon.get("/api/account").json()["email"]=="user0@example.com"
    assert anon.post("/api/account:logout").status_code==204
    assert anon.get("/api/account").status_code==401
    with dbs() as db:
        assert "correct-long-password" not in db.query(AccountModel).first().password_hash
        assert all(len(s.token_hash)==64 for s in db.query(SessionModel).all())


def test_owner_isolation_and_origin(clients):
    first,second,anon,_=clients
    cv=create(first)
    assert second.get(f'/api/cvs/{cv["id"]}').status_code==404
    assert second.patch(f'/api/cvs/{cv["id"]}',json={"etag":cv["etag"],"displayName":"stolen"}).status_code==404
    assert second.delete(f'/api/cvs/{cv["id"]}',headers={"If-Match":cv["etag"]}).status_code==404
    assert second.get("/api/cvs").json()["cvs"]==[]
    assert first.post("/api/cvs",json={"displayName":"bad"},headers={"Origin":"https://evil.example"}).status_code==403
    assert first.post("/api/cvs",json={"displayName":"bad"},headers={"Sec-Fetch-Site":"cross-site"}).status_code==403


def test_frozen_preview_and_withdrawal(clients):
    first,second,anon,dbs=clients
    with dbs() as db:
        db.query(AccountModel).filter_by(email="user0@example.com").update({"email_verified_at": datetime.now()})
        db.commit()
    cv=create(first)
    public_id=first.get("/api/account").json()["publicId"]
    response=first.post("/api/publication:preview",json={"sourceId":cv["id"],"etag":cv["etag"],"fields":["location","phone"],"sectionIds":["education","private"]})
    assert response.status_code==200,response.text
    review=response.json()
    encoded=str(review["document"])
    for private in ["PRIVATE_EMAIL","PRIVATE_PHONE","PRIVATE_MODULE","PRIVATE_COMPANY","PRIVATE_SOURCE_NAME"]:
        assert private not in encoded
    assert anon.get(f"/api/public/{public_id}").status_code==404
    assert first.patch(f'/api/cvs/{cv["id"]}',json={"etag":cv["etag"],"profile":{"fullName":"Later Draft"}}).status_code==200
    assert second.post("/api/publication:publish",json={"reviewId":review["id"]}).status_code==404
    assert first.post("/api/publication:publish",json={"reviewId":review["id"]}).status_code==200
    assert anon.get(f"/api/public/{public_id}").json()==review["document"]
    assert first.post("/api/publication:publish",json={"reviewId":"missing"}).status_code==404
    assert anon.get(f"/api/public/{public_id}").json()==review["document"]
    assert first.delete("/api/publication").status_code==204
    assert anon.get(f"/api/public/{public_id}").status_code==404
    assert first.get(f'/api/cvs/{cv["id"]}').status_code==200


def test_avatar_independence_and_invalid_images(clients):
    first,_,anon,_=clients
    image=Image.new("RGB",(30,40),(100,120,130));output=io.BytesIO();image.save(output,"PNG")
    photo="data:image/png;base64,"+base64.b64encode(output.getvalue()).decode()
    cv=create(first,profile={"fullName":"Photographed Person","avatarUrl":photo})
    account=first.get("/api/account").json()
    assert first.patch("/api/account",json={"displayName":"Account Name","avatar":photo}).status_code==200
    assert first.get(f'/api/cvs/{cv["id"]}').json()["profile"]["avatarUrl"]==cv["profile"]["avatarUrl"]
    assert first.patch("/api/account",json={"displayName":"Account Name","avatar":None}).status_code==200
    assert first.get(f'/api/cvs/{cv["id"]}').json()["profile"]["avatarUrl"]
    assert first.patch("/api/account",json={"displayName":" ","avatar":None}).status_code==400
    assert first.patch("/api/account",json={"displayName":"Account Name","avatar":"data:image/png;base64,broken"}).status_code==400
    preview=first.post("/api/publication:preview",json={"sourceId":cv["id"],"etag":cv["etag"],"fields":[],"sectionIds":[]}).json()
    assert preview["document"]["profile"]["avatarUrl"] is None


@pytest.mark.parametrize("current,end,valid",[(False,"2024-05",False),(True,"2024-05",True),(False,"2024-09",True)])
def test_dates(current,end,valid):
    try:
        SectionItemSchema(id="item",startDate="2024-06",endDate=end,current=current)
        assert valid
    except ValueError:
        assert not valid


def test_stale_save_does_not_overwrite_and_idempotent_create(clients):
    first,_,_,_=clients
    cv=create(first,requestId="one-import")
    again=create(first,requestId="one-import")
    assert again["id"]==cv["id"]
    assert first.get("/api/cvs").json()["totalSize"]==1
    assert first.patch(f'/api/cvs/{cv["id"]}',json={"etag":cv["etag"],"displayName":"New"}).status_code==200
    assert first.patch(f'/api/cvs/{cv["id"]}',json={"etag":cv["etag"],"displayName":"Stale"}).status_code==409
    assert first.get(f'/api/cvs/{cv["id"]}').json()["displayName"]=="New"
    assert first.delete(f'/api/cvs/{cv["id"]}').status_code==400


def test_expired_sessions_and_reviews_keep_published_result(clients):
    first,_,anon,dbs=clients
    with dbs() as db:
        db.query(AccountModel).filter_by(email="user0@example.com").update({"email_verified_at": datetime.now()})
        db.commit()
    cv=create(first)
    review=first.post("/api/publication:preview",json={"sourceId":cv["id"],"etag":cv["etag"],"fields":[],"sectionIds":["education"]}).json()
    assert first.post("/api/publication:publish",json={"reviewId":review["id"]}).status_code==200
    public_id=first.get("/api/account").json()["publicId"]
    with dbs() as db:
        db.query(SessionModel).update({"expires_at":datetime.now()-timedelta(days=1)})
        db.commit()
    assert first.delete("/api/publication").status_code==401
    assert anon.get(f"/api/public/{public_id}").status_code==200


def test_normalized_photo_is_stable_across_saves_and_backup_restore(clients):
    first,_,_,_=clients
    output=io.BytesIO();Image.new("RGB",(30,40),(100,120,130)).save(output,"PNG")
    photo="data:image/png;base64,"+base64.b64encode(output.getvalue()).decode()
    cv=create(first,profile={"fullName":"Photo","avatarUrl":photo})
    for _ in range(3):
        updated=first.patch(f'/api/cvs/{cv["id"]}',json={"etag":cv["etag"],"profile":cv["profile"]}).json()
        assert updated["profile"]["avatarUrl"]==cv["profile"]["avatarUrl"]
        cv=updated
    restored=create(first,profile=cv["profile"])
    assert restored["profile"]["avatarUrl"]==cv["profile"]["avatarUrl"]


def test_presets_are_owned_and_never_change_existing_cv(clients):
    first,second,_,_=clients
    preset=first.post("/api/presets",json={"id":"","displayName":"Template","settings":{"templateId":"timeline","accent":"blue"}})
    assert preset.status_code==200
    data=preset.json()
    cv=create(first,styleSettings=data["settings"])
    assert second.get("/api/presets").json()==[]
    assert second.delete("/api/presets/"+data["id"]).status_code==404
    assert first.post("/api/presets",json={**data,"displayName":"Renamed","settings":{"templateId":"compact"}}).status_code==200
    assert first.get(f'/api/cvs/{cv["id"]}').json()["styleSettings"]["templateId"]=="timeline"
    assert first.delete("/api/presets/"+data["id"]).status_code==204
    assert first.get(f'/api/cvs/{cv["id"]}').json()["styleSettings"]["accent"]=="blue"


def test_photo_upload_download_remains_owned_and_valid(clients):
    first,second,anon,_=clients
    cv=create(first)
    output=io.BytesIO();Image.new("RGB",(30,40),(100,120,130)).save(output,"PNG")
    response=first.post(f'/api/cvs/{cv["id"]}/avatar',files={"file":("photo.png",output.getvalue(),"image/png")})
    assert response.status_code==200
    assert response.json()["profile"]["fullName"]==cv["profile"]["fullName"]
    photo=first.get(f'/api/cvs/{cv["id"]}/avatar')
    assert photo.status_code==200 and photo.headers["content-type"]=="image/jpeg"
    assert second.get(f'/api/cvs/{cv["id"]}/avatar').status_code==404
    assert anon.get(f'/api/cvs/{cv["id"]}/avatar').status_code==401
