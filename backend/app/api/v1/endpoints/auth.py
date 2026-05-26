from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

from app.api.deps import CurrentUser, DbSession
from app.schemas.common import Token
from app.schemas.user import LoginRequest, UserCreate, UserOut
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, db: DbSession) -> UserOut:
    user = await AuthService(db).register(payload)
    return UserOut.model_validate(user)


@router.post("/login", response_model=Token)
async def login(
    db: DbSession,
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> Token:
    service = AuthService(db)
    user = await service.authenticate(form_data.username, form_data.password)
    return Token(**service.issue_tokens(user))


@router.post("/login/json", response_model=Token)
async def login_json(payload: LoginRequest, db: DbSession) -> Token:
    service = AuthService(db)
    user = await service.authenticate(payload.email, payload.password)
    return Token(**service.issue_tokens(user))


@router.post("/refresh", response_model=Token)
async def refresh(payload: RefreshRequest, db: DbSession) -> Token:
    """Exchange a valid refresh token for a fresh access + refresh token pair."""
    from jose import JWTError, jwt
    from fastapi import HTTPException, status as http_status

    from app.core.config import settings
    from app.repositories.user_repo import UserRepository

    try:
        decoded = jwt.decode(
            payload.refresh_token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        if decoded.get("type") != "refresh":
            raise HTTPException(
                status_code=http_status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )
        user_id = decoded.get("sub")
    except JWTError as exc:
        raise HTTPException(
            status_code=http_status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        ) from exc

    user = await UserRepository(db).get(user_id)  # type: ignore[arg-type]
    if not user or not user.is_active:
        raise HTTPException(
            status_code=http_status.HTTP_401_UNAUTHORIZED,
            detail="User disabled or not found",
        )

    service = AuthService(db)
    return Token(**service.issue_tokens(user))


@router.get("/me", response_model=UserOut)
async def me(current: CurrentUser) -> UserOut:
    return UserOut.model_validate(current)
