from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.achievement import Achievement
from app.models.goal import Goal
from app.models.goal_sheet import GoalSheet
from app.models.user import User
from app.models.goal_cycle import GoalCycle

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
    """Get completion rates for all cycles and phases (Manager + Admin only)."""
    # Get active cycle
    stmt = select(GoalCycle).where(GoalCycle.is_active == True)
    result = await db.execute(stmt)
    cycle = result.scalars().first()

    cycle_info = {
        "name": cycle.name if cycle else "No active cycle",
        "phase": cycle.phase if cycle else None
    }

    # Get all goal sheets for employees (not managers/admins)
    stmt = select(User).where(User.role == "employee")
    result = await db.execute(stmt)
    employees = result.scalars().all()
    total_employees = len(employees)

    # Get goal sheets for current cycle
    stmt = (
        select(GoalSheet)
        .options(
            selectinload(GoalSheet.employee).selectinload(User.manager),
            selectinload(GoalSheet.goals)
        )
        .join(User, GoalSheet.employee_id == User.id)
        .where(GoalSheet.cycle_id == cycle.id) if cycle else select(GoalSheet).options(
            selectinload(GoalSheet.employee).selectinload(User.manager),
            selectinload(GoalSheet.goals)
        )
    )
    result = await db.execute(stmt)
    sheets = result.scalars().all()

    # Aggregate stats
    submitted_count = sum(1 for s in sheets if s.status == "submitted")
    approved_count = sum(1 for s in sheets if s.status == "approved")
    pending_count = submitted_count
    not_started = total_employees - len(sheets)

    # Build employee details
    employee_details = []
    for sheet in sheets:
        employee_details.append({
            "name": sheet.employee.name,
            "department": sheet.employee.department,
            "manager": sheet.employee.manager.name if sheet.employee.manager else "Unassigned",
            "sheet_status": sheet.status,
            "submitted_at": sheet.submitted_at.isoformat() if sheet.submitted_at else None,
            "approved_at": sheet.approved_at.isoformat() if sheet.approved_at else None
        })

    # Get check-in data by phase
    phases = ["q1", "q2", "q3", "q4"]
    checkins = {}

    for phase in phases:
        stmt = select(Achievement).options(
            selectinload(Achievement.goal_sheet)
        ).where(Achievement.cycle_phase == phase)
        result = await db.execute(stmt)
        achievements = result.scalars().all()

        completed_employees = set(a.goal_sheet.employee_id for a in achievements if a.goal_sheet)
        pending_employees = [e.id for e in employees if e.id not in completed_employees]

        checkins[phase] = {
            "completed": len(completed_employees),
            "pending": len(pending_employees),
            "employees": [e.name for e in employees if e.id in pending_employees]
        }

    return {
        "cycle": cycle_info,
        "goal_setting": {
            "total_employees": total_employees,
            "submitted": submitted_count,
            "approved": approved_count,
            "pending": pending_count,
            "not_started": not_started,
            "employees": employee_details
        },
        "check_ins": checkins
    }


