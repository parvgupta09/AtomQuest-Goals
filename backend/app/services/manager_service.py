from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.goal_sheet import GoalSheet
from app.models.goal import Goal
from app.models.user import User
from app.schemas.goal import GoalUpdate


class ManagerService:
    """Service for manager approval workflows."""

    @staticmethod
    async def get_team_goal_sheets(db: AsyncSession, manager_id: UUID):
        """Get all goal sheets and pending approvals from direct reports of a manager.

        Returns a structured response with:
        - pending: list of sheets with status="submitted"
        - all: list of all sheets
        - pending_count: number of submitted sheets
        - approved_count: number of approved sheets
        """
        # Get all direct reports
        stmt = select(User).where(User.manager_id == manager_id)
        result = await db.execute(stmt)
        direct_reports = result.scalars().all()
        direct_report_ids = [user.id for user in direct_reports]

        if not direct_report_ids:
            return {
                "pending": [],
                "all": [],
                "pending_count": 0,
                "approved_count": 0,
            }

        # Get ALL goal sheets for these employees
        stmt = select(GoalSheet).where(
            GoalSheet.employee_id.in_(direct_report_ids)
        )
        stmt = stmt.options(
            selectinload(GoalSheet.goals),
            selectinload(GoalSheet.employee)
        )
        stmt = stmt.order_by(GoalSheet.submitted_at.desc())
        result = await db.execute(stmt)
        all_sheets = result.scalars().all()

        # Build response with employee info and goals count
        def sheet_to_dict(sheet: GoalSheet):
            return {
                "id": str(sheet.id),
                "employee_id": str(sheet.employee_id),
                "employee_name": sheet.employee.name,
                "employee_department": sheet.employee.department,
                "cycle_id": str(sheet.cycle_id),
                "status": sheet.status,
                "submitted_at": sheet.submitted_at.isoformat() if sheet.submitted_at else None,
                "approved_at": sheet.approved_at.isoformat() if sheet.approved_at else None,
                "goals_count": len(sheet.goals) if sheet.goals else 0,
                "goals": [
                    {
                        "id": str(goal.id),
                        "title": goal.title,
                        "thrust_area": goal.thrust_area,
                        "description": goal.description,
                        "uom_type": goal.uom_type,
                        "target_value": goal.target_value,
                        "target_date": goal.target_date.isoformat() if goal.target_date else None,
                        "weightage": goal.weightage,
                        "is_locked": goal.is_locked,
                    }
                    for goal in (sheet.goals or [])
                ],
            }

        # Separate pending (submitted) and all sheets
        pending_sheets = [sheet_to_dict(s) for s in all_sheets if s.status == "submitted"]
        all_sheets_dicts = [sheet_to_dict(s) for s in all_sheets]

        return {
            "pending": pending_sheets,
            "all": all_sheets_dicts,
            "pending_count": len(pending_sheets),
            "approved_count": len([s for s in all_sheets if s.status == "approved"]),
        }

    @staticmethod
    async def approve_goal_sheet(
        db: AsyncSession, goal_sheet_id: UUID, manager_id: UUID
    ) -> GoalSheet:
        """Approve a goal sheet and lock all its goals."""
        # Fetch sheet with goals
        stmt = select(GoalSheet).where(GoalSheet.id == goal_sheet_id)
        stmt = stmt.options(selectinload(GoalSheet.goals), selectinload(GoalSheet.employee))
        result = await db.execute(stmt)
        sheet = result.scalars().first()

        if not sheet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal sheet not found",
            )

        # Verify manager has permission (employee's manager)
        if sheet.employee.manager_id != manager_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to approve this goal sheet",
            )

        # Verify sheet is in submitted state
        if sheet.status != "submitted":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Goal sheet is in '{sheet.status}' state, cannot approve",
            )

        # Update sheet status and approval metadata in single transaction
        sheet.status = "approved"
        sheet.approved_at = datetime.now(timezone.utc)
        sheet.approved_by = manager_id

        # Lock all goals in the sheet
        for goal in sheet.goals:
            goal.is_locked = True

        await db.commit()
        await db.refresh(sheet)
        return sheet

    @staticmethod
    async def return_goal_sheet(
        db: AsyncSession,
        goal_sheet_id: UUID,
        manager_id: UUID,
        comment: str
    ) -> GoalSheet:
        """Return a goal sheet for rework and add a check-in comment."""
        # Fetch sheet
        stmt = select(GoalSheet).where(GoalSheet.id == goal_sheet_id)
        stmt = stmt.options(selectinload(GoalSheet.employee))
        result = await db.execute(stmt)
        sheet = result.scalars().first()

        if not sheet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal sheet not found",
            )

        # Verify manager has permission
        if sheet.employee.manager_id != manager_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to return this goal sheet",
            )

        # Verify sheet is in submitted state
        if sheet.status != "submitted":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Goal sheet is in '{sheet.status}' state, cannot return",
            )

        # Update sheet status
        sheet.status = "returned"

        # Add checkin comment (using CheckinComment model)
        from app.models.checkin_comment import CheckinComment
        checkin = CheckinComment(
            goal_sheet_id=goal_sheet_id,
            manager_id=manager_id,
            phase="goal_setting",
            comment=comment,
            created_at=datetime.now(timezone.utc),
        )
        db.add(checkin)
        await db.commit()
        await db.refresh(sheet)
        return sheet

    @staticmethod
    async def inline_edit_goal(
        db: AsyncSession,
        goal_sheet_id: UUID,
        goal_id: UUID,
        goal_data: GoalUpdate,
        manager_id: UUID,
    ) -> Goal:
        """Edit a goal during manager review (only target_value and weightage)."""
        # Fetch sheet and goal
        stmt = select(Goal).where(Goal.id == goal_id)
        stmt = stmt.options(selectinload(Goal.goal_sheet).selectinload(GoalSheet.employee))
        result = await db.execute(stmt)
        goal = result.scalars().first()

        if not goal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal not found",
            )

        # Verify sheet matches
        if goal.goal_sheet_id != goal_sheet_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Goal does not belong to this goal sheet",
            )

        # Verify manager permission
        if goal.goal_sheet.employee.manager_id != manager_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to edit this goal",
            )

        # Verify sheet is in submitted state
        if goal.goal_sheet.status != "submitted":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Goal can only be edited when sheet is submitted",
            )

        # Only allow target_value and weightage edits
        if goal_data.target_value is not None:
            goal.target_value = goal_data.target_value
        if goal_data.weightage is not None:
            goal.weightage = goal_data.weightage

        # Prevent editing of other fields
        if goal_data.title is not None or goal_data.description is not None or \
           goal_data.thrust_area is not None or goal_data.uom_type is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Managers can only edit target_value and weightage",
            )

        await db.commit()
        await db.refresh(goal)
        return goal
