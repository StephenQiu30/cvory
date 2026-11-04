"""Isolated browser-test server with a local-only synthetic mail sink."""
import json
import os
import sys
from pathlib import Path

from cryptography.fernet import Fernet

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

root_value = os.environ.get("CV_TEST_DIR", "")
if not root_value:
    raise SystemExit("Set CV_TEST_DIR to a new, empty temporary directory.")
root = Path(root_value).resolve()
if not root.is_dir() or any(root.iterdir()):
    raise SystemExit("CV_TEST_DIR must be an existing empty directory.")
frontend_origin = os.environ.get("CV_TEST_URL", "http://127.0.0.1:3100")
os.environ.update({
    "DATABASE_URL": f"sqlite:///{root / 'database.sqlite'}",
    "DATA_DIR": str(root / "data"),
    "DELETION_ENABLED": "true",
    "DELETION_TOMBSTONE_DIR": str(root / "ledger"),
    "DELETION_TOMBSTONE_KEY": "isolated-test-key-do-not-use-in-production",
    "MAIL_ENCRYPTION_KEY": Fernet.generate_key().decode(),
    "MAIL_RATE_LIMIT_KEY": "isolated-test-key-do-not-use-in-production",
    "PUBLIC_APP_ORIGIN": frontend_origin,
    "FRONTEND_INTERNAL_URL": frontend_origin,
    "CORS_ORIGINS": json.dumps([frontend_origin]),
    "SMTP_ENABLED": "true",
    "SMTP_HOST": "test.invalid",
    "SMTP_FROM_EMAIL": "test@example.com",
})

from app.services.account_deletion import initialize_ledger  # noqa: E402
from app.services import account_mail  # noqa: E402

initialize_ledger()


def capture_mail(payload):
    if not payload["recipient"].endswith("@example.com"):
        raise ValueError("Test sink only accepts example.com addresses")
    path = root / "mail.jsonl"
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
    with os.fdopen(fd, "a") as output:
        output.write(json.dumps(payload) + "\n")


account_mail.send_smtp = capture_mail

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=int(os.environ.get("CV_TEST_BACKEND_PORT", "18432")))
