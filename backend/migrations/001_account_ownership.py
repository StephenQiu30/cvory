"""Non-destructive ownership migration; run with `uv run python migrations/001_account_ownership.py`."""
import sys
import argparse
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import inspect, text
from app.core.database import engine, Base
from app.models.cv import CVModel
from app.models.account import AccountModel, SessionModel, PublicationModel, PublicationReviewModel, PresetModel

from app.services.auth_limits import AuthAttemptModel

with engine.begin() as connection:
    inspector = inspect(connection)
    if "cvs" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("cvs")}
        if "owner_id" not in columns:
            connection.execute(text("ALTER TABLE cvs ADD COLUMN owner_id VARCHAR(36) NOT NULL DEFAULT 'legacy'"))
        indexes = {item["name"] for item in inspect(connection).get_indexes("cvs")}
        if "ix_cvs_owner_id" not in indexes:
            connection.execute(text("CREATE INDEX ix_cvs_owner_id ON cvs (owner_id)"))
Base.metadata.create_all(engine)
parser = argparse.ArgumentParser()
parser.add_argument("--assign-legacy-to", help="Explicitly assign legacy CVs to an existing account email.")
args = parser.parse_args()
if args.assign_legacy_to:
    from app.core.database import SessionLocal
    with SessionLocal() as db:
        account = db.query(AccountModel).filter_by(email=args.assign_legacy_to.strip().lower()).first()
        if not account:
            raise SystemExit("Register the target account before assigning legacy documents.")
        count = db.query(CVModel).filter_by(owner_id="legacy").update({"owner_id": account.id})
        db.commit()
        print(f"Assigned {count} legacy CVs to the specified account.")
else:
    print("Account tables ready; existing CVs remain assigned to legacy.")
