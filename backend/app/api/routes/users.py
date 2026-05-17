from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_role
from app.services import UserService
from app.schemas.user import UserCreate, UserUpdate, UserResponse

router = APIRouter(prefix="/users")

@router.get("")
async def list_users(
    current_user: dict = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
) -> list[UserResponse]:
    """List all users (Admin only)."""
    from sqlalchemy import select
    from app.models import User

    stmt = select(User)
    result = await db.execute(stmt)
    users = result.scalars().all()
    return users

@router.post("", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    current_user: dict = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """Create a new user (Admin only)."""
    user = await UserService.create_user(db, user_data)
    return user

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    current_user: dict = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """Get user by ID (Admin only)."""
    user = await UserService.get_user_by_id(db, user_id)
    return user

@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    current_user: dict = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """Update user (Admin only)."""
    user = await UserService.update_user(db, user_id, user_data)
    return user

@router.get("/{user_id}/direct-reports", response_model=list[UserResponse])
async def get_direct_reports(
    user_id: UUID,
    current_user: dict = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """Get direct reports of a manager (Admin only)."""
    reports = await UserService.get_direct_reports(db, user_id)
    return reports
