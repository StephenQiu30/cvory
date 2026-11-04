"""Security contracts for account verification and lifecycle."""
from tests.test_accounts_publication import clients, create
import pytest
from cryptography.fernet import Fernet
from app.core.config import settings


@pytest.fixture(autouse=True)
def mail_settings(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "mail_encryption_key", Fernet.generate_key().decode())
    monkeypatch.setattr(settings, "mail_rate_limit_key", "test-key-not-for-production")
    monkeypatch.setattr(settings, "public_app_origin", "http://localhost:1234")
    monkeypatch.setattr(settings, "smtp_enabled", True)
    monkeypatch.setattr(settings, "smtp_host", "smtp.test.invalid")
    monkeypatch.setattr(settings, "smtp_from_email", "sender@example.com")
    monkeypatch.setattr(settings, "deletion_tombstone_dir", tmp_path / "ledger")
    monkeypatch.setattr(settings, "deletion_tombstone_key", "unit-test-key")
    monkeypatch.setattr(settings, "deletion_enabled", True)
    from app.services.account_deletion import initialize_ledger
    initialize_ledger()


def test_restore_replays_tombstones_and_rejects_wrong_key(clients, monkeypatch):
    from app.models.account import AccountModel
    from app.services.account_deletion import write_tombstone, reconcile_restored_accounts
    first, second, _, sessions = clients
    first_cv = create(first)
    second_cv = create(second)
    with sessions() as db:
        owner = db.query(AccountModel).filter_by(email='user0@example.com').one().id
        write_tombstone(owner)
        monkeypatch.setattr(settings, 'deletion_tombstone_key', 'wrong-key')
        with pytest.raises(ValueError):
            reconcile_restored_accounts(db)
        assert db.get(AccountModel, owner) is not None
        monkeypatch.setattr(settings, 'deletion_tombstone_key', 'unit-test-key')
        assert reconcile_restored_accounts(db) == 1
        assert reconcile_restored_accounts(db) == 0
    assert first.get('/api/cvs/' + first_cv['id']).status_code == 401
    assert second.get('/api/cvs/' + second_cv['id']).status_code == 200


def test_deletion_cannot_start_without_valid_ledger(clients, monkeypatch):
    first, _, _, _ = clients
    monkeypatch.setattr(settings, 'deletion_tombstone_key', 'wrong-key')
    assert first.post('/api/account:requestDeletion', json={'password':'correct-long-password'}).status_code == 503
    assert first.get('/api/account').status_code == 200


def test_deletion_cleanup_failure_is_retryable(clients, monkeypatch):
    from datetime import datetime, timedelta, timezone
    from app.models.account import AccountModel, AccountDeletionJobModel
    from app.services import account_deletion
    first, _, _, sessions = clients
    cv = create(first)
    assert first.post('/api/account:requestDeletion', json={'password':'correct-long-password'}).status_code == 204
    original = account_deletion.remove_owned_data
    with sessions() as db:
        account = db.query(AccountModel).filter_by(email='user0@example.com').one()
        owner = account.id
        account.purge_after = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=1)
        db.query(AccountDeletionJobModel).filter_by(owner_id=owner).update({'next_attempt_at':account.purge_after})
        db.commit()
        monkeypatch.setattr(account_deletion, 'remove_owned_data', lambda *args: (_ for _ in ()).throw(OSError()))
        assert account_deletion.process_deletion_jobs(db) == 0
        assert db.get(AccountModel, owner) is not None
        job = db.query(AccountDeletionJobModel).filter_by(owner_id=owner).one()
        assert job.status == 'queued'
        job.next_attempt_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=1)
        db.commit()
        monkeypatch.setattr(account_deletion, 'remove_owned_data', original)
        assert account_deletion.process_deletion_jobs(db) == 1
        assert db.get(AccountModel, owner) is None


def test_restored_database_snapshot_replays_deletion(clients, tmp_path):
    import sqlite3
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.models.account import AccountModel, AccountDeletionJobModel
    from app.models.cv import CVModel
    from app.services.account_deletion import process_deletion_jobs, reconcile_restored_accounts
    first, second, _, sessions = clients
    own, other = create(first), create(second)
    with sessions() as db:
        owner = db.query(AccountModel).filter_by(email='user0@example.com').one().id
        source = db.get_bind().raw_connection()
        backup = sqlite3.connect(tmp_path / 'backup.sqlite')
        source.driver_connection.backup(backup)
        backup.close()
        source.close()
    assert first.post('/api/account:requestDeletion', json={'password':'correct-long-password'}).status_code == 204
    with sessions() as db:
        account = db.get(AccountModel, owner)
        account.purge_after = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=1)
        db.query(AccountDeletionJobModel).filter_by(owner_id=owner).update({'next_attempt_at': account.purge_after})
        db.commit()
        assert process_deletion_jobs(db) == 1
    restored = create_engine(f'sqlite:///{tmp_path / "backup.sqlite"}')
    with Session(restored) as db:
        assert db.get(CVModel, own['id']) is not None
        assert reconcile_restored_accounts(db) == 1
        assert db.get(CVModel, own['id']) is None
        assert db.get(CVModel, other['id']) is not None
    restored.dispose()


