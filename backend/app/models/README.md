"""
SQLAlchemy ORM Models for Goal Setting & Performance Tracking Portal

All models use UUID primary keys and async-compatible SQLAlchemy 2.0+ patterns.
Relationships are properly defined with foreign keys and cascading deletes where appropriate.
"""

from app.models.base import Base
from app.models.user import User, UserRole
from app.models.goal_cycle import GoalCycle, CyclePhase
from app.models.goal_sheet import GoalSheet, GoalSheetStatus
from app.models.goal import Goal, UOMType
from app.models.achievement import Achievement, AchievementStatus
from app.models.checkin_comment import CheckinComment
from app.models.audit_log import AuditLog

__all__ = [
    "Base",
    "User",
    "UserRole",
    "GoalCycle",
    "CyclePhase",
    "GoalSheet",
    "GoalSheetStatus",
    "Goal",
    "UOMType",
    "Achievement",
    "AchievementStatus",
    "CheckinComment",
    "AuditLog",
]

"""
MODEL RELATIONSHIPS SUMMARY
============================

User (employees, managers, admins)
  - Self-referential: manager_id -> User.id
  - 1-to-Many: goal_sheets (employee)
  - 1-to-Many: approved_goal_sheets (approved_by)
  - 1-to-Many: shared_goals (shared_by in Goal)
  - 1-to-Many: checkin_comments
  - 1-to-Many: audit_logs

GoalCycle (quarterly periods: goal_setting, q1, q2, q3, q4)
  - 1-to-Many: goal_sheets

GoalSheet (container for employee's goals per cycle)
  - FK: employee_id -> User
  - FK: cycle_id -> GoalCycle
  - FK: approved_by -> User (manager who approved)
  - 1-to-Many: goals (cascade delete)
  - 1-to-Many: achievements
  - 1-to-Many: checkin_comments (cascade delete)

Goal (individual goal with weightage and target)
  - FK: goal_sheet_id -> GoalSheet
  - FK: shared_by -> User (nullable, for shared goals)
  - is_locked: True after manager approval
  - 1-to-Many: achievements (cascade delete)
  - 1-to-Many: audit_logs (cascade delete, tracks post-lock edits)

Achievement (quarterly progress update for a goal)
  - FK: goal_id -> Goal
  - FK: goal_sheet_id -> GoalSheet
  - progress_score: Computed field (0.0 to 1.0)

CheckinComment (manager feedback during review cycles)
  - FK: goal_sheet_id -> GoalSheet
  - FK: manager_id -> User

AuditLog (tracks all changes to goals after approval)
  - FK: goal_id -> Goal
  - FK: changed_by -> User (usually Admin)
  - Records old_value and new_value as JSON

ENUMS
=====
UserRole: employee, manager, admin
CyclePhase: goal_setting, q1, q2, q3, q4
GoalSheetStatus: draft, submitted, approved, returned
UOMType: numeric_min, numeric_max, timeline, zero
AchievementStatus: not_started, on_track, completed
"""
