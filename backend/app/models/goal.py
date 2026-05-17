from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import Column, UUID, String, ForeignKey, DateTime, Float, Date, Boolean
from sqlalchemy.orm import relationship
import enum

from app.models.base import Base

class UOMType(str, enum.Enum):
    NUMERIC_MIN = "numeric_min"
    NUMERIC_MAX = "numeric_max"
    TIMELINE = "timeline"
    ZERO = "zero"

class Goal(Base):
    __tablename__ = "goals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    goal_sheet_id = Column(UUID(as_uuid=True), ForeignKey("goal_sheets.id"), nullable=False)
    thrust_area = Column(String(255), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(String(2000), nullable=True)
    uom_type = Column(String(50), nullable=False)
    target_value = Column(Float, nullable=False)
    target_date = Column(Date, nullable=True)
    weightage = Column(Float, nullable=False)
    is_shared = Column(Boolean, default=False)
    shared_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    is_locked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    goal_sheet = relationship("GoalSheet", back_populates="goals")
    shared_by_user = relationship("User", back_populates="shared_goals", foreign_keys=[shared_by])
    achievements = relationship("Achievement", back_populates="goal", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="goal", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Goal {self.title} ({self.weightage}%)>"
