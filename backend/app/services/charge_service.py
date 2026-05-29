from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.charge import Charge
from app.models.service_catalog import ServiceCatalog
from app.schemas.charge import ChargeCreate, ChargeOut


def _compute_tax_cents(taxable_subtotal: int, tax_rate_bp: int) -> int:
    """Basis points: 825 == 8.25%. Truncate (don't round) so totals
    stay deterministic across read/write."""
    return (taxable_subtotal * tax_rate_bp) // 10_000


class ChargeService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(
        self, payload: ChargeCreate, *, viewer_id: UUID
    ) -> ChargeOut:
        catalog: ServiceCatalog | None = None
        if payload.service_catalog_id is not None:
            catalog = await self.db.get(ServiceCatalog, payload.service_catalog_id)
            if catalog is None or not catalog.is_active:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Service not found or inactive",
                )

        # Snapshot description / code / unit price.
        if catalog is not None:
            description = catalog.name
            code = catalog.code
            unit_price_cents = catalog.price_cents
            tax_rate_bp = catalog.tax_rate_bp
            taxable = catalog.taxable
        else:
            # Validated by ChargeCreate.model_validator that these are all set.
            description = payload.description  # type: ignore[assignment]
            code = payload.code  # type: ignore[assignment]
            unit_price_cents = payload.unit_price_cents  # type: ignore[assignment]
            tax_rate_bp = 0
            taxable = False

        subtotal = unit_price_cents * payload.quantity
        discount_after_qty = max(0, subtotal - payload.discount_cents)
        tax_cents = (
            _compute_tax_cents(discount_after_qty, tax_rate_bp) if taxable else 0
        )
        total = discount_after_qty + tax_cents

        row = Charge(
            patient_id=payload.patient_id,
            encounter_id=payload.encounter_id,
            appointment_id=payload.appointment_id,
            service_catalog_id=payload.service_catalog_id,
            description=description,
            code=code,
            quantity=payload.quantity,
            unit_price_cents=unit_price_cents,
            discount_cents=payload.discount_cents,
            tax_cents=tax_cents,
            total_cents=total,
            created_by_user_id=viewer_id,
        )
        self.db.add(row)
        await self.db.flush()
        await self.db.refresh(row)
        return ChargeOut.model_validate(row)

    async def get(self, charge_id: UUID) -> ChargeOut:
        row = await self.db.get(Charge, charge_id)
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Charge not found"
            )
        return ChargeOut.model_validate(row)

    async def list_for_patient(self, patient_id: UUID) -> list[ChargeOut]:
        rows = (
            await self.db.execute(
                select(Charge)
                .where(Charge.patient_id == patient_id)
                .order_by(Charge.created_at.desc())
            )
        ).scalars().all()
        return [ChargeOut.model_validate(r) for r in rows]

    async def void(
        self, charge_id: UUID, *, viewer_id: UUID, reason: str  # noqa: ARG002
    ) -> ChargeOut:
        row = await self.db.get(Charge, charge_id)
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Charge not found"
            )
        if row.invoice_id is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Charge is already on an invoice; void the invoice instead.",
            )
        if row.voided_at is not None:
            return ChargeOut.model_validate(row)
        row.voided_at = datetime.now(timezone.utc)
        row.voided_by_user_id = viewer_id
        await self.db.flush()
        await self.db.refresh(row)
        return ChargeOut.model_validate(row)
