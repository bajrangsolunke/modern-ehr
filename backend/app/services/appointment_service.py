from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment
from app.schemas.appointment import AppointmentCreate, AppointmentUpdate


class AppointmentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(
        self, payload: AppointmentCreate, *, viewer_id: UUID
    ) -> Appointment:
        """Create the appointment and (optionally) auto-issue a one-line
        invoice for the linked service. Runs in the request transaction
        so a charge/invoice failure rolls back the appointment too."""
        appt = Appointment(
            **payload.model_dump(exclude={"service_catalog_id"}),
            service_catalog_id=payload.service_catalog_id,
        )
        self.db.add(appt)
        await self.db.flush()

        if payload.service_catalog_id is not None:
            from app.schemas.charge import ChargeCreate
            from app.schemas.invoice import InvoiceIssueIn
            from app.services.charge_service import ChargeService
            from app.services.invoice_service import InvoiceService

            charge = await ChargeService(self.db).create(
                ChargeCreate(
                    patient_id=payload.patient_id,
                    appointment_id=appt.id,
                    service_catalog_id=payload.service_catalog_id,
                    quantity=1,
                ),
                viewer_id=viewer_id,
            )
            await InvoiceService(self.db).issue(
                InvoiceIssueIn(
                    patient_id=payload.patient_id,
                    charge_ids=[charge.id],
                ),
                viewer_id=viewer_id,
            )

        await self.db.refresh(appt)
        return appt

    async def load_billing_extras(
        self, appt: Appointment
    ) -> tuple[str | None, UUID | None, int | None, int | None]:
        """Returns (service_code, invoice_id, total_cents, balance_cents).
        Looks at the non-voided charge tied to the appointment; if it's
        on an invoice, fetches that invoice's totals."""
        from app.models.charge import Charge
        from app.models.invoice import Invoice
        from app.models.service_catalog import ServiceCatalog

        result = await self.db.execute(
            select(Charge)
            .where(
                Charge.appointment_id == appt.id,
                Charge.voided_at.is_(None),
            )
            .order_by(Charge.created_at.desc())
            .limit(1)
        )
        charge = result.scalar_one_or_none()
        if charge is None:
            return (None, None, None, None)

        service_code = None
        if charge.service_catalog_id:
            cat = await self.db.get(ServiceCatalog, charge.service_catalog_id)
            service_code = cat.name if cat else None

        if charge.invoice_id is None:
            return (service_code, None, charge.total_cents, charge.total_cents)

        inv = await self.db.get(Invoice, charge.invoice_id)
        if inv is None:
            return (service_code, None, charge.total_cents, charge.total_cents)
        return (service_code, inv.id, inv.total_cents, inv.balance_cents)

    async def get(self, appt_id: UUID) -> Appointment:
        appt = await self.db.get(Appointment, appt_id)
        if not appt:
            raise HTTPException(status_code=404, detail="Appointment not found")
        return appt

    async def update(self, appt_id: UUID, payload: AppointmentUpdate) -> Appointment:
        appt = await self.get(appt_id)
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(appt, k, v)
        await self.db.flush()
        await self.db.refresh(appt)
        return appt

    async def list_for_patient(self, patient_id: UUID) -> list[Appointment]:
        result = await self.db.execute(
            select(Appointment)
            .where(Appointment.patient_id == patient_id)
            .order_by(Appointment.starts_at.desc())
        )
        return list(result.scalars().all())

    async def list_upcoming(self, limit: int = 50) -> list[Appointment]:
        result = await self.db.execute(
            select(Appointment).order_by(Appointment.starts_at.asc()).limit(limit)
        )
        return list(result.scalars().all())
