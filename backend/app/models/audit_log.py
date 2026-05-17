from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import Column, UUID, String, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship

from app.models.base import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    goal_id = Column(UUID(as_uuid=True), ForeignKey("goals.id"), nullable=False)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    change_type = Column(String(50), nullable=False)  # e.g., "goal_updated", "goal_unlocked"
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    changed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    goal = relationship("Goal", back_populates="audit_logs")
    changed_by_user = relationship("User", back_populates="audit_logs")

    def __repr__(self):
        return f"<AuditLog goal_id={self.goal_id} {self.change_type}>"
