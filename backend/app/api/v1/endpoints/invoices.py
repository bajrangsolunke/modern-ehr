from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.models.charge import Charge
from app.models.invoice import Invoice as InvoiceModel
from app.models.patient import Patient
from app.models.payment import Payment
from app.schemas.invoice import InvoiceIssueIn, InvoiceOut
from app.services.invoice_service import InvoiceService
from app.services.receipt_pdf_service import render_receipt


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


@router.get("/{invoice_id}/receipt.pdf")
async def receipt_pdf(
    invoice_id: UUID, db: DbSession, _current: CurrentUser
) -> Response:
    inv = await db.get(InvoiceModel, invoice_id)
    if inv is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found"
        )
    charges = (
        await db.execute(select(Charge).where(Charge.invoice_id == invoice_id))
    ).scalars().all()
    payments = (
        await db.execute(
            select(Payment).where(Payment.invoice_id == invoice_id)
        )
    ).scalars().all()
    patient = await db.get(Patient, inv.patient_id)
    patient_name = (
        f"{patient.first_name} {patient.last_name}".strip()
        if patient
        else "Patient"
    )
    pdf = render_receipt(
        inv, charges, payments, patient_name=patient_name
    )
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'inline; filename="receipt-{inv.number}.pdf"'
            ),
        },
    )
