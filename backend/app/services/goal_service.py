from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.goal_sheet import GoalSheet
from app.models.goal import Goal
from app.models.user import User
from app.schemas.goal import GoalCreate, GoalUpdate


class GoalService:
    """Service for managing goal sheets and goals."""

    @staticmethod
    async def create_goal_sheet(db: AsyncSession, employee_id: UUID, cycle_id: UUID) -> GoalSheet:
        """Create a new goal sheet for an employee in a cycle."""
        # Check if sheet already exists for this employee+cycle
        stmt = select(GoalSheet).where(
            (GoalSheet.employee_id == employee_id) & (GoalSheet.cycle_id == cycle_id)
        )
        result = await db.execute(stmt)
        existing = result.scalars().first()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Goal sheet already exists for this employee and cycle",
            )

        sheet = GoalSheet(employee_id=employee_id, cycle_id=cycle_id, status="draft")
        db.add(sheet)
        await db.commit()
        await db.refresh(sheet)
        return sheet

    @staticmethod
    async def add_goal(
        db: AsyncSession, goal_sheet_id: UUID, goal_data: GoalCreate, current_user
    ) -> Goal:
        """Add a goal to a goal sheet."""
        # Fetch sheet
        stmt = select(GoalSheet).where(GoalSheet.id == goal_sheet_id)
        result = await db.execute(stmt)
        sheet = result.scalars().first()

        if not sheet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal sheet not found",
            )

        # Verify ownership
        if sheet.employee_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource",
            )

        # Verify sheet status is editable
        if sheet.status not in ["draft", "returned"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Goal sheet is locked and cannot be modified",
            )

        # Check goal count
        stmt = select(Goal).where(Goal.goal_sheet_id == goal_sheet_id)
        result = await db.execute(stmt)
        goals = result.scalars().all()

        if len(goals) >= 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum 8 goals allowed per goal sheet",
            )

        # Create goal
        goal = Goal(
            goal_sheet_id=goal_sheet_id,
            thrust_area=goal_data.thrust_area,
            title=goal_data.title,
            description=goal_data.description,
            uom_type=goal_data.uom_type,
            target_value=goal_data.target_value,
            target_date=goal_data.target_date,
            weightage=goal_data.weightage,
        )
        db.add(goal)
        await db.commit()
        await db.refresh(goal)
        return goal

    @staticmethod
    async def update_goal(
        db: AsyncSession, goal_id: UUID, goal_data: GoalUpdate, current_user
    ) -> Goal:
        """Update a goal in a goal sheet."""
        # Fetch goal with sheet
        stmt = select(Goal).where(Goal.id == goal_id)
        stmt = stmt.options(selectinload(Goal.goal_sheet))
        result = await db.execute(stmt)
        goal = result.scalars().first()

        if not goal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal not found",
            )

        # Verify ownership of sheet
        if goal.goal_sheet.employee_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource",
            )

        # Verify sheet is editable
        if goal.goal_sheet.status not in ["draft", "returned"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Goal sheet is locked and cannot be modified",
            )

        # Update only provided fields
        if goal_data.thrust_area is not None:
            goal.thrust_area = goal_data.thrust_area
        if goal_data.title is not None:
            goal.title = goal_data.title
        if goal_data.description is not None:
            goal.description = goal_data.description
        if goal_data.uom_type is not None:
            goal.uom_type = goal_data.uom_type
        if goal_data.target_value is not None:
            goal.target_value = goal_data.target_value
        if goal_data.target_date is not None:
            goal.target_date = goal_data.target_date
        if goal_data.weightage is not None:
            goal.weightage = goal_data.weightage

        await db.commit()
        await db.refresh(goal)
        return goal

    @staticmethod
    async def delete_goal(db: AsyncSession, goal_id: UUID, current_user) -> None:
        """Delete a goal from a goal sheet."""
        # Fetch goal with sheet
        stmt = select(Goal).where(Goal.id == goal_id)
        stmt = stmt.options(selectinload(Goal.goal_sheet))
        result = await db.execute(stmt)
        goal = result.scalars().first()

        if not goal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal not found",
            )

        # Verify ownership
        if goal.goal_sheet.employee_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource",
            )

        # Verify sheet is not locked
        if goal.goal_sheet.status not in ["draft", "returned"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Goal sheet is locked and cannot be modified",
            )

        await db.delete(goal)
        await db.commit()

    @staticmethod
    async def submit_goal_sheet(
        db: AsyncSession, goal_sheet_id: UUID, current_user
    ) -> GoalSheet:
        """Submit a goal sheet for manager approval."""
        # Fetch sheet with goals
        stmt = select(GoalSheet).where(GoalSheet.id == goal_sheet_id)
        stmt = stmt.options(selectinload(GoalSheet.goals))
        result = await db.execute(stmt)
        sheet = result.scalars().first()

        if not sheet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal sheet not found",
            )

        # Verify ownership
        if sheet.employee_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource",
            )

        # Verify sheet is in draft or returned state
        if sheet.status not in ["draft", "returned"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Goal sheet is already submitted or approved",
            )

        goals = sheet.goals

        # Validate goal count
        if len(goals) < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least 1 goal is required",
            )
        if len(goals) > 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum 8 goals per sheet",
            )

        # Validate all goals have >= 10% weightage
        for goal in goals:
            if goal.weightage < 10.0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"All goals must have at least 10% weightage. Goal '{goal.title}' has {goal.weightage}%",
                )

        # Validate total weightage = 100%
        total_weightage = sum(goal.weightage for goal in goals)
        if abs(total_weightage - 100.0) > 0.01:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Total weightage must equal 100%, got {total_weightage:.2f}%",
            )

        # Update status and submitted_at
        sheet.status = "submitted"
        sheet.submitted_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(sheet)
        return sheet

    @staticmethod
    async def get_my_goal_sheets(db: AsyncSession, employee_id: UUID) -> list[GoalSheet]:
        """Get all goal sheets for an employee."""
        result = await db.execute(
            select(GoalSheet)
            .options(selectinload(GoalSheet.goals))
            .where(GoalSheet.employee_id == employee_id)
            .order_by(GoalSheet.created_at.desc())
        )
        return result.scalars().all()

    @staticmethod
    async def get_goal_sheet_by_id(
        db: AsyncSession, goal_sheet_id: UUID, current_user = None
    ) -> GoalSheet:
        """Get a goal sheet by ID with access control."""
        result = await db.execute(
            select(GoalSheet)
            .options(
                selectinload(GoalSheet.goals),
                selectinload(GoalSheet.employee)
            )
            .where(GoalSheet.id == goal_sheet_id)
        )
        sheet = result.scalar_one_or_none()

        if not sheet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal sheet not found",
            )

        # Access control: if current_user provided, check permissions
        if current_user:
            user_role = current_user.role

            # Employee can only view their own sheet
            if user_role == "employee" and sheet.employee_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have permission to access this resource",
                )

            # Manager can view their direct reports' sheets
            if user_role == "manager":
                stmt_user = select(User).where(User.id == current_user.id)
                result_user = await db.execute(stmt_user)
                manager = result_user.scalars().first()

                stmt_employee = select(User).where(User.id == sheet.employee_id)
                result_employee = await db.execute(stmt_employee)
                employee = result_employee.scalars().first()

                if not employee or employee.manager_id != manager.id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="You do not have permission to access this resource",
                    )

            # Admin can view any sheet (no restriction)

        return sheet
