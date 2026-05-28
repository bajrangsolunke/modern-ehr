"""
FormRequestService — request → submit → review (completed / denied)
workflow for the six clinical forms. Creating a request auto-creates
a Task so the workqueue is the source of truth for "what's open."
Marking the form completed/denied closes the linked task.
"""
from __future__ import annotations

from datetime import datetime, timezone
from math import ceil
from uuid import UUID

from fastapi import HTTPException, status
from pydantic import ValidationError
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.form_request import (
    FormRequest,
    FormRequestStatus,
    FormType,
)
from app.models.patient import Patient
from app.models.task import Task, TaskCategory, TaskPriority, TaskStatus
from app.models.user import User
from app.schemas.form_request import (
    FormRequestCreate,
    FormRequestOut,
    FormRequestReview,
    FormRequestSubmit,
    validate_payload,
)


_FORM_TYPE_LABEL: dict[FormType, str] = {
    FormType.consent: "Consent",
    FormType.intake: "Intake",
    FormType.roi: "ROI",
    FormType.insurance: "Insurance",
    FormType.discharge: "Discharge",
    FormType.referral: "Referral",
}


class FormRequestService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ----------------------------------------------------------- reads

    async def list(
        self,
        *,
        q: str | None = None,
        form_type: FormType | None = None,
        status_filter: FormRequestStatus | None = None,
        patient_id: UUID | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> tuple[list[FormRequestOut], int, int]:
        stmt = select(FormRequest)
        count_stmt = select(func.count(FormRequest.id))

        if patient_id is not None:
            stmt = stmt.where(FormRequest.patient_id == patient_id)
            count_stmt = count_stmt.where(FormRequest.patient_id == patient_id)
        if form_type is not None:
            stmt = stmt.where(FormRequest.form_type == form_type)
            count_stmt = count_stmt.where(FormRequest.form_type == form_type)
        if status_filter is not None:
            stmt = stmt.where(FormRequest.status == status_filter)
            count_stmt = count_stmt.where(FormRequest.status == status_filter)
        if q:
            like = f"%{q.strip()}%"
            cond = or_(FormRequest.notes.ilike(like))
            stmt = stmt.where(cond)
            count_stmt = count_stmt.where(cond)

        total = (await self.db.execute(count_stmt)).scalar_one()
        stmt = (
            stmt.order_by(FormRequest.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = (await self.db.execute(stmt)).scalars().all()
        items = [await self._project(r) for r in rows]
        pages = ceil(total / page_size) if page_size else 1
        return items, total, pages

    async def get(self, form_id: UUID) -> FormRequest:
        row = await self.db.get(FormRequest, form_id)
        if not row:
            raise HTTPException(status_code=404, detail="Form request not found")
        return row

    async def get_projected(self, form_id: UUID) -> FormRequestOut:
        return await self._project(await self.get(form_id))

    # ----------------------------------------------------------- writes

    async def request_form(
        self, *, viewer_id: UUID, payload: FormRequestCreate
    ) -> FormRequestOut:
        patient = await self.db.get(Patient, payload.patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")

        form_type = FormType(payload.form_type)
        row = FormRequest(
            patient_id=payload.patient_id,
            form_type=form_type,
            status=FormRequestStatus.pending,
            requested_by_user_id=viewer_id,
            notes=payload.notes,
            due_date=payload.due_date,
        )
        self.db.add(row)
        await self.db.flush()

        # Auto-task: a "Complete X form for Y" entry on the workqueue.
        # Unassigned by default; staff picks it up. Linked back to the
        # form_request so completing/denying the form closes the task.
        patient_name = f"{patient.first_name} {patient.last_name}".strip()
        task = Task(
            title=f"Complete {_FORM_TYPE_LABEL[form_type]} form for {patient_name}",
            description=payload.notes,
            category=TaskCategory.document,
            priority=TaskPriority.medium,
            status=TaskStatus.new,
            created_by_user_id=viewer_id,
            assigned_to_user_id=None,
            patient_id=payload.patient_id,
            due_date=payload.due_date,
        )
        self.db.add(task)
        await self.db.flush()
        row.task_id = task.id
        await self.db.flush()
        # server_default columns (created_at / updated_at) need an
        # explicit refresh after INSERT before we read them.
        await self.db.refresh(row)

        return await self._project(row)

    async def submit(
        self,
        form_id: UUID,
        *,
        viewer_id: UUID,
        payload: FormRequestSubmit,
    ) -> FormRequestOut:
        row = await self.get(form_id)
        if row.status not in (
            FormRequestStatus.pending,
            FormRequestStatus.submitted,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Form is already {row.status.value}.",
            )

        # Surface payload validation errors as 422 (not a 500). The
        # error path still hits the CORS middleware so the browser
        # gets a clean response instead of a fake CORS error.
        try:
            validated = validate_payload(row.form_type.value, payload.data)
        except ValidationError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "message": "Form data didn't pass validation.",
                    "errors": exc.errors(include_url=False),
                },
            ) from exc
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc
        row.data = validated
        row.submitted_at = datetime.now(timezone.utc)
        row.submitted_by_user_id = viewer_id
        row.status = FormRequestStatus.submitted

        # Move the linked task to "in_progress" so it stays on the
        # workqueue until the reviewer closes it.
        if row.task_id is not None:
            task = await self.db.get(Task, row.task_id)
            if task is not None and task.status == TaskStatus.new:
                task.status = TaskStatus.in_progress

        await self.db.flush()
        await self.db.refresh(row)
        return await self._project(row)

    async def review(
        self,
        form_id: UUID,
        *,
        viewer_id: UUID,
        payload: FormRequestReview,
    ) -> FormRequestOut:
        row = await self.get(form_id)
        if row.status not in (
            FormRequestStatus.submitted,
            FormRequestStatus.completed,
            FormRequestStatus.denied,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Form must be submitted before review.",
            )

        next_status = (
            FormRequestStatus.completed
            if payload.decision == "completed"
            else FormRequestStatus.denied
        )
        row.status = next_status
        row.reviewed_at = datetime.now(timezone.utc)
        row.reviewed_by_user_id = viewer_id
        row.review_notes = payload.review_notes

        # Close the linked task.
        if row.task_id is not None:
            task = await self.db.get(Task, row.task_id)
            if task is not None:
                if next_status == FormRequestStatus.completed:
                    task.status = TaskStatus.completed
                    task.completed_at = row.reviewed_at
                    task.completed_by_user_id = viewer_id
                else:
                    task.status = TaskStatus.cancelled

        # AI side-effect — best-effort, runs after the workflow state
        # is set so any failure can't roll back the review.
        if (
            next_status == FormRequestStatus.completed
            and row.form_type == FormType.intake
        ):
            await self._propagate_intake_red_flags(form=row, viewer_id=viewer_id)

        await self.db.flush()
        await self.db.refresh(row)
        return await self._project(row)

    async def delete(self, form_id: UUID) -> None:
        row = await self.get(form_id)
        # The associated task is preserved (the workqueue audit trail
        # is the source of truth for "who asked / who did what"). The
        # FK has ON DELETE SET NULL so the task survives.
        await self.db.delete(row)
        await self.db.flush()

    # ---------------------------------------------------------- AI hooks

    _MAX_AI_ALERTS_PER_INTAKE = 5

    async def _propagate_intake_red_flags(
        self, *, form: FormRequest, viewer_id: UUID
    ) -> None:
        """On intake approval, run the AI summarizer and convert each
        red flag into a patient_alert with source='ai'. Best-effort —
        any failure is logged at warn level and swallowed so the
        review request still succeeds.

        Dedup: skip if the same (patient_id, label, source='ai',
        resolved=false) row already exists. Hard cap at 5 alerts per
        approval (the model can be chatty)."""
        from app.ai.summary import SummaryService
        from app.core.logging import get_logger
        from app.models.alert import AlertSeverity, AlertSource, PatientAlert
        from app.services.audit_service import AuditService

        log = get_logger(__name__)

        try:
            summary = await SummaryService(self.db).summarize_intake_form(form.id)
            audit = AuditService(self.db)

            created = 0
            for raw_flag in summary.red_flags:
                if created >= self._MAX_AI_ALERTS_PER_INTAKE:
                    break
                label = (raw_flag or "").strip()[:128]
                if not label:
                    continue

                exists = (
                    await self.db.execute(
                        select(PatientAlert).where(
                            PatientAlert.patient_id == form.patient_id,
                            PatientAlert.label == label,
                            PatientAlert.source == AlertSource.ai,
                            PatientAlert.resolved.is_(False),
                        )
                    )
                ).scalar_one_or_none()
                if exists is not None:
                    continue

                alert = PatientAlert(
                    patient_id=form.patient_id,
                    label=label,
                    detail=None,
                    severity=AlertSeverity.warning,
                    source=AlertSource.ai,
                    created_by_id=None,
                )
                self.db.add(alert)
                await self.db.flush()
                await audit.record(
                    user_id=viewer_id,
                    action="alert.create.ai",
                    resource_type="patient_alert",
                    resource_id=str(alert.id),
                    payload={"label": label, "form_id": str(form.id)},
                )
                created += 1
        except Exception as exc:
            log.warning(
                "intake_propagation_failed",
                form_id=str(form.id),
                error=str(exc),
            )

    # ---------------------------------------------------------- helpers

    async def _project(self, row: FormRequest) -> FormRequestOut:
        patient = await self.db.get(Patient, row.patient_id)
        patient_name = (
            f"{patient.first_name} {patient.last_name}".strip()
            if patient
            else None
        )
        patient_mrn = patient.mrn if patient else None

        async def _user_name(uid: UUID | None) -> str | None:
            if not uid:
                return None
            u = await self.db.get(User, uid)
            return (u.full_name or u.email) if u else None

        return FormRequestOut(
            id=row.id,
            patient_id=row.patient_id,
            patient_name=patient_name,
            patient_mrn=patient_mrn,
            form_type=row.form_type.value,
            status=row.status.value,
            requested_by_user_id=row.requested_by_user_id,
            requested_by_name=await _user_name(row.requested_by_user_id),
            notes=row.notes,
            due_date=row.due_date,
            data=row.data,
            submitted_at=row.submitted_at,
            submitted_by_user_id=row.submitted_by_user_id,
            submitted_by_name=await _user_name(row.submitted_by_user_id),
            reviewed_at=row.reviewed_at,
            reviewed_by_user_id=row.reviewed_by_user_id,
            reviewed_by_name=await _user_name(row.reviewed_by_user_id),
            review_notes=row.review_notes,
            task_id=row.task_id,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