def test_change_password_rotates_sessions(clients):
    first, _, anon, _ = clients
    assert first.post('/api/account:changePassword', json={'password': 'wrong-password', 'newPassword': 'a-new-long-password'}).status_code == 401
    assert first.post('/api/account:changePassword', json={'password': 'correct-long-password', 'newPassword': 'a-new-long-password'}).status_code == 200
    assert first.get('/api/account').status_code == 200
    assert anon.post('/api/account:login', json={'email': 'user0@example.com', 'password': 'correct-long-password'}).status_code == 401
    assert anon.post('/api/account:login', json={'email': 'user0@example.com', 'password': 'a-new-long-password'}).status_code == 200


def test_unverified_account_cannot_publish_but_can_keep_private_cv(clients):
    first, _, _, sessions = clients
    cv = create(first)
    preview = first.post('/api/publication:preview', json={
        'sourceId': cv['id'], 'etag': cv['etag'], 'fields': [], 'sectionIds': []
    })
    assert preview.status_code == 200
    result = first.post('/api/publication:publish', json={'reviewId': preview.json()['id']})
    assert result.status_code == 403
    assert first.get(f'/api/cvs/{cv["id"]}').status_code == 200


def test_verification_requires_correct_authenticated_owner_and_single_use(clients):
    first, second, _, sessions = clients
    response = first.post('/api/account:requestEmailVerification')
    assert response.status_code == 202
    from app.models.account import MailJobModel
    from app.services.account_mail import decrypt_payload
    with sessions() as db:
        job = db.query(MailJobModel).one()
        token = decrypt_payload(job.encrypted_payload)['token']
    assert second.post('/api/account:verifyEmail', json={'token': token}).status_code == 400
    assert first.post('/api/account:verifyEmail', json={'token': token}).status_code == 200
    assert first.get('/api/account').json()['emailVerified'] is True
    assert first.post('/api/account:verifyEmail', json={'token': token}).status_code == 400


def test_password_reset_is_generic_one_use_and_revokes_sessions(clients):
    first, _, anon, sessions = clients
    from datetime import datetime, timezone
    from app.models.account import AccountModel
    with sessions() as db:
        account = db.query(AccountModel).filter_by(email='user0@example.com').one()
        account.email_verified_at = datetime.now(timezone.utc).replace(tzinfo=None)
        db.commit()
    known = anon.post('/api/account:requestPasswordReset', json={'email': 'user0@example.com'})
    unknown = anon.post('/api/account:requestPasswordReset', json={'email': 'missing@example.com'})
    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    from app.models.account import MailJobModel
    from app.services.account_mail import decrypt_payload
    with sessions() as db:
        job = db.query(MailJobModel).one()
        token = decrypt_payload(job.encrypted_payload)['token']
    payload = {'token': token, 'password': 'a-new-long-password'}
    assert anon.post('/api/account:resetPassword', json=payload).status_code == 204
    assert anon.post('/api/account:resetPassword', json=payload).status_code == 400
    assert first.get('/api/account').status_code == 401
    assert anon.post('/api/account:login', json={'email':'user0@example.com','password':'a-new-long-password'}).status_code == 200


def test_mail_queue_is_encrypted_and_delivered_once(clients, monkeypatch):
    first, _, _, sessions = clients
    assert first.post('/api/account:requestEmailVerification').status_code == 202
    from app.models.account import MailJobModel
    from app.services import account_mail
    delivered = []
    monkeypatch.setattr(account_mail, 'send_smtp', lambda payload: delivered.append(payload))
    with sessions() as db:
        job = db.query(MailJobModel).one()
        assert b'user0@example.com' not in job.encrypted_payload
        assert account_mail.process_mail_jobs(db) == 1
    assert delivered[0]['recipient'] == 'user0@example.com'
    with sessions() as db:
        job = db.query(MailJobModel).one()
        assert job.status == 'sent'
        assert job.encrypted_payload is None
        assert account_mail.process_mail_jobs(db) == 0


def test_verification_resend_is_rate_limited_without_exposing_status(clients):
    first, _, _, sessions = clients
    a = first.post('/api/account:requestEmailVerification')
    b = first.post('/api/account:requestEmailVerification')
    assert a.status_code == b.status_code == 202
    assert a.json() == b.json()
    from app.models.account import MailJobModel
    with sessions() as db:
        assert db.query(MailJobModel).count() == 1


