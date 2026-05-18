from uuid import UUID
from datetime import datetime, timezone, date
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
import math

from app.models.achievement import Achievement
from app.models.goal import Goal, UOMType
from app.models.goal_sheet import GoalSheet
from app.models.goal_cycle import GoalCycle
from app.schemas.achievement import AchievementCreate


class AchievementService:
    """Service for logging and tracking goal achievements."""

    @staticmethod
    def compute_progress_score(
        actual_value: float,
        target_value: float,
        actual_date: date,
        target_date: date,
        uom_type: UOMType,
    ) -> float:
        """Compute progress score based on UOM type and actual vs target values."""
        if uom_type == UOMType.NUMERIC_MIN:
            # Higher is better (e.g., Revenue)
            if target_value == 0:
                return 0.0
            score = actual_value / target_value
        elif uom_type == UOMType.NUMERIC_MAX:
            # Lower is better (e.g., Cost, TAT)
            # Score based on how close actual is to target (lower actual is better)
            if target_value == 0:
                return 1.0 if actual_value == 0 else 0.0
            score = actual_value / target_value
        elif uom_type == UOMType.TIMELINE:
            # Timeline goals are binary: either completed (1.0) or not (0.0)
            # actual_value = 1 means completed (progress 100%)
            # actual_value = 0 means not completed (progress 0%)
            score = 1.0 if actual_value >= 1 else 0.0
        elif uom_type == UOMType.ZERO:
            # Zero = success (e.g., Safety incidents)
            score = 1.0 if actual_value == 0 else 0.0
        else:
            score = 0.0

        # Cap score at 1.0
        return min(1.0, score)

    @staticmethod
    async def log_achievement(
        db: AsyncSession,
        achievement_data: AchievementCreate,
        employee_id: UUID,
    ) -> Achievement:
        """Log achievement for a goal in current phase."""
        # Fetch goal with sheet and cycle
        stmt = select(Goal).where(Goal.id == achievement_data.goal_id)
        stmt = stmt.options(
            selectinload(Goal.goal_sheet).selectinload(GoalSheet.cycle)
        )
        result = await db.execute(stmt)
        goal = result.scalars().first()

        if not goal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal not found",
            )

        # Verify employee owns the goal sheet
        if goal.goal_sheet.employee_id != employee_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to log achievement for this goal",
            )

        # Verify goal sheet is approved
        if goal.goal_sheet.status != "approved":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Goal sheet must be approved before logging achievements",
            )

        # Verify cycle phase allows check-ins (any non-goal_setting phase, or allow all for flexibility)
        # Note: we allow logging in any phase for demo purposes
        # Verify check-in window is open (timezone-safe comparison)
        now = datetime.now(timezone.utc)
        cycle = goal.goal_sheet.cycle
        opens = cycle.opens_at
        closes = cycle.closes_at
        # Make timezone-naive if DB stores without tz
        if opens.tzinfo is None:
            from datetime import timezone as tz
            opens = opens.replace(tzinfo=timezone.utc)
        if closes.tzinfo is None:
            closes = closes.replace(tzinfo=timezone.utc)

        if not (opens <= now <= closes):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Check-in window is currently closed (opens {opens.date()}, closes {closes.date()})",
            )

        # Verify that the cycle_phase being logged matches the active cycle's phase
        if achievement_data.cycle_phase != cycle.phase:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot log {achievement_data.cycle_phase} achievement during {cycle.phase} phase. Current active phase is {cycle.phase}.",
            )

        # Check if achievement already exists for this goal+phase
        stmt = select(Achievement).where(
            (Achievement.goal_id == achievement_data.goal_id) &
            (Achievement.cycle_phase == achievement_data.cycle_phase)
        )
        result = await db.execute(stmt)
        existing = result.scalars().first()

        if existing:
            # Update existing achievement
            existing.actual_value = achievement_data.actual_value
            existing.actual_date = achievement_data.actual_date
            existing.status = achievement_data.status
            existing.updated_at = datetime.now(timezone.utc)

            # Compute progress score if values provided
            if achievement_data.actual_value is not None and achievement_data.actual_date is not None:
                existing.progress_score = AchievementService.compute_progress_score(
                    achievement_data.actual_value,
                    goal.target_value,
                    achievement_data.actual_date,
                    goal.target_date,
                    goal.uom_type,
                )

            await db.commit()
            await db.refresh(existing)
            return existing
        else:
            # Create new achievement
            progress_score = None
            if achievement_data.actual_value is not None and achievement_data.actual_date is not None:
                progress_score = AchievementService.compute_progress_score(
                    achievement_data.actual_value,
                    goal.target_value,
                    achievement_data.actual_date,
                    goal.target_date,
                    goal.uom_type,
                )

            achievement = Achievement(
                goal_id=achievement_data.goal_id,
                goal_sheet_id=goal.goal_sheet_id,
                cycle_phase=achievement_data.cycle_phase,
                actual_value=achievement_data.actual_value,
                actual_date=achievement_data.actual_date,
                status=achievement_data.status,
                progress_score=progress_score,
                updated_at=datetime.now(timezone.utc),
            )
            db.add(achievement)
            await db.commit()
            await db.refresh(achievement)
            
            # If this is a shared goal, sync achievements to other employees with the same goal
            if goal.is_shared:
                await AchievementService._sync_shared_goal_achievements(
                    db, goal, achievement_data, progress_score
                )
            
            return achievement

    @staticmethod
    async def get_achievements_for_sheet(
        db: AsyncSession, goal_sheet_id: UUID
    ) -> list[Achievement]:
        """Get all achievements for a goal sheet, grouped by goal."""
        stmt = select(Achievement).where(Achievement.goal_sheet_id == goal_sheet_id)
        stmt = stmt.options(selectinload(Achievement.goal))
        stmt = stmt.order_by(Achievement.goal_id, Achievement.cycle_phase)
        result = await db.execute(stmt)
        return result.scalars().all()

    @staticmethod
    async def update_achievement(
        db: AsyncSession,
        achievement_id: UUID,
        actual_value: float,
        actual_date: date,
        status: str,
        employee_id: UUID,
    ) -> Achievement:
        """Update an existing achievement record."""
        stmt = select(Achievement).where(Achievement.id == achievement_id)
        stmt = stmt.options(
            selectinload(Achievement.goal_sheet),
            selectinload(Achievement.goal),
        )
        result = await db.execute(stmt)
        achievement = result.scalars().first()

        if not achievement:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Achievement not found",
            )

        # Verify employee owns the goal sheet
        if achievement.goal_sheet.employee_id != employee_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to update this achievement",
            )

        # Update fields
        achievement.actual_value = actual_value
        achievement.actual_date = actual_date
        achievement.status = status
        achievement.updated_at = datetime.now(timezone.utc)

        # Recompute progress score
        if actual_value is not None and actual_date is not None:
            achievement.progress_score = AchievementService.compute_progress_score(
                actual_value,
                achievement.goal.target_value,
                actual_date,
                achievement.goal.target_date,
                achievement.goal.uom_type,
            )

        await db.commit()
        await db.refresh(achievement)
        
        # If this is a shared goal, sync the update to other employees
        if achievement.goal.is_shared:
            await AchievementService._sync_shared_goal_achievements(
                db,
                achievement.goal,
                AchievementCreate(
                    goal_id=achievement.goal_id,
                    cycle_phase=achievement.cycle_phase,
                    actual_value=actual_value,
                    actual_date=actual_date,
                    status=status,
                ),
                achievement.progress_score,
            )
        
        return achievement

    @staticmethod
    async def _sync_shared_goal_achievements(
        db: AsyncSession,
        goal: Goal,
        achievement_data: AchievementCreate,
        progress_score: float | None,
    ) -> None:
        """Sync achievement to other employees who have the same shared goal."""
        # Find all goals with same title, thrust_area, target_value, and shared_by
        # (they're the "same" shared goal pushed to different employees)
        # Also ensure they're in the SAME cycle
        stmt = select(Goal).join(
            GoalSheet, Goal.goal_sheet_id == GoalSheet.id
        ).where(
            (Goal.title == goal.title) &
            (Goal.thrust_area == goal.thrust_area) &
            (Goal.target_value == goal.target_value) &
            (Goal.shared_by == goal.shared_by) &
            (Goal.is_shared == True) &
            (Goal.id != goal.id) &
            (GoalSheet.cycle_id == goal.goal_sheet.cycle_id)  # Same cycle!
        ).options(selectinload(Goal.goal_sheet))
        
        result = await db.execute(stmt)
        other_shared_goals = result.scalars().all()
        
        # Log sync action for debugging
        print(f"[SYNC] Found {len(other_shared_goals)} employees to sync achievement for '{goal.title}' (actual_value={achievement_data.actual_value})")
        
        # For each other employee's shared goal, create/update their achievement
        for other_goal in other_shared_goals:
            # Check if achievement already exists
            stmt = select(Achievement).where(
                (Achievement.goal_id == other_goal.id) &
                (Achievement.cycle_phase == achievement_data.cycle_phase)
            )
            result = await db.execute(stmt)
            existing = result.scalars().first()
            
            if existing:
                # Update existing
                old_value = existing.actual_value
                existing.actual_value = achievement_data.actual_value
                existing.actual_date = achievement_data.actual_date
                existing.status = achievement_data.status
                existing.progress_score = progress_score
                existing.updated_at = datetime.now(timezone.utc)
                print(f"[SYNC] Updated achievement for goal {other_goal.id}: {old_value} -> {achievement_data.actual_value}")
            else:
                # Create new
                new_achievement = Achievement(
                    goal_id=other_goal.id,
                    goal_sheet_id=other_goal.goal_sheet_id,
                    cycle_phase=achievement_data.cycle_phase,
                    actual_value=achievement_data.actual_value,
                    actual_date=achievement_data.actual_date,
                    status=achievement_data.status,
                    progress_score=progress_score,
                    updated_at=datetime.now(timezone.utc),
                )
                db.add(new_achievement)
                print(f"[SYNC] Created new achievement for goal {other_goal.id} with value {achievement_data.actual_value}")
        
        await db.commit()
        print(f"[SYNC] Sync complete for goal '{goal.title}'")
