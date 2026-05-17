from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import Column, UUID, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship

from app.models.base import Base

class CheckinComment(Base):
    __tablename__ = "checkin_comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    goal_sheet_id = Column(UUID(as_uuid=True), ForeignKey("goal_sheets.id"), nullable=False)
    manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    phase = Column(String(10), nullable=False)  # q1, q2, q3, q4
    comment = Column(String(2000), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    goal_sheet = relationship("GoalSheet", back_populates="checkin_comments")
    manager = relationship("User", back_populates="checkin_comments")

    def __repr__(self):
        return f"<CheckinComment goal_sheet_id={self.goal_sheet_id} {self.phase}>"
