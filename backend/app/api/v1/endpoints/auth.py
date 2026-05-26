from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import CurrentUser, DbSession
from app.schemas.common import Token
from app.schemas.user import LoginRequest, UserCreate, UserOut
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


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


@router.get("/me", response_model=UserOut)
async def me(current: CurrentUser) -> UserOut:
    return UserOut.model_validate(current)
