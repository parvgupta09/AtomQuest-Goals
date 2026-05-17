from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class CheckinCreate(BaseModel):
    goal_sheet_id: UUID
    phase: str = Field(..., pattern="^(q1|q2|q3|q4)$")
    comment: str = Field(..., min_length=1, max_length=2000)

class CheckinResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    goal_sheet_id: UUID
    manager_id: UUID
    phase: str
    comment: str
    created_at: datetime
