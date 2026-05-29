"""Patient portal auth endpoints. See spec
docs/superpowers/specs/2026-05-28-patient-portal-foundation-design.md
for the flow."""
from fastapi import APIRouter, Request, status

from app.api.deps import DbSession
from app.core.rate_limit import limiter
from app.schemas.patient_auth import (
    LoginIn,
    RefreshIn,
    RequestResetIn,
    ResetIn,
    SetupIn,
    SetupVerifyIn,
    SetupVerifyOut,
    TokensOut,
)
from app.services.audit_service import AuditService
from app.services.patient_auth_service import PatientAuthService


router = APIRouter(prefix="/patient-auth", tags=["patient-auth"])


@router.post("/setup-verify", response_model=SetupVerifyOut)
@limiter.limit("30/minute")
async def setup_verify(
    request: Request, payload: SetupVerifyIn, db: DbSession
) -> SetupVerifyOut:
    first_name, masked_email = await PatientAuthService(db).verify_setup_token(
        payload.token
    )
    return SetupVerifyOut(first_name=first_name, masked_email=masked_email)


@router.post(
    "/setup",
    response_model=TokensOut,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/minute")
async def setup(
    request: Request, payload: SetupIn, db: DbSession
) -> TokensOut:
    tokens = await PatientAuthService(db).setup(
        token=payload.token, password=payload.password
    )
    await AuditService(db).record_request(
        request,
        user_id=None,
        action="patient.setup",
        resource_type="patient",
        resource_id=None,
    )
    return tokens


@router.post("/login", response_model=TokensOut)
@limiter.limit("10/minute")
async def login(
    request: Request, payload: LoginIn, db: DbSession
) -> TokensOut:
    try:
        tokens = await PatientAuthService(db).login(
            email=payload.email, password=payload.password
        )
    except Exception:
        await AuditService(db).record_request(
            request,
            user_id=None,
            action="patient.login_failed",
            resource_type="patient",
            resource_id=None,
            payload={"email": payload.email},
        )
        raise
    await AuditService(db).record_request(
        request,
        user_id=None,
        action="patient.login",
        resource_type="patient",
        resource_id=None,
        payload={"email": payload.email},
    )
    return tokens


@router.post("/refresh", response_model=TokensOut)
@limiter.limit("30/minute")
async def refresh(
    request: Request, payload: RefreshIn, db: DbSession
) -> TokensOut:
    return await PatientAuthService(db).refresh(
        refresh_token=payload.refresh_token
    )


@router.post(
    "/request-reset",
    status_code=status.HTTP_204_NO_CONTENT,
)
@limiter.limit("5/minute")
async def request_reset(
    request: Request, payload: RequestResetIn, db: DbSession
) -> None:
    await PatientAuthService(db).request_reset(email=payload.email)
    await AuditService(db).record_request(
        request,
        user_id=None,
        action="patient.password_reset_requested",
        resource_type="patient",
        resource_id=None,
        payload={"email": payload.email},
    )


@router.post("/reset", response_model=TokensOut)
@limiter.limit("10/minute")
async def reset(
    request: Request, payload: ResetIn, db: DbSession
) -> TokensOut:
    tokens = await PatientAuthService(db).reset(
        token=payload.token, password=payload.password
    )
    await AuditService(db).record_request(
        request,
        user_id=None,
        action="patient.password_reset",
        resource_type="patient",
        resource_id=None,
    )
    return tokens
