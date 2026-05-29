from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

from app.api.deps import CurrentUser, DbSession, require_roles
from app.core.security import hash_password, verify_password
from app.core.rate_limit import limiter
from app.models.user import UserRole
from app.schemas.common import Token
from app.schemas.user import (
    LoginRequest,
    PasswordChange,
    SelfUpdate,
    UserCreate,
    UserOut,
    UserSetupInfoResponse,
    UserSetupRequest,
)
from app.services.audit_service import AuditService
from app.services.auth_service import AuthService
from app.services.user_invite_service import UserInviteService

router = APIRouter(prefix="/auth", tags=["auth"])

admin_only = Depends(require_roles(UserRole.admin))


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[admin_only],
)
async def register(
    payload: UserCreate,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> UserOut:
    """
    Admin-only account create. This shadow of /users exists for
    service-to-service onboarding scripts; production user
    management runs through /users with the same RBAC.
    """
    user = await AuthService(db).register(payload)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="user.create_via_register",
        resource_type="user",
        resource_id=str(user.id),
        payload={"email": user.email, "role": user.role.value},
    )
    return UserOut.model_validate(user)


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login(
    request: Request,
    db: DbSession,
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> Token:
    service = AuthService(db)
    user = await service.authenticate(form_data.username, form_data.password)
    return Token(**service.issue_tokens(user))


@router.post("/login/json", response_model=Token)
@limiter.limit("10/minute")
async def login_json(
    request: Request, payload: LoginRequest, db: DbSession
) -> Token:
    service = AuthService(db)
    user = await service.authenticate(payload.email, payload.password)
    return Token(**service.issue_tokens(user))


@router.post("/refresh", response_model=Token)
@limiter.limit("30/minute")
async def refresh(
    request: Request, payload: RefreshRequest, db: DbSession
) -> Token:
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


@router.patch("/me", response_model=UserOut)
async def update_me(
    payload: SelfUpdate,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> UserOut:
    """Let a user update their own profile bits (name, specialty, avatar)."""
    changes = payload.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(current, k, v)
    await db.flush()
    await db.refresh(current)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="user.self_update",
        resource_type="user",
        resource_id=str(current.id),
        payload=changes,
    )
    return UserOut.model_validate(current)


@router.get("/setup-info", response_model=UserSetupInfoResponse)
@limiter.limit("30/minute")
async def user_setup_info(
    request: Request,
    token: str,
    db: DbSession,
) -> UserSetupInfoResponse:
    """Unauthenticated endpoint: returns display info for the staff
    account-setup page. The token IS the auth — no bearer header needed."""
    info = await UserInviteService(db).get_setup_info(token)
    return UserSetupInfoResponse(**info)


@router.post("/setup", response_model=Token, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def user_setup(
    request: Request,
    payload: UserSetupRequest,
    db: DbSession,
) -> Token:
    """Complete staff account setup. Validates the one-time token,
    stores the hashed password, and returns fresh auth tokens."""
    tokens = await UserInviteService(db).complete_setup(
        token=payload.token, password=payload.password
    )
    await AuditService(db).record_request(
        request,
        user_id=None,
        action="user.setup_complete",
        resource_type="user",
        resource_id=None,
    )
    return tokens


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: PasswordChange,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> None:
    """Change the signed-in user's password (requires current password)."""
    if not current.hashed_password or not verify_password(payload.current_password, current.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    current.hashed_password = hash_password(payload.new_password)
    await db.flush()
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="user.password_change",
        resource_type="user",
        resource_id=str(current.id),
        payload={"password": "<rotated>"},
    )
