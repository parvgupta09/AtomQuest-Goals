from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.achievement import Achievement
from app.models.goal import Goal
from app.models.goal_sheet import GoalSheet
from app.models.user import User

router = APIRouter(prefix="/reports")

@router.get("/achievement")
async def get_achievement_report(
    current_user = Depends(require_role("manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Get full achievement report (Manager + Admin only)."""
    stmt = (
        select(Achievement)
        .options(
            selectinload(Achievement.goal),
            selectinload(Achievement.goal_sheet).selectinload(GoalSheet.employee),
        )
        .order_by(Achievement.updated_at.desc())
    )
    result = await db.execute(stmt)
    achievements = result.scalars().all()

    report = []
    for a in achievements:
        goal = a.goal
        employee = a.goal_sheet.employee if a.goal_sheet else None
        report.append({
            "employee_name": employee.name if employee else "Unknown",
            "employee_id": str(a.goal_sheet.employee_id) if a.goal_sheet else None,
            "goal_title": goal.title if goal else "Unknown",
            "goal_id": str(a.goal_id),
            "target_value": goal.target_value if goal else None,
            "actual_value": a.actual_value,
            "progress_score": a.progress_score or 0.0,
            "status": a.status.value if hasattr(a.status, 'value') else str(a.status),
            "cycle_phase": a.cycle_phase,
            "updated_at": a.updated_at.isoformat() if a.updated_at else None,
        })

    return report


@router.get("/completion")
async def get_completion_report(
    current_user = Depends(require_role("manager", "admin")),
    db: AsyncSession = Depends(get_db)
):
    """Get completion rates (Manager + Admin only)."""
    stmt = (
        select(GoalSheet)
        .options(selectinload(GoalSheet.employee), selectinload(GoalSheet.goals))
    )
    result = await db.execute(stmt)
    sheets = result.scalars().all()

    return [
        {
            "employee_name": s.employee.name if s.employee else "Unknown",
            "status": s.status.value if hasattr(s.status, 'value') else str(s.status),
            "goals_count": len(s.goals),
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
        }
        for s in sheets
    ]


@router.get("/audit-log")
async def get_audit_log(
    current_user = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """Get audit trail (Admin only)."""
    from app.models.audit_log import AuditLog
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
    result = await db.execute(stmt)
    logs = result.scalars().all()
    return [
        {
            "id": str(log.id),
            "action": log.action,
            "performed_by": str(log.performed_by),
            "target_type": log.target_type,
            "target_id": str(log.target_id) if log.target_id else None,
            "details": log.details,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]

