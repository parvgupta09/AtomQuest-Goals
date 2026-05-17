from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Any

class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    goal_id: UUID
    changed_by: UUID
    change_type: str
    old_value: dict[str, Any] | None
    new_value: dict[str, Any] | None
    changed_at: datetime
