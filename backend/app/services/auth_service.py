from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.core.security import verify_password, create_access_token, create_refresh_token

class AuthService:

    @staticmethod
    async def authenticate_user(db: AsyncSession, email: str, password: str):
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user is None:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    @staticmethod
    def generate_tokens(user):
        token_data = {
            "sub": str(user.id),
            "role": user.role,
            "manager_id": str(user.manager_id) if user.manager_id else None
        }
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)
        return access_token, refresh_token
