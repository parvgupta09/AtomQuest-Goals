from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from app.models.goal_sheet import GoalSheetStatus

class GoalSheetCreate(BaseModel):
    cycle_id: UUID

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: str
    role: str
    department: str | None

class GoalResponseForSheet(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    goal_sheet_id: UUID
    thrust_area: str
    title: str
    description: str | None
    uom_type: str
    target_value: float | None = None
    target_date: datetime | None
    weightage: float
    is_shared: bool
    shared_by: UUID | None
    is_locked: bool
    created_at: datetime

class GoalSheetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    employee_id: UUID
    cycle_id: UUID
    status: GoalSheetStatus
    submitted_at: datetime | None
    approved_at: datetime | None
    approved_by: UUID | None
    created_at: datetime
    employee: UserResponse | None = None
    goals: list[GoalResponseForSheet] = []
