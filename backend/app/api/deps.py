from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User, UserRole
from app.repositories.user_repo import UserRepository

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login")

DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    db: DbSession,
    token: Annotated[str, Depends(oauth2_scheme)],
) -> User:
    creds_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "access":
            raise creds_exc
        # New patient-portal tokens carry token_type="patient"; reject
        # them here so a stolen patient token can't access staff
        # endpoints. Old tokens without the claim default to "user".
        if payload.get("token_type", "user") != "user":
            raise creds_exc
        user_id = payload.get("sub")
        if user_id is None:
            raise creds_exc
    except JWTError as exc:
        raise creds_exc from exc

    user = await UserRepository(db).get(user_id)  # type: ignore[arg-type]
    if not user or not user.is_active:
        raise creds_exc
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: UserRole):
    async def dep(current: CurrentUser) -> User:
        if current.role not in roles and current.role != UserRole.admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current

    return dep


# ---------------------------------------------------------------- patient


from uuid import UUID  # noqa: E402

from app.models.patient import Patient  # noqa: E402


async def get_current_patient(
    db: DbSession,
    token: Annotated[str, Depends(oauth2_scheme)],
) -> Patient:
    """Resolve the patient behind a patient-portal JWT. Rejects tokens
    that don't carry token_type="patient" — even if they're otherwise
    valid — so staff tokens can't access patient endpoints.
    """
    creds_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        if payload.get("type") != "access":
            raise creds_exc
        if payload.get("token_type") != "patient":
            raise creds_exc
        patient_id = payload.get("sub")
    except JWTError as exc:
        raise creds_exc from exc
    if not patient_id:
        raise creds_exc

    patient = await db.get(Patient, UUID(patient_id))
    if patient is None or not patient.portal_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive portal account",
        )
    return patient


CurrentPatient = Annotated[Patient, Depends(get_current_patient)]


# ---------------------------------------------------------------- SSE token


async def get_user_from_token(
    db: DbSession,
    access_token: str,
) -> User:
    """JWT-from-query-param resolver for endpoints that browsers can't
    attach Bearer headers to (e.g. SSE via EventSource)."""
    creds_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    try:
        payload = jwt.decode(
            access_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        if payload.get("type") != "access":
            raise creds_exc
        if payload.get("token_type", "user") != "user":
            raise creds_exc
        user_id = payload.get("sub")
        if user_id is None:
            raise creds_exc
    except JWTError as exc:
        raise creds_exc from exc

    user = await UserRepository(db).get(user_id)
    if not user or not user.is_active:
        raise creds_exc
    return user
