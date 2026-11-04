"""Add account lifecycle fields without modifying existing ownership or verification."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import inspect, text
from app.core.database import Base, engine
import app.models.account  # noqa: F401
import app.models.cv  # noqa: F401
import app.services.auth_limits  # noqa: F401

with engine.begin() as connection:
    inspector = inspect(connection)
    if "accounts" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("accounts")}
        additions = {
            "email_verified_at": "DATETIME NULL",
            "status": "VARCHAR(16) NOT NULL DEFAULT 'active'",
            "delete_requested_at": "DATETIME NULL",
            "purge_after": "DATETIME NULL",
        }
        for name, ddl in additions.items():
            if name not in columns:
                connection.execute(text(f"ALTER TABLE accounts ADD COLUMN {name} {ddl}"))
Base.metadata.create_all(engine)
print("Account lifecycle tables ready; existing addresses remain unverified.")
