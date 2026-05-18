from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.services.achievement_service import AchievementService
from app.schemas.achievement import AchievementCreate, AchievementResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/achievements")


@router.post("", response_model=AchievementResponse, status_code=201)
async def log_achievement(
    achievement_data: AchievementCreate,
    current_user = Depends(require_role("employee")),
    db: AsyncSession = Depends(get_db)
):
    """Log achievement for a goal in current phase (Employee only)."""
    logger.info(f"Achievement request from {current_user.id}: {achievement_data}")
    achievement = await AchievementService.log_achievement(db, achievement_data, current_user.id)
    return achievement


@router.patch("/{achievement_id}", response_model=AchievementResponse)
async def update_achievement(
    achievement_id: UUID,
    actual_value: float,
    actual_date: str,
    status: str,
    current_user = Depends(require_role("employee")),
    db: AsyncSession = Depends(get_db)
):
    """Update achievement record."""
    from datetime import datetime
    actual_date_obj = datetime.strptime(actual_date, "%Y-%m-%d").date()
    achievement = await AchievementService.update_achievement(
        db, achievement_id, actual_value, actual_date_obj, status, current_user.id
    )
    return achievement


@router.get("/goal-sheets/{goal_sheet_id}/achievements", response_model=list[AchievementResponse])
async def get_achievements_for_sheet(
    goal_sheet_id: UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """View all achievements for a goal sheet (Employee, Manager, Admin)."""
    achievements = await AchievementService.get_achievements_for_sheet(db, goal_sheet_id)
    return achievements
