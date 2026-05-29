"""Patient-facing appointments listing. Returns upcoming + past splits
for the authenticated patient only — no cross-patient access here."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment
from app.models.user import User
from app.schemas.patient_portal_appointments import (
    PatientAppointmentListOut,
    PatientAppointmentOut,
)


class PatientAppointmentsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_for_patient(self, patient_id: UUID) -> PatientAppointmentListOut:
        rows = (
            await self.db.execute(
                select(Appointment)
                .where(Appointment.patient_id == patient_id)
                .order_by(Appointment.starts_at.desc())
            )
        ).scalars().all()

        provider_ids = {r.physician_id for r in rows if r.physician_id}
        providers = {}
        if provider_ids:
            users = (
                await self.db.execute(
                    select(User).where(User.id.in_(provider_ids))
                )
            ).scalars().all()
            providers = {u.id: u for u in users}

        # Eager-load charge + invoice billing info per appointment.
        from app.models.charge import Charge
        from app.models.invoice import Invoice
        from app.models.service_catalog import ServiceCatalog

        appt_ids = [r.id for r in rows]
        billing: dict[UUID, tuple[str | None, UUID | None, int | None, int | None]] = {}
        if appt_ids:
            charges_q = await self.db.execute(
                select(Charge).where(
                    Charge.appointment_id.in_(appt_ids),
                    Charge.voided_at.is_(None),
                )
            )
            charges_by_appt: dict[UUID, Charge] = {}
            for c in charges_q.scalars().all():
                # Latest non-voided per appointment.
                existing = charges_by_appt.get(c.appointment_id)  # type: ignore[arg-type]
                if existing is None or c.created_at > existing.created_at:
                    charges_by_appt[c.appointment_id] = c  # type: ignore[index]

            cat_ids = {c.service_catalog_id for c in charges_by_appt.values() if c.service_catalog_id}
            cats: dict[UUID, ServiceCatalog] = {}
            if cat_ids:
                cats_q = await self.db.execute(
                    select(ServiceCatalog).where(ServiceCatalog.id.in_(cat_ids))
                )
                cats = {c.id: c for c in cats_q.scalars().all()}

            inv_ids = {c.invoice_id for c in charges_by_appt.values() if c.invoice_id}
            invs: dict[UUID, Invoice] = {}
            if inv_ids:
                invs_q = await self.db.execute(
                    select(Invoice).where(Invoice.id.in_(inv_ids))
                )
                invs = {i.id: i for i in invs_q.scalars().all()}

            for appt_id, c in charges_by_appt.items():
                svc_name = cats[c.service_catalog_id].name if c.service_catalog_id and c.service_catalog_id in cats else None
                if c.invoice_id and c.invoice_id in invs:
                    inv = invs[c.invoice_id]
                    billing[appt_id] = (svc_name, inv.id, inv.balance_cents, inv.total_cents)
                else:
                    billing[appt_id] = (svc_name, None, c.total_cents, c.total_cents)

        now = datetime.now(timezone.utc)
        upcoming: list[PatientAppointmentOut] = []
        past: list[PatientAppointmentOut] = []
        for row in rows:
            provider = providers.get(row.physician_id) if row.physician_id else None
            extras = billing.get(row.id, (None, None, None, None))
            dto = PatientAppointmentOut(
                id=row.id,
                starts_at=row.starts_at,
                duration_minutes=row.duration_minutes,
                type=row.type.value,
                modality=row.modality.value,
                status=row.status.value,
                room=row.room,
                reason=row.reason,
                provider_name=provider.full_name if provider else None,
                provider_specialty=provider.specialty if provider else None,
                service_name=extras[0],
                invoice_id=extras[1],
                invoice_balance_cents=extras[2],
                invoice_total_cents=extras[3],
            )
            if row.starts_at >= now:
                upcoming.append(dto)
            else:
                past.append(dto)

        upcoming.sort(key=lambda x: x.starts_at)
        return PatientAppointmentListOut(upcoming=upcoming, past=past)
