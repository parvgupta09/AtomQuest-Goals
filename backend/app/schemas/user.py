from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from app.models.user import UserRole

class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: UserRole = UserRole.EMPLOYEE
    department: str | None = None
    manager_id: UUID | None = None

class UserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    password: str | None = None
    role: UserRole | None = None
    department: str | None = None
    manager_id: UUID | None = None

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: str
    role: UserRole
    department: str | None
    manager_id: UUID | None
    created_at: datetime
