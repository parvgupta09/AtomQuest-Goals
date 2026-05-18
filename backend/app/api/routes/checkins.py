from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.services.checkin_service import CheckinService
from app.schemas.checkin import CheckinCreate, CheckinResponse

router = APIRouter(prefix="/checkins")


@router.post("", response_model=CheckinResponse, status_code=201)
async def create_checkin(
    checkin_data: CheckinCreate,
    current_user = Depends(require_role("manager", "admin")),
    db: AsyncSession = Depends(get_db)
):
    """Manager posts a check-in comment (Manager + Admin only)."""
    checkin = await CheckinService.add_checkin_comment(db, checkin_data, current_user.id)
    return checkin


@router.get("/{goal_sheet_id}", response_model=list[CheckinResponse])
async def get_checkins(
    goal_sheet_id: UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """View all check-ins for a goal sheet (Manager, Admin, Employee)."""
    checkins = await CheckinService.get_checkins_for_sheet(db, goal_sheet_id)
    return checkins
