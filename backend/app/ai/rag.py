"""RAG pipeline for patient chart Q&A.

The previous implementation pulled top_k *document chunks* via
`document_chunk` rows — but most patients have very few indexed PDFs,
so the bot was answering with stale or irrelevant context (or just
"Insufficient context"). The new pipeline pulls the patient's
**structured chart data** first — SOAP notes, active medications,
allergies, conditions, recent labs, recent vitals — and treats
document chunks as supplementary evidence.

Context budget caps each section so we don't blow past the LLM's
input window for high-volume patients.
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm import llm_client
from app.ai.prompts.patient_chat import PATIENT_CHAT_SYSTEM_PROMPT
from app.models.allergy import Allergy
from app.models.appointment import Appointment, AppointmentStatus
from app.models.condition import Condition
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.lab_result import LabResult
from app.models.medication import Medication
from app.models.patient import Patient
from app.models.soap_note import SoapNote
from app.models.vital import VitalSign
from app.schemas.ai import AiQuestionResponse


SYSTEM = """You are a careful clinical assistant answering questions
about a single patient. Use ONLY the chart context provided below.
Never invent facts, dosages, dates, or values that aren't in the
context. If the context doesn't contain enough information to answer,
say so plainly — do not guess.

When you answer, cite which sections of the chart you used by name
(e.g., "per the recent SOAP note from 2026-05-20", "per the active
medication list", "per the May 12 lab panel"). Be concise and
clinically clear."""


def _chunk(text: str, size: int = 800, overlap: int = 100) -> list[str]:
    """Split text into overlapping windows — used by index_document."""
    chunks: list[str] = []
    i = 0
    while i < len(text):
        chunks.append(text[i : i + size])
        i += size - overlap
    return chunks


class RagService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def index_document(self, document_id: UUID) -> int:
        """Chunk a document's extracted text + persist embeddings.
        Unchanged from the original implementation — supplements the
        chart Q&A path with PDF content when available."""
        doc = await self.db.get(Document, document_id)
        if not doc or not doc.extracted_text:
            return 0

        chunks = _chunk(doc.extracted_text)
        for idx, content in enumerate(chunks):
            embedding = await llm_client.embed(content)
            self.db.add(
                DocumentChunk(
                    document_id=doc.id,
                    chunk_index=idx,
                    content=content,
                    embedding=embedding,
                    chunk_metadata={"name": doc.name, "category": doc.category},
                )
            )
        await self.db.flush()
        return len(chunks)

    async def ask(
        self,
        question: str,
        *,
        patient_id: UUID | None = None,
        top_k: int = 4,
    ) -> AiQuestionResponse:
        """Build a chart-aware context for the patient and ask the LLM.

        Citations report which chart sections were consulted (with
        counts) plus any document chunks that fed in. The provider can
        cross-check each cited section in the UI."""
        if patient_id is None:
            return self._answer_no_patient(question)

        patient = await self.db.get(Patient, patient_id)
        if patient is None:
            return AiQuestionResponse(
                question=question,
                answer="Couldn't find that patient — the chart Q&A needs a valid patient context.",
                citations=[],
                model=llm_client.chat_model,
                generated_at=datetime.now(timezone.utc),
            )

        # ---- Pull structured chart data (capped per section) --------

        notes = (
            await self.db.execute(
                select(SoapNote)
                .where(SoapNote.patient_id == patient_id)
                .order_by(SoapNote.created_at.desc())
                .limit(5)
            )
        ).scalars().all()

        meds = (
            await self.db.execute(
                select(Medication).where(Medication.patient_id == patient_id)
            )
        ).scalars().all()

        allergies = (
            await self.db.execute(
                select(Allergy).where(Allergy.patient_id == patient_id)
            )
        ).scalars().all()

        conditions = (
            await self.db.execute(
                select(Condition).where(Condition.patient_id == patient_id)
            )
        ).scalars().all()

        labs = (
            await self.db.execute(
                select(LabResult)
                .where(LabResult.patient_id == patient_id)
                .order_by(LabResult.collected_at.desc())
                .limit(15)
            )
        ).scalars().all()

        vitals = (
            await self.db.execute(
                select(VitalSign)
                .where(VitalSign.patient_id == patient_id)
                .order_by(VitalSign.recorded_at.desc())
                .limit(10)
            )
        ).scalars().all()

        # Supplementary document chunks. Cap to top_k so the prompt
        # stays bounded; this is the only path that should ever drive
        # the bot when structured data is sparse (e.g., uploaded PDF
        # report contents).
        chunks = []
        if top_k > 0:
            chunks = (
                await self.db.execute(
                    select(DocumentChunk)
                    .join(Document, DocumentChunk.document_id == Document.id)
                    .where(Document.patient_id == patient_id)
                    .order_by(DocumentChunk.id.desc())
                    .limit(top_k)
                )
            ).scalars().all()

        # ---- Build the context block ---------------------------------

        context = self._format_context(
            patient,
            notes=list(notes),
            meds=list(meds),
            allergies=list(allergies),
            conditions=list(conditions),
            labs=list(labs),
            vitals=list(vitals),
            chunks=list(chunks),
        )

        answer = await llm_client.chat(
            messages=[
                {"role": "system", "content": SYSTEM},
                {
                    "role": "user",
                    "content": f"Patient context:\n{context}\n\nQuestion: {question}",
                },
            ],
            max_tokens=500,
        )

        # ---- Citations: enumerate sections + chunks used ------------

        citations: list[dict] = []
        if notes:
            citations.append(
                {
                    "type": "section",
                    "name": "Recent SOAP notes",
                    "count": len(notes),
                }
            )
        if meds:
            citations.append(
                {"type": "section", "name": "Active medications", "count": len(meds)}
            )
        if allergies:
            citations.append(
                {"type": "section", "name": "Allergies", "count": len(allergies)}
            )
        if conditions:
            citations.append(
                {"type": "section", "name": "Conditions", "count": len(conditions)}
            )
        if labs:
            citations.append(
                {"type": "section", "name": "Recent labs", "count": len(labs)}
            )
        if vitals:
            citations.append(
                {"type": "section", "name": "Recent vitals", "count": len(vitals)}
            )
        for c in chunks:
            citations.append(
                {
                    "type": "document",
                    "name": (c.chunk_metadata or {}).get("name", "document"),
                    "snippet": c.content[:160],
                    "document_id": str(c.document_id),
                }
            )

        return AiQuestionResponse(
            question=question,
            answer=answer,
            citations=citations,
            model=llm_client.chat_model,
            generated_at=datetime.now(timezone.utc),
        )

    async def ask_for_patient(
        self,
        question: str,
        *,
        patient: Patient,
    ) -> AiQuestionResponse:
        """Patient-portal flavour of `ask`. The patient is already
        loaded by `CurrentPatient`, so the endpoint passes the row in
        directly — there's no path here that touches any patient_id
        other than the one belonging to the JWT bearer.

        Uses PATIENT_CHAT_SYSTEM_PROMPT — plain language, no medical
        advice, citations phrased in patient-friendly terms. Also
        pulls upcoming appointments (the most common patient question)
        in addition to the structured chart we already load for the
        provider RAG."""
        patient_id = patient.id

        # Provider chart (reused)
        notes = (
            await self.db.execute(
                select(SoapNote)
                .where(SoapNote.patient_id == patient_id)
                .order_by(SoapNote.created_at.desc())
                .limit(5)
            )
        ).scalars().all()

        meds = (
            await self.db.execute(
                select(Medication).where(Medication.patient_id == patient_id)
            )
        ).scalars().all()

        allergies = (
            await self.db.execute(
                select(Allergy).where(Allergy.patient_id == patient_id)
            )
        ).scalars().all()

        conditions = (
            await self.db.execute(
                select(Condition).where(Condition.patient_id == patient_id)
            )
        ).scalars().all()

        labs = (
            await self.db.execute(
                select(LabResult)
                .where(LabResult.patient_id == patient_id)
                .order_by(LabResult.collected_at.desc())
                .limit(10)
            )
        ).scalars().all()

        vitals = (
            await self.db.execute(
                select(VitalSign)
                .where(VitalSign.patient_id == patient_id)
                .order_by(VitalSign.recorded_at.desc())
                .limit(5)
            )
        ).scalars().all()

        # Upcoming + recent appointments — patient-specific addition
        appts = (
            await self.db.execute(
                select(Appointment)
                .where(
                    Appointment.patient_id == patient_id,
                    Appointment.status.in_(
                        [
                            AppointmentStatus.scheduled,
                            AppointmentStatus.confirmed,
                            AppointmentStatus.completed,
                        ]
                    ),
                )
                .order_by(Appointment.starts_at.desc())
                .limit(10)
            )
        ).scalars().all()

        # Build a patient-friendly context block. Section headings
        # match the citation phrasing the prompt asks for.
        context = self._format_patient_context(
            patient,
            notes=list(notes),
            meds=list(meds),
            allergies=list(allergies),
            conditions=list(conditions),
            labs=list(labs),
            vitals=list(vitals),
            appointments=list(appts),
        )

        answer = await llm_client.chat(
            messages=[
                {"role": "system", "content": PATIENT_CHAT_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Your chart:\n{context}\n\nQuestion: {question}",
                },
            ],
            max_tokens=400,
        )

        # Patient-friendly citation labels — match what the prompt
        # asks the model to reference.
        citations: list[dict] = []
        if appts:
            citations.append(
                {
                    "type": "section",
                    "name": "your appointments",
                    "count": len(appts),
                }
            )
        if meds:
            citations.append(
                {
                    "type": "section",
                    "name": "your medications list",
                    "count": len(meds),
                }
            )
        if allergies:
            citations.append(
                {
                    "type": "section",
                    "name": "your allergies on file",
                    "count": len(allergies),
                }
            )
        if conditions:
            citations.append(
                {
                    "type": "section",
                    "name": "your conditions",
                    "count": len(conditions),
                }
            )
        if labs:
            citations.append(
                {
                    "type": "section",
                    "name": "your recent lab results",
                    "count": len(labs),
                }
            )
        if notes:
            citations.append(
                {
                    "type": "section",
                    "name": "your visit notes",
                    "count": len(notes),
                }
            )

        return AiQuestionResponse(
            question=question,
            answer=answer,
            citations=citations,
            model=llm_client.chat_model,
            generated_at=datetime.now(timezone.utc),
        )

    # ----------------------------------------------------- helpers

    def _answer_no_patient(self, question: str) -> AiQuestionResponse:
        return AiQuestionResponse(
            question=question,
            answer=(
                "I can only answer questions about a specific patient. "
                "Open a patient chart first."
            ),
            citations=[],
            model=llm_client.chat_model,
            generated_at=datetime.now(timezone.utc),
        )

    @staticmethod
    def _format_context(
        patient: Patient,
        *,
        notes: list[SoapNote],
        meds: list[Medication],
        allergies: list[Allergy],
        conditions: list[Condition],
        labs: list[LabResult],
        vitals: list[VitalSign],
        chunks: list[DocumentChunk],
    ) -> str:
        """Render a labeled, scannable context block. Each section uses
        the same heading the prompt asks the LLM to cite by name."""
        parts: list[str] = []

        # Patient header
        parts.append(
            f"=== Patient ===\n"
            f"{patient.first_name} {patient.last_name} · "
            f"DOB {patient.dob} · {patient.sex} · "
            f"Procedure: {patient.procedure or 'n/a'} on {patient.procedure_date or 'n/a'} · "
            f"ASA {patient.asa or 'n/a'} · ICU needed: {patient.icu_needed}"
        )

        # Active conditions
        if conditions:
            cond_lines = "\n".join(f"  - {c.name}" for c in conditions if c.name)
            parts.append(f"=== Conditions ===\n{cond_lines}")
        else:
            parts.append("=== Conditions ===\n  (none on file)")

        # Allergies
        if allergies:
            allergy_lines = "\n".join(
                f"  - {a.substance}" + (f" — {a.reaction}" if getattr(a, "reaction", None) else "")
                for a in allergies
                if getattr(a, "substance", None)
            )
            parts.append(f"=== Allergies ===\n{allergy_lines}")
        else:
            parts.append("=== Allergies ===\n  (none on file)")

        # Active medications
        if meds:
            med_lines = "\n".join(
                f"  - {m.name} {m.dose or ''} {m.frequency or ''} ({m.status.value})".rstrip()
                for m in meds
            )
            parts.append(f"=== Active medications ===\n{med_lines}")
        else:
            parts.append("=== Active medications ===\n  (none on file)")

        # Recent vitals
        if vitals:
            vital_lines = "\n".join(
                f"  - {v.recorded_at.date()}: {v.metric} {v.value} {v.unit or ''}".rstrip()
                for v in vitals
            )
            parts.append(f"=== Recent vitals ===\n{vital_lines}")

        # Recent labs
        if labs:
            lab_lines = "\n".join(
                f"  - {l.collected_at.date()}: {l.name} {l.value} {l.unit or ''}"
                f" {('(' + l.flag + ')') if l.flag else ''}".rstrip()
                for l in labs
            )
            parts.append(f"=== Recent labs ===\n{lab_lines}")

        # Recent SOAP notes — full text, capped at 5
        if notes:
            note_blocks: list[str] = []
            for n in notes:
                date_str = n.created_at.date() if n.created_at else "unknown date"
                note_blocks.append(
                    f"  [{date_str}]\n"
                    f"  S: {(n.subjective or '').strip()[:500]}\n"
                    f"  O: {(n.objective or '').strip()[:500]}\n"
                    f"  A: {(n.assessment or '').strip()[:500]}\n"
                    f"  P: {(n.plan or '').strip()[:500]}"
                )
            parts.append("=== Recent SOAP notes ===\n" + "\n\n".join(note_blocks))

        # Supplementary document chunks
        if chunks:
            chunk_lines = "\n".join(
                f"  [{(c.chunk_metadata or {}).get('name', 'document')}] "
                f"{c.content[:400].strip()}"
                for c in chunks
            )
            parts.append(f"=== Document excerpts ===\n{chunk_lines}")

        return "\n\n".join(parts)

    @staticmethod
    def _format_patient_context(
        patient: Patient,
        *,
        notes: list[SoapNote],
        meds: list[Medication],
        allergies: list[Allergy],
        conditions: list[Condition],
        labs: list[LabResult],
        vitals: list[VitalSign],
        appointments: list[Appointment],
    ) -> str:
        """Patient-friendly chart context. Section labels match the
        citation phrasing used in PATIENT_CHAT_SYSTEM_PROMPT so the
        model cites cleanly. No clinical jargon in the labels."""
        parts: list[str] = []

        parts.append(
            f"=== About you ===\n"
            f"Name: {patient.first_name} {patient.last_name}\n"
            f"Date of birth: {patient.dob}"
        )

        # Upcoming appointments — patients ask about this constantly,
        # so it's first.
        if appointments:
            now_iso = datetime.now(timezone.utc).isoformat()
            upcoming_lines: list[str] = []
            past_lines: list[str] = []
            for a in appointments:
                line = (
                    f"  - {a.starts_at.strftime('%b %d, %Y at %I:%M %p')} "
                    f"({a.duration_minutes} min, {a.type.value}, "
                    f"status: {a.status.value})"
                )
                if a.reason:
                    line += f" — reason: {a.reason}"
                if a.starts_at.isoformat() >= now_iso:
                    upcoming_lines.append(line)
                else:
                    past_lines.append(line)
            if upcoming_lines:
                parts.append(
                    "=== Your appointments (upcoming) ===\n"
                    + "\n".join(upcoming_lines)
                )
            if past_lines:
                parts.append(
                    "=== Your appointments (past) ===\n" + "\n".join(past_lines)
                )

        if conditions:
            cond_lines = "\n".join(f"  - {c.name}" for c in conditions if c.name)
            parts.append(f"=== Your conditions ===\n{cond_lines}")

        if allergies:
            allergy_lines = "\n".join(
                f"  - {a.substance}"
                + (f" — reaction: {a.reaction}" if getattr(a, "reaction", None) else "")
                for a in allergies
                if getattr(a, "substance", None)
            )
            parts.append(f"=== Your allergies on file ===\n{allergy_lines}")

        if meds:
            med_lines = "\n".join(
                f"  - {m.name} {m.dose or ''} {m.frequency or ''} ({m.status.value})".rstrip()
                for m in meds
            )
            parts.append(f"=== Your medications list ===\n{med_lines}")

        if vitals:
            vital_lines = "\n".join(
                f"  - {v.recorded_at.date()}: {v.metric} {v.value} {v.unit or ''}".rstrip()
                for v in vitals
            )
            parts.append(f"=== Your recent vitals ===\n{vital_lines}")

        if labs:
            lab_lines = "\n".join(
                f"  - {l.collected_at.date()}: {l.name} {l.value} {l.unit or ''}"
                + (f" — flagged {l.flag}" if l.flag else "")
                for l in labs
            )
            parts.append(f"=== Your recent lab results ===\n{lab_lines}")

        if notes:
            note_blocks: list[str] = []
            for n in notes:
                date_str = (
                    n.created_at.strftime("%b %d, %Y") if n.created_at else "unknown date"
                )
                # Patients see only the Assessment + Plan to keep the
                # voice patient-facing. Subjective + Objective contain
                # the clinician's internal reasoning shorthand.
                summary_bits = []
                if n.assessment:
                    summary_bits.append(f"What we found: {n.assessment.strip()[:400]}")
                if n.plan:
                    summary_bits.append(f"Plan: {n.plan.strip()[:400]}")
                if summary_bits:
                    note_blocks.append(
                        f"  Visit on {date_str}:\n  " + "\n  ".join(summary_bits)
                    )
            if note_blocks:
                parts.append("=== Your visit notes ===\n" + "\n\n".join(note_blocks))

        return "\n\n".join(parts)
