from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import Column, UUID, String, DateTime, Boolean
from sqlalchemy.orm import relationship
import enum

from app.models.base import Base

class CyclePhase(str, enum.Enum):
    GOAL_SETTING = "goal_setting"
    Q1 = "q1"
    Q2 = "q2"
    Q3 = "q3"
    Q4 = "q4"

class GoalCycle(Base):
    __tablename__ = "goal_cycles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    phase = Column(String(50), nullable=False)
    opens_at = Column(DateTime(timezone=True), nullable=False)
    closes_at = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, default=False)

    # Relationships
    goal_sheets = relationship("GoalSheet", back_populates="cycle")

    def __repr__(self):
        return f"<GoalCycle {self.name} ({self.phase})>"
