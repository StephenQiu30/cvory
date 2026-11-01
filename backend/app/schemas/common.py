"""Common schema bases and utilities."""

from datetime import datetime, timezone
from typing import Any
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


def to_rfc3339(dt: datetime) -> str:
    """Format datetime as RFC 3339 UTC string."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


class CamelModel(BaseModel):
    """Pydantic model that automatically converts snake_case to lowerCamelCase."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )
