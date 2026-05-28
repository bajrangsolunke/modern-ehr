"""Patient-facing tasks listing. Combines pending form_requests +
open tasks tied to this patient into one chronological feed."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.form_request import FormRequest, FormRequestStatus
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.schemas.patient_portal_tasks import PatientTaskListOut, PatientTaskOut


FORM_LABEL = {
    "consent": "Consent form",
    "intake": "Intake form",
    "roi": "Release of information",
    "insurance": "Insurance details",
    "discharge": "Discharge form",
    "referral": "Referral form",
}


class PatientTasksService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_for_patient(self, patient_id: UUID) -> PatientTaskListOut:
        forms = (
            await self.db.execute(
                select(FormRequest)
                .where(
                    FormRequest.patient_id == patient_id,
                    FormRequest.status.in_(
                        [
                            FormRequestStatus.pending,
                            FormRequestStatus.submitted,
                        ]
                    ),
                )
                .order_by(FormRequest.created_at.desc())
            )
        ).scalars().all()

        tasks = (
            await self.db.execute(
                select(Task)
                .where(
                    Task.patient_id == patient_id,
                    Task.status.in_([TaskStatus.new, TaskStatus.in_progress]),
                )
                .order_by(Task.created_at.desc())
            )
        ).scalars().all()

        requester_ids: set[UUID] = {
            r.requested_by_user_id
            for r in forms
            if r.requested_by_user_id is not None
        }
        requesters: dict[UUID, User] = {}
        if requester_ids:
            rows = (
                await self.db.execute(
                    select(User).where(User.id.in_(requester_ids))
                )
            ).scalars().all()
            requesters = {u.id: u for u in rows}

        items: list[PatientTaskOut] = []
        for f in forms:
            requester = (
                requesters.get(f.requested_by_user_id)
                if f.requested_by_user_id
                else None
            )
            kind = f.form_type.value
            items.append(
                PatientTaskOut(
                    id=f.id,
                    kind="form",
                    title=FORM_LABEL.get(kind, kind.title()),
                    description=f.notes,
                    status=f.status.value,
                    due_date=f.due_date,
                    created_at=f.created_at,
                    requested_by=requester.full_name if requester else None,
                )
            )

        for t in tasks:
            items.append(
                PatientTaskOut(
                    id=t.id,
                    kind="task",
                    title=t.title,
                    description=t.description,
                    status=t.status.value,
                    due_date=t.due_date,
                    created_at=t.created_at,
                    requested_by=None,
                )
            )

        items.sort(key=lambda x: x.created_at, reverse=True)

        return PatientTaskListOut(
            items=items,
            total=len(items),
            forms_count=len(forms),
            tasks_count=len(tasks),
        )
