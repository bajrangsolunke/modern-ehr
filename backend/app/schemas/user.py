from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.physician
    specialty: str | None = None
    avatar_url: str | None = None


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: UserRole | None = None
    specialty: str | None = None
    avatar_url: str | None = None
    is_active: bool | None = None


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    is_active: bool
    is_verified: bool


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
