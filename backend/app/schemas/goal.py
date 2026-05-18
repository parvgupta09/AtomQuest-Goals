from uuid import UUID
from datetime import date, datetime
from pydantic import BaseModel, Field, field_validator, ConfigDict
from app.models.goal import UOMType

class GoalCreate(BaseModel):
    thrust_area: str = Field(..., min_length=1, max_length=255)
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = Field(None, max_length=2000)
    uom_type: UOMType
    target_value: float | None = None
    target_date: date | None = None
    weightage: float

    @field_validator("weightage")
    @classmethod
    def validate_weightage(cls, v):
        if v < 10.0:
            raise ValueError("Minimum weightage per goal is 10%")
        if v > 100.0:
            raise ValueError("Maximum weightage per goal is 100%")
        return v

class GoalUpdate(BaseModel):
    thrust_area: str | None = None
    title: str | None = None
    description: str | None = None
    uom_type: UOMType | None = None
    target_value: float | None = None
    target_date: date | None = None
    weightage: float | None = None

    @field_validator("weightage")
    @classmethod
    def validate_weightage(cls, v):
        if v is None:
            return v
        if v < 10.0:
            raise ValueError("Minimum weightage per goal is 10%")
        if v > 100.0:
            raise ValueError("Maximum weightage per goal is 100%")
        return v

class GoalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    goal_sheet_id: UUID
    thrust_area: str
    title: str
    description: str | None
    uom_type: UOMType
    target_value: float | None = None
    target_date: date | None
    weightage: float
    is_shared: bool
    shared_by: UUID | None
    is_locked: bool
    created_at: datetime

class GoalSheetSubmit(BaseModel):
    goals: list[GoalCreate]

    @field_validator("goals")
    @classmethod
    def validate_goals_count(cls, v):
        if len(v) > 8:
            raise ValueError("Maximum 8 goals allowed per goal sheet")
        return v

    @field_validator("goals")
    @classmethod
    def validate_total_weightage(cls, v):
        total = sum(goal.weightage for goal in v)
        if abs(total - 100.0) > 0.01:
            raise ValueError(f"Total weightage must equal 100%, got {total}%")
        return v

    @field_validator("goals")
    @classmethod
    def validate_individual_weightages(cls, v):
        for goal in v:
            if goal.weightage < 10.0:
                raise ValueError(f"Goal '{goal.title}': minimum weightage is 10%, got {goal.weightage}%")
        return v
