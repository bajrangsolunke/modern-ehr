from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    role: UserRole = UserRole.provider
    specialty: str | None = Field(default=None, max_length=255)
    avatar_url: str | None = Field(default=None, max_length=2_000_000)


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserUpdate(BaseModel):
    """
    Patch shape — every field optional. Email is intentionally NOT here
    because it's the durable user identifier and changing it would orphan
    audit trails.
    """

    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    role: UserRole | None = None
    specialty: str | None = Field(default=None, max_length=255)
    avatar_url: str | None = Field(default=None, max_length=2_000_000)
    is_active: bool | None = None
    # Optional; admins can reset a user's password from the users page.
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SelfUpdate(BaseModel):
    """
    What a non-admin user can change about their own account.
    Email and role are intentionally absent — those route through
    admin user management.
    """

    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    specialty: str | None = Field(default=None, max_length=255)
    avatar_url: str | None = Field(default=None, max_length=2_000_000)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)
