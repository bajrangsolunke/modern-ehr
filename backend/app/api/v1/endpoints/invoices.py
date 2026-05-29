from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.invoice import InvoiceIssueIn, InvoiceOut
from app.services.invoice_service import InvoiceService


router = APIRouter(prefix="/billing/invoices", tags=["billing-invoices"])


@router.post("", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
async def issue_invoice(
    payload: InvoiceIssueIn, db: DbSession, current: CurrentUser
) -> InvoiceOut:
    return await InvoiceService(db).issue(payload, viewer_id=current.id)


@router.get("/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(
    invoice_id: UUID, db: DbSession, _current: CurrentUser
) -> InvoiceOut:
    return await InvoiceService(db).get(invoice_id)


@router.get("/by-patient/{patient_id}", response_model=list[InvoiceOut])
async def list_patient_invoices(
    patient_id: UUID, db: DbSession, _current: CurrentUser
) -> list[InvoiceOut]:
    return await InvoiceService(db).list_for_patient(patient_id)
