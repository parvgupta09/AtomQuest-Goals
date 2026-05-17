from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status

from app.models import User, UserRole
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import hash_password

class UserService:
    @staticmethod
    async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
        """Get user by email address."""
        stmt = select(User).where(User.email == email)
        result = await db.execute(stmt)
        return result.scalars().first()

    @staticmethod
    async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User:
        """Get user by ID or raise 404."""
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        user = result.scalars().first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        return user

    @staticmethod
    async def create_user(db: AsyncSession, user_data: UserCreate) -> User:
        """Create a new user."""
        # Check if email already exists
        existing_user = await UserService.get_user_by_email(db, user_data.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

        # Hash password
        hashed_password = hash_password(user_data.password)

        # Create user
        user = User(
            name=user_data.name,
            email=user_data.email,
            hashed_password=hashed_password,
            role=user_data.role,
            manager_id=user_data.manager_id,
            department=user_data.department,
        )

        db.add(user)
        await db.commit()
        await db.refresh(user)

        return user

    @staticmethod
    async def get_direct_reports(db: AsyncSession, manager_id: UUID) -> list[User]:
        """Get all direct reports for a manager."""
        stmt = select(User).where(User.manager_id == manager_id)
        result = await db.execute(stmt)
        return result.scalars().all()

    @staticmethod
    async def update_user(db: AsyncSession, user_id: UUID, user_data: UserUpdate) -> User:
        """Update user details."""
        user = await UserService.get_user_by_id(db, user_id)

        # Update fields if provided
        if user_data.name is not None:
            user.name = user_data.name
        if user_data.email is not None:
            # Check if new email is already in use
            if user_data.email != user.email:
                existing = await UserService.get_user_by_email(db, user_data.email)
                if existing:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Email already in use",
                    )
            user.email = user_data.email
        if user_data.password is not None:
            user.hashed_password = hash_password(user_data.password)
        if user_data.role is not None:
            user.role = user_data.role
        if user_data.department is not None:
            user.department = user_data.department
        if user_data.manager_id is not None:
            user.manager_id = user_data.manager_id

        await db.commit()
        await db.refresh(user)

        return user