def test_deletion_freezes_access_and_can_be_cancelled_without_new_session(clients):
    from datetime import datetime, timezone
    from app.models.account import AccountModel
    first, _, anon, sessions = clients
    with sessions() as db:
        account = db.query(AccountModel).filter_by(email='user0@example.com').one()
        account.email_verified_at = datetime.now(timezone.utc).replace(tzinfo=None)
        public_id = account.public_id
        db.commit()
    cv = create(first)
    review = first.post('/api/publication:preview', json={'sourceId':cv['id'],'etag':cv['etag'],'fields':[],'sectionIds':[]}).json()
    assert first.post('/api/publication:publish', json={'reviewId':review['id']}).status_code == 200
    assert anon.get('/api/public/' + public_id).status_code == 200
    assert first.post('/api/account:requestDeletion', json={'password':'wrong-password'}).status_code == 401
    assert first.post('/api/account:requestDeletion', json={'password':'correct-long-password'}).status_code == 204
    assert first.get('/api/account').status_code == 401
    assert anon.get('/api/public/' + public_id).status_code == 404
    assert anon.post('/api/account:login', json={'email':'user0@example.com','password':'correct-long-password'}).status_code == 401
    assert anon.post('/api/account:cancelDeletion', json={'email':'user0@example.com','password':'correct-long-password'}).status_code == 204
    assert anon.get('/api/account').status_code == 401
    assert anon.post('/api/account:login', json={'email':'user0@example.com','password':'correct-long-password'}).status_code == 200
    assert anon.get('/api/public/' + public_id).status_code == 200
    assert anon.get('/api/cvs/' + cv['id']).status_code == 200


def test_pending_deletion_blocks_existing_print_context(clients):
    import time
    from app.api.pdf import _contexts, _lock
    from app.models.account import AccountModel
    from app.schemas.account import ResumeDocument
    first, _, anon, sessions = clients
    cv = create(first)
    with sessions() as db:
        owner = db.query(AccountModel).filter_by(email='user0@example.com').one().id
    document = ResumeDocument.model_validate({
        'profile': cv['profile'], 'sections': cv['sections'], 'styleSettings': cv['styleSettings']
    })
    with _lock:
        _contexts['test-ticket'] = (time.monotonic() + 60, document, owner)
    try:
        assert anon.get('/api/print/test-ticket').status_code == 200
        assert first.post('/api/account:requestDeletion', json={'password': 'correct-long-password'}).status_code == 204
        assert anon.get('/api/print/test-ticket').status_code == 404
    finally:
        with _lock:
            _contexts.pop('test-ticket', None)


def test_account_migration_preserves_unverified_legacy_accounts(tmp_path):
    import os
    import sqlite3
    import subprocess
    import sys
    db_path = tmp_path / 'legacy.sqlite'
    with sqlite3.connect(db_path) as conn:
        conn.execute('CREATE TABLE accounts (id VARCHAR(36) PRIMARY KEY, email VARCHAR(254) UNIQUE NOT NULL, password_hash VARCHAR(256) NOT NULL, display_name VARCHAR(80) NOT NULL, avatar TEXT, public_id VARCHAR(36) UNIQUE NOT NULL)')
        conn.execute("INSERT INTO accounts VALUES ('old', 'old@example.com', 'hash', 'Old', NULL, 'public')")
    env = {**os.environ, 'DATABASE_URL': f'sqlite:///{db_path}'}
    for _ in range(2):
        result = subprocess.run([sys.executable, 'migrations/002_account_lifecycle.py'], env=env, capture_output=True, text=True)
        assert result.returncode == 0, result.stderr
    with sqlite3.connect(db_path) as conn:
        assert conn.execute('SELECT id, email_verified_at, status FROM accounts').fetchone() == ('old', None, 'active')


def test_due_deletion_cleans_only_owner_and_writes_tombstone(clients, tmp_path, monkeypatch):
    from datetime import datetime, timedelta, timezone
    from app.models.account import AccountModel, AccountDeletionJobModel
    from app.services.account_deletion import process_deletion_jobs, tombstone_name
    first, second, _, sessions = clients
    monkeypatch.setattr(settings, 'deletion_tombstone_dir', tmp_path / 'ledger')
    monkeypatch.setattr(settings, 'deletion_tombstone_key', 'unit-test-key')
    monkeypatch.setattr(settings, 'data_dir', tmp_path / 'files')
    own = create(first)
    other = create(second)
    with sessions() as db:
        owner = db.query(AccountModel).filter_by(email='user0@example.com').one().id
    assert first.post('/api/account:requestDeletion', json={'password':'correct-long-password'}).status_code == 204
    with sessions() as db:
        account = db.get(AccountModel, owner)
        account.purge_after = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=1)
        db.query(AccountDeletionJobModel).filter_by(owner_id=owner).update({'next_attempt_at':account.purge_after})
        db.commit()
        assert process_deletion_jobs(db) == 1
        assert db.get(AccountModel, owner) is None
    assert (tmp_path / 'ledger' / tombstone_name(owner)).is_file()
    assert second.get('/api/cvs/' + other['id']).status_code == 200
    assert second.get('/api/cvs/' + own['id']).status_code == 404
