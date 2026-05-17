from uuid import UUID
from datetime import date, datetime
from pydantic import BaseModel, Field, ConfigDict
from app.models.achievement import AchievementStatus

class AchievementCreate(BaseModel):
    goal_id: UUID
    cycle_phase: str = Field(..., pattern="^(q1|q2|q3|q4)$")
    actual_value: float | None = None
    actual_date: date | None = None
    status: AchievementStatus = AchievementStatus.NOT_STARTED

class AchievementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    goal_id: UUID
    goal_sheet_id: UUID
    cycle_phase: str
    actual_value: float | None
    actual_date: date | None
    status: AchievementStatus
    progress_score: float | None
    updated_at: datetime
