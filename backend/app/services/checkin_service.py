from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.checkin_comment import CheckinComment
from app.models.goal_sheet import GoalSheet
from app.schemas.checkin import CheckinCreate


class CheckinService:
    """Service for managing check-in comments during goal reviews."""

    @staticmethod
    async def add_checkin_comment(
        db: AsyncSession,
        checkin_data: CheckinCreate,
        manager_id: UUID,
    ) -> CheckinComment:
        """Add a check-in comment from a manager on a goal sheet."""
        # Verify goal sheet exists
        stmt = select(GoalSheet).where(GoalSheet.id == checkin_data.goal_sheet_id)
        stmt = stmt.options(selectinload(GoalSheet.employee))
        result = await db.execute(stmt)
        sheet = result.scalars().first()

        if not sheet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal sheet not found",
            )

        # Verify manager permission (employee's manager)
        if sheet.employee.manager_id != manager_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to add check-ins for this goal sheet",
            )

        # Create check-in comment
        checkin = CheckinComment(
            goal_sheet_id=checkin_data.goal_sheet_id,
            manager_id=manager_id,
            phase=checkin_data.phase,
            comment=checkin_data.comment,
            created_at=datetime.now(timezone.utc),
        )
        db.add(checkin)
        await db.commit()
        await db.refresh(checkin)
        return checkin

    @staticmethod
    async def get_checkins_for_sheet(
        db: AsyncSession,
        goal_sheet_id: UUID,
    ) -> list[CheckinComment]:
        """Get all check-in comments for a goal sheet."""
        stmt = select(CheckinComment).where(CheckinComment.goal_sheet_id == goal_sheet_id)
        stmt = stmt.options(selectinload(CheckinComment.manager))
        stmt = stmt.order_by(CheckinComment.created_at.desc())
        result = await db.execute(stmt)
        return result.scalars().all()