@router.get("/audit-log")
async def get_audit_log(
    current_user = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """Get audit trail (Admin only)."""
    from app.models.audit_log import AuditLog
    stmt = select(AuditLog).order_by(AuditLog.changed_at.desc())
    result = await db.execute(stmt)
    logs = result.scalars().all()
    return [
        {
            "id": str(log.id),
            "change_type": log.change_type,
            "changed_by": str(log.changed_by),
            "goal_id": str(log.goal_id),
            "old_value": log.old_value,
            "new_value": log.new_value,
            "changed_at": log.changed_at.isoformat() if log.changed_at else None,
        }
        for log in logs
    ]


@router.get("/analytics")
async def get_analytics_report(
    current_user = Depends(require_role("manager", "admin")),
    db: AsyncSession = Depends(get_db)
):
    """Get analytics dashboard data (Manager + Admin only)."""
    # Get all employees and their departments
    stmt = select(User).where(User.role == "employee")
    result = await db.execute(stmt)
    employees = result.scalars().all()

    # Department progress
    departments = {}
    for emp in employees:
        dept = emp.department or "Unassigned"
        if dept not in departments:
            departments[dept] = {"count": 0, "score": 0}
        departments[dept]["count"] += 1

    # Calculate avg progress per department
    stmt = (
        select(Achievement)
        .options(
            selectinload(Achievement.goal_sheet).selectinload(GoalSheet.employee)
        )
    )
    result = await db.execute(stmt)
    achievements = result.scalars().all()

    for achievement in achievements:
        emp = achievement.goal_sheet.employee
        dept = emp.department or "Unassigned"
        if dept in departments:
            departments[dept]["score"] += achievement.progress_score or 0

    department_progress = [
        {
            "department": dept,
            "avg_progress": (departments[dept]["score"] / departments[dept]["count"]) if departments[dept]["count"] > 0 else 0,
            "employee_count": departments[dept]["count"]
        }
        for dept in departments
    ]

    # Thrust area distribution
    stmt = select(Goal)
    result = await db.execute(stmt)
    goals = result.scalars().all()

    thrust_counts = {}
    for goal in goals:
        thrust_counts[goal.thrust_area] = thrust_counts.get(goal.thrust_area, 0) + 1

    thrust_area_distribution = [
        {"thrust_area": thrust, "goal_count": count}
        for thrust, count in thrust_counts.items()
    ]

    # Status distribution
    stmt = select(Achievement)
    result = await db.execute(stmt)
    achievements = result.scalars().all()

    status_dist = {"not_started": 0, "on_track": 0, "completed": 0}
    for achievement in achievements:
        status = achievement.status.value if hasattr(achievement.status, 'value') else str(achievement.status)
        if status in status_dist:
            status_dist[status] += 1

    # Top performers
    emp_scores = {}
    for achievement in achievements:
        emp_id = achievement.goal_sheet.employee_id
        emp_name = achievement.goal_sheet.employee.name
        emp_dept = achievement.goal_sheet.employee.department
        if emp_id not in emp_scores:
            emp_scores[emp_id] = {"name": emp_name, "department": emp_dept, "scores": []}
        emp_scores[emp_id]["scores"].append(achievement.progress_score or 0)

    top_performers = [
        {
            "name": data["name"],
            "department": data["department"],
            "avg_score": sum(data["scores"]) / len(data["scores"]) if data["scores"] else 0
        }
        for emp_id, data in emp_scores.items()
    ]
    top_performers.sort(key=lambda x: x["avg_score"], reverse=True)
    top_performers = top_performers[:5]

    # Completion rate
    stmt = select(GoalSheet).where(GoalSheet.status == "approved")
    result = await db.execute(stmt)
    approved = result.scalars().all()

    stmt = select(GoalSheet)
    result = await db.execute(stmt)
    all_sheets = result.scalars().all()

    completion_rate = (len(approved) / len(all_sheets) * 100) if all_sheets else 0

    return {
        "overall_completion_rate": completion_rate,
        "department_progress": department_progress,
        "goal_status_distribution": [{"name": k, "value": v} for k, v in status_dist.items()],
        "goals_by_thrust_area": thrust_area_distribution,
        "top_performers": [
            {
                "employee_id": emp_id,
                "employee_name": data["name"],
                "department": data["department"],
                "avg_score": sum(data["scores"]) / len(data["scores"]) if data["scores"] else 0
            }
            for emp_id, data in emp_scores.items()
        ][:5]
    }


@router.get("/escalations")
async def get_escalations(
    current_user = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """Get escalation indicators (Admin only)."""
    # Get active cycle
    stmt = select(GoalCycle).where(GoalCycle.is_active == True)
    result = await db.execute(stmt)
    cycle = result.scalars().first()

    overdue_submissions = []
    pending_approvals = []

    if cycle:
        # Overdue submissions
        stmt = (
            select(User)
            .where(User.role == "employee")
        )
        result = await db.execute(stmt)
        employees = result.scalars().all()

        for emp in employees:
            # Check if they have a submission for this cycle
            stmt = select(GoalSheet).where(
                (GoalSheet.employee_id == emp.id) &
                (GoalSheet.cycle_id == cycle.id)
            )
            result = await db.execute(stmt)
            sheet = result.scalars().first()

            if not sheet or sheet.status in ["draft", "not_started"]:
                days_since = (datetime.now(timezone.utc) - cycle.opens_at).days
                overdue_submissions.append({
                    "employee_name": emp.name,
                    "department": emp.department,
                    "manager_name": emp.manager.name if emp.manager else "Unassigned",
                    "days_since_cycle_open": days_since,
                    "status": sheet.status if sheet else "not_started"
                })

        # Pending approvals
        stmt = select(GoalSheet).where(
            (GoalSheet.cycle_id == cycle.id) &
            (GoalSheet.status == "submitted")
        )
        stmt = stmt.options(selectinload(GoalSheet.employee))
        result = await db.execute(stmt)
        submitted_sheets = result.scalars().all()

        for sheet in submitted_sheets:
            days_pending = (datetime.now(timezone.utc) - sheet.submitted_at).days if sheet.submitted_at else 0
            if days_pending > 2:
                pending_approvals.append({
                    "employee_name": sheet.employee.name,
                    "manager_name": sheet.employee.manager.name if sheet.employee.manager else "Unassigned",
                    "days_pending": days_pending,
                    "submitted_at": sheet.submitted_at.isoformat() if sheet.submitted_at else None
                })

    return {
        "overdue_submissions": overdue_submissions,
        "pending_approvals": pending_approvals
    }