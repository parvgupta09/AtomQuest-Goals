from uuid import UUID
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import require_role, get_current_user
from app.services import UserService
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.models.user import User

router = APIRouter(prefix="/users")


@router.get("/me", response_model=UserResponse)
async def get_my_profile(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's own profile (all roles)."""
    stmt = select(User).where(User.id == current_user.id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


@router.patch("/me/password")
async def change_my_password(
    data: PasswordChangeRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change own password (all roles)."""
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    stmt = select(User).where(User.id == current_user.id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not pwd_context.verify(data.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    user.hashed_password = pwd_context.hash(data.new_password)
    await db.commit()
    return {"message": "Password changed successfully"}


@router.get("", response_model=list[UserResponse])
async def list_users(
    current_user: dict = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
) -> list[UserResponse]:
    """List all users (Admin only)."""
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
