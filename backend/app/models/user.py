from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import Column, UUID, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
import enum

from app.models.base import Base

class UserRole(str, enum.Enum):
    EMPLOYEE = "employee"
    MANAGER = "manager"
    ADMIN = "admin"

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default='employee')
    manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    department = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Self-referential relationship for manager
    manager = relationship("User", remote_side=[id], foreign_keys=[manager_id])

    # Relationships to goal sheets and audits
    goal_sheets = relationship("GoalSheet", back_populates="employee", foreign_keys="GoalSheet.employee_id")
    approved_goal_sheets = relationship("GoalSheet", back_populates="approved_by_user", foreign_keys="GoalSheet.approved_by")
    shared_goals = relationship("Goal", back_populates="shared_by_user", foreign_keys="Goal.shared_by")
    checkin_comments = relationship("CheckinComment", back_populates="manager")
    audit_logs = relationship("AuditLog", back_populates="changed_by_user", foreign_keys="AuditLog.changed_by")

    def __repr__(self):
        return f"<User {self.email} ({self.role})>"
