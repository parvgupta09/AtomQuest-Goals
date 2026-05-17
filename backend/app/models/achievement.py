from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import Column, UUID, String, ForeignKey, DateTime, Float, Date
from sqlalchemy.orm import relationship
import enum

from app.models.base import Base

class AchievementStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    ON_TRACK = "on_track"
    COMPLETED = "completed"

class Achievement(Base):
    __tablename__ = "achievements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    goal_id = Column(UUID(as_uuid=True), ForeignKey("goals.id"), nullable=False)
    goal_sheet_id = Column(UUID(as_uuid=True), ForeignKey("goal_sheets.id"), nullable=False)
    cycle_phase = Column(String(10), nullable=False)  # q1, q2, q3, q4
    actual_value = Column(Float, nullable=True)
    actual_date = Column(Date, nullable=True)
    status = Column(String(50), nullable=False, default='not_started')
    progress_score = Column(Float, nullable=True)  # Computed: 0.0 to 1.0
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    goal = relationship("Goal", back_populates="achievements")
    goal_sheet = relationship("GoalSheet", back_populates="achievements")

    def __repr__(self):
        return f"<Achievement goal_id={self.goal_id} {self.cycle_phase}>"
