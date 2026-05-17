from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_role

router = APIRouter(prefix="/reports")

@router.get("/achievement")
async def get_achievement_report(
    current_user = Depends(require_role("manager", "admin")),
    db: AsyncSession = Depends(get_db),
    export_format: str = None
):
    """Get full achievement report, supports CSV/Excel export (Manager + Admin only)."""
    # TODO: Implement get achievement report
    pass

@router.get("/completion")
async def get_completion_report(
    current_user = Depends(require_role("manager", "admin")),
    db: AsyncSession = Depends(get_db)
):
    """Get completion rates - who has and hasn't completed check-ins (Manager + Admin only)."""
    # TODO: Implement get completion report
    pass

@router.get("/audit-log")
async def get_audit_log(
    current_user = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """Get full audit trail of all post-lock changes (Admin only)."""
    # TODO: Implement get audit log
    pass
