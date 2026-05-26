from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.repositories.user_repo import UserRepository
from app.schemas.user import UserCreate


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.users = UserRepository(db)

    async def register(self, payload: UserCreate) -> User:
        existing = await self.users.get_by_email(payload.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )
        user = User(
            email=payload.email,
            hashed_password=hash_password(payload.password),
            full_name=payload.full_name,
            role=payload.role,
            specialty=payload.specialty,
            avatar_url=payload.avatar_url,
        )
        return await self.users.add(user)

    async def authenticate(self, email: str, password: str) -> User:
        user = await self.users.get_by_email(email)
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="User disabled"
            )
        return user

    def issue_tokens(self, user: User) -> dict:
        return {
            "access_token": create_access_token(
                str(user.id), claims={"role": user.role.value}
            ),
            "refresh_token": create_refresh_token(str(user.id)),
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }
