"""Patient-facing tasks + forms write surface.

Two ownership invariants protect everything below:
  * tasks are visible/writable only when `tasks.patient_id == current.id`
  * form_requests are visible/writable only when
    `form_requests.patient_id == current.id`
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.form_request import FormRequest, FormRequestStatus
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.schemas.patient_portal_forms import (
    PatientFormRequestListOut,
    PatientFormRequestOut,
)
from app.schemas.patient_portal_tasks import (
    FormDetailOut,
    PatientTaskListOut,
    PatientTaskOut,
)


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
                    form_type=kind,
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
                    form_type=None,
                )
            )

        items.sort(key=lambda x: x.created_at, reverse=True)

        return PatientTaskListOut(
            items=items,
            total=len(items),
            forms_count=len(forms),
            tasks_count=len(tasks),
        )

    async def complete_task(self, task_id: UUID, patient_id: UUID) -> Task:
        task = await self.db.get(Task, task_id)
        if task is None or task.patient_id != patient_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found",
            )
        if task.status == TaskStatus.completed:
            return task
        task.status = TaskStatus.completed
        task.completed_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(task)
        return task

    async def _own_form(self, form_id: UUID, patient_id: UUID) -> FormRequest:
        form = await self.db.get(FormRequest, form_id)
        if form is None or form.patient_id != patient_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Form not found",
            )
        return form

    async def get_form_detail(
        self, form_id: UUID, patient_id: UUID
    ) -> FormDetailOut:
        form = await self._own_form(form_id, patient_id)
        requester_name = None
        if form.requested_by_user_id:
            user = await self.db.get(User, form.requested_by_user_id)
            requester_name = user.full_name if user else None
        return FormDetailOut(
            id=form.id,
            form_type=form.form_type.value,
            status=form.status.value,
            notes=form.notes,
            due_date=form.due_date,
            data=form.data,
            requested_by=requester_name,
            submitted_at=form.submitted_at,
        )

    async def list_form_requests(
        self, patient_id: UUID
    ) -> PatientFormRequestListOut:
        rows = (
            await self.db.execute(
                select(FormRequest)
                .where(FormRequest.patient_id == patient_id)
                .order_by(FormRequest.created_at.desc())
            )
        ).scalars().all()

        requester_ids = {
            r.requested_by_user_id for r in rows if r.requested_by_user_id
        }
        requesters: dict[UUID, User] = {}
        if requester_ids:
            user_rows = (
                await self.db.execute(
                    select(User).where(User.id.in_(requester_ids))
                )
            ).scalars().all()
            requesters = {u.id: u for u in user_rows}

        items: list[PatientFormRequestOut] = []
        pending = submitted = completed = 0
        for r in rows:
            req = (
                requesters.get(r.requested_by_user_id)
                if r.requested_by_user_id
                else None
            )
            items.append(
                PatientFormRequestOut(
                    id=r.id,
                    form_type=r.form_type.value,
                    status=r.status.value,
                    notes=r.notes,
                    due_date=r.due_date,
                    created_at=r.created_at,
                    submitted_at=r.submitted_at,
                    requested_by=req.full_name if req else None,
                )
            )
            if r.status == FormRequestStatus.pending:
                pending += 1
            elif r.status == FormRequestStatus.submitted:
                submitted += 1
            elif r.status == FormRequestStatus.completed:
                completed += 1

        return PatientFormRequestListOut(
            items=items,
            pending=pending,
            submitted=submitted,
            completed=completed,
        )

    async def submit_form(
        self, form_id: UUID, patient_id: UUID, data: dict[str, Any]
    ) -> FormDetailOut:
        form = await self._own_form(form_id, patient_id)
        if form.status not in (
            FormRequestStatus.pending,
            FormRequestStatus.submitted,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Form is already {form.status.value}",
            )
        form.data = data
        form.status = FormRequestStatus.submitted
        form.submitted_at = datetime.now(timezone.utc)
        await self.db.commit()
        return await self.get_form_detail(form_id, patient_id)
