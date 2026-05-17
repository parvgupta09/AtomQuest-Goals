from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import Column, UUID, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
import enum

from app.models.base import Base

class GoalSheetStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    RETURNED = "returned"

class GoalSheet(Base):
    __tablename__ = "goal_sheets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    cycle_id = Column(UUID(as_uuid=True), ForeignKey("goal_cycles.id"), nullable=False)
    status = Column(String(50), nullable=False, default='draft')
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    employee = relationship("User", back_populates="goal_sheets", foreign_keys=[employee_id])
    approved_by_user = relationship("User", back_populates="approved_goal_sheets", foreign_keys=[approved_by])
    cycle = relationship("GoalCycle", back_populates="goal_sheets")
    goals = relationship("Goal", back_populates="goal_sheet", cascade="all, delete-orphan")
    achievements = relationship("Achievement", back_populates="goal_sheet")
    checkin_comments = relationship("CheckinComment", back_populates="goal_sheet", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<GoalSheet {self.id} ({self.status})>"
