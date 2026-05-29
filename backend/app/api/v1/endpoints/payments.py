from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.payment import (
    CashPaymentIn,
    PaymentOut,
    StripeInitIn,
    StripeInitOut,
)
from app.services.payment_service import PaymentService


router = APIRouter(prefix="/billing/payments", tags=["billing-payments"])


@router.post("/cash", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
async def record_cash(
    payload: CashPaymentIn, db: DbSession, current: CurrentUser
) -> PaymentOut:
    return await PaymentService(db).record_cash(payload, viewer_id=current.id)


@router.post("/stripe/init", response_model=StripeInitOut)
async def init_stripe_payment(
    payload: StripeInitIn, db: DbSession, _current: CurrentUser
) -> StripeInitOut:
    return await PaymentService(db).init_stripe(payload)


@router.get("/by-invoice/{invoice_id}", response_model=list[PaymentOut])
async def list_invoice_payments(
    invoice_id: UUID, db: DbSession, _current: CurrentUser
) -> list[PaymentOut]:
    return await PaymentService(db).list_for_invoice(invoice_id)
