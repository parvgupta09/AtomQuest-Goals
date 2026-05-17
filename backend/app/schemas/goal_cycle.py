from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from app.models.goal_cycle import CyclePhase

class CycleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    phase: CyclePhase
    opens_at: datetime
    closes_at: datetime

class CycleUpdate(BaseModel):
    name: str | None = None
    phase: CyclePhase | None = None
    opens_at: datetime | None = None
    closes_at: datetime | None = None
    is_active: bool | None = None

class CycleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    phase: CyclePhase
    opens_at: datetime
    closes_at: datetime
    is_active: bool
