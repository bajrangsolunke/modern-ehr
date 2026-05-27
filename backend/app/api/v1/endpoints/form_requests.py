"""
Form requests endpoints — US-FORM-1..8
(docs/superpowers/specs/2026-05-27-workflow-user-stories.md).
"""
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status

from app.api.deps import CurrentUser, DbSession, require_roles
from app.models.form_request import FormRequestStatus, FormType
from app.models.user import UserRole
from app.schemas.common import Page
from app.schemas.form_request import (
    FormRequestCreate,
    FormRequestOut,
    FormRequestReview,
    FormRequestSubmit,
    FormStatusLiteral,
    FormTypeLiteral,
)
from app.services.audit_service import AuditService
from app.services.form_request_service import FormRequestService

# Requesting + reviewing forms is gated to clinical staff (providers
# + admins). Submitting is open to any signed-in user — staff or the
# patient (via a future portal) both write through the same path.
clinical_writer = Depends(require_roles(UserRole.provider, UserRole.admin))


router = APIRouter(prefix="/form-requests", tags=["form-requests"])


@router.get("", response_model=Page[FormRequestOut])
async def list_form_requests(
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001 — auth gate
    q: str | None = Query(None, description="Search notes"),
    form_type: FormTypeLiteral | None = None,
    status_filter: FormStatusLiteral | None = Query(None, alias="status"),
    patient_id: UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
) -> Page[FormRequestOut]:
    items, total, pages = await FormRequestService(db).list(
        q=q,
        form_type=FormType(form_type) if form_type else None,
        status_filter=FormRequestStatus(status_filter) if status_filter else None,
        patient_id=patient_id,
        page=page,
        page_size=page_size,
    )
    return Page[FormRequestOut](
        items=items, total=total, page=page, page_size=page_size, pages=pages
    )


@router.get("/{form_id}", response_model=FormRequestOut)
async def get_form_request(
    form_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
) -> FormRequestOut:
    return await FormRequestService(db).get_projected(form_id)


@router.post(
    "",
    response_model=FormRequestOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[clinical_writer],
)
async def request_form(
    request: Request,
    payload: FormRequestCreate,
    db: DbSession,
    current: CurrentUser,
) -> FormRequestOut:
    out = await FormRequestService(db).request_form(
        viewer_id=current.id, payload=payload
    )
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="form.request",
        resource_type="form_request",
        resource_id=str(out.id),
        payload=payload.model_dump(),
    )
    return out


@router.post("/{form_id}/submit", response_model=FormRequestOut)
async def submit_form(
    form_id: UUID,
    request: Request,
    payload: FormRequestSubmit,
    db: DbSession,
    current: CurrentUser,
) -> FormRequestOut:
    out = await FormRequestService(db).submit(
        form_id, viewer_id=current.id, payload=payload
    )
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="form.submit",
        resource_type="form_request",
        resource_id=str(form_id),
    )
    return out


@router.post(
    "/{form_id}/review",
    response_model=FormRequestOut,
    dependencies=[clinical_writer],
)
async def review_form(
    form_id: UUID,
    request: Request,
    payload: FormRequestReview,
    db: DbSession,
    current: CurrentUser,
) -> FormRequestOut:
    out = await FormRequestService(db).review(
        form_id, viewer_id=current.id, payload=payload
    )
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action=f"form.{payload.decision}",
        resource_type="form_request",
        resource_id=str(form_id),
        payload=payload.model_dump(),
    )
    return out


@router.delete(
    "/{form_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[clinical_writer],
)
async def delete_form_request(
    form_id: UUID,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> None:
    await FormRequestService(db).delete(form_id)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="form.delete",
        resource_type="form_request",
        resource_id=str(form_id),
    )
