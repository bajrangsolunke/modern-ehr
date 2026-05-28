from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.chart_hash import compute_chart_hash
from app.ai.llm import llm_client
from app.models.ai_insight import AiInsight
from app.models.allergy import Allergy
from app.models.condition import Condition
from app.models.form_request import FormRequest, FormRequestStatus, FormType
from app.models.lab_result import LabResult
from app.models.medication import Medication
from app.models.patient import Patient
from app.schemas.ai import (
    AiIntakeSummaryResponse,
    AiSoapDraftResponse,
    AiSummaryResponse,
)


SYSTEM_PROMPT = """You are a senior clinical AI assistant for a hospital EHR.
Produce concise, clinically accurate summaries. Output JSON:
{
  "summary": "<2-3 sentence clinical summary>",
  "bullets": ["<5 short clinical bullets>", ...],
  "confidence": 0.0-1.0
}
Avoid speculation. Highlight critical risks first.
"""


INTAKE_SYSTEM_PROMPT = """You are a clinical intake assistant for an EHR.
You receive a structured patient intake form (demographics, contact,
insurance, health history, allergies, medications, surgeries, family
history) and produce a clinician-ready summary.

Be concise, factual, and HIGHLIGHT SAFETY ISSUES FIRST (allergies,
anticoagulants, contraindications, urgent symptoms). Never invent
information not present in the form.

Output strict JSON:
{
  "summary": "<2-3 sentence overview for the provider>",
  "bullets": ["<5-8 short clinical facts>", ...],
  "red_flags": ["<allergies, anticoag, urgent issues>", ...],
  "follow_ups": ["<questions the provider should ask the patient>", ...],
  "confidence": 0.0-1.0
}
If a section is empty, return [] for that key — do not fabricate items.
"""


SOAP_SYSTEM_PROMPT = """You are a clinical scribe drafting ONLY the
Subjective section of a SOAP note from a patient intake form. The
intake form contains patient-reported history but NO exam findings,
vitals, clinical observations, or provider judgment — therefore you
MUST NOT generate the Objective, Assessment, or Plan sections. Those
require the provider to have seen the patient.

Subjective drafting rules:
- 3-5 sentences, written in plain clinical prose.
- Cover (in this order): reason for visit / chief complaint inferred
  from diagnosed_problems; relevant past medical and surgical history;
  current medications; documented allergies; pertinent family history.
- Use patient-reported phrasing ("reports", "denies", "endorses").
- Do NOT invent symptoms or complaints not present in the intake.
- Do NOT speculate about diagnosis — that's the Assessment, which the
  provider writes after the encounter.

Output strict JSON:
{
  "subjective": "...",
  "confidence": 0.0-1.0
}
Return ONLY these two keys. Do not include objective, assessment, or
plan fields — those are explicitly out of scope here.
"""


class SummaryService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def for_patient(
        self,
        patient_id: UUID,
        style: str = "clinical",
        *,
        force: bool = False,
    ) -> AiSummaryResponse:
        patient = await self.db.get(Patient, patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")

        allergies = (
            await self.db.execute(select(Allergy).where(Allergy.patient_id == patient_id))
        ).scalars().all()
        conditions = (
            await self.db.execute(select(Condition).where(Condition.patient_id == patient_id))
        ).scalars().all()
        meds = (
            await self.db.execute(select(Medication).where(Medication.patient_id == patient_id))
        ).scalars().all()
        labs = (
            await self.db.execute(
                select(LabResult)
                .where(LabResult.patient_id == patient_id)
                .order_by(LabResult.collected_at.desc())
                .limit(10)
            )
        ).scalars().all()

        chart_hash = compute_chart_hash(
            patient=patient,
            allergies=allergies,
            conditions=conditions,
            medications=meds,
            labs=labs,
        )

        if not force:
            cached_row = (
                await self.db.execute(
                    select(AiInsight)
                    .where(
                        AiInsight.patient_id == patient_id,
                        AiInsight.category == f"chart_summary:{style}",
                        AiInsight.content_hash == chart_hash,
                    )
                    .order_by(AiInsight.created_at.desc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            if cached_row is not None:
                actions = cached_row.actions or {}
                return AiSummaryResponse(
                    patient_id=patient_id,
                    summary=cached_row.summary,
                    bullets=list(actions.get("bullets") or []),
                    confidence=float(cached_row.confidence or 0.0),
                    model=cached_row.model,
                    generated_at=cached_row.created_at,
                    cached=True,
                )

        ctx = self._format_context(patient, allergies, conditions, meds, labs, style)
        raw = await llm_client.chat(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": ctx},
            ],
            json_mode=True,
            max_tokens=500,
        )
        parsed = self._safe_parse(raw, patient)

        row = AiInsight(
            patient_id=patient_id,
            category=f"chart_summary:{style}",
            title=f"Chart summary: {patient.first_name} {patient.last_name}",
            summary=parsed["summary"],
            confidence=parsed["confidence"],
            model=llm_client.chat_model,
            actions={"bullets": parsed["bullets"]},
            content_hash=chart_hash,
        )
        self.db.add(row)
        await self.db.flush()
        await self.db.refresh(row)

        return AiSummaryResponse(
            patient_id=patient_id,
            summary=parsed["summary"],
            bullets=parsed["bullets"],
            confidence=parsed["confidence"],
            model=llm_client.chat_model,
            generated_at=row.created_at,
            cached=False,
        )

    async def summarize_intake_form(
        self, form_id: UUID, style: str = "clinical"
    ) -> AiIntakeSummaryResponse:
        """Run an LLM summary over a submitted intake form_request. The
        intake payload shape is validated upstream by IntakeFormPayload
        (see app/schemas/form_request.py), so we trust the structure
        here and just flatten it for the prompt."""
        form = await self.db.get(FormRequest, form_id)
        if not form:
            raise HTTPException(status_code=404, detail="Form request not found")
        if form.form_type != FormType.intake:
            raise HTTPException(
                status_code=400,
                detail=f"Form is {form.form_type.value}, not intake.",
            )
        if form.status == FormRequestStatus.pending or not form.data:
            raise HTTPException(
                status_code=409,
                detail="Intake form has not been submitted yet — nothing to summarize.",
            )

        ctx = self._format_intake_context(form.data, style)
        raw = await llm_client.chat(
            messages=[
                {"role": "system", "content": INTAKE_SYSTEM_PROMPT},
                {"role": "user", "content": ctx},
            ],
            json_mode=True,
            max_tokens=700,
        )
        parsed = self._safe_parse_intake(raw, form.data)

        return AiIntakeSummaryResponse(
            form_id=form_id,
            patient_id=form.patient_id,
            summary=parsed["summary"],
            bullets=parsed["bullets"],
            red_flags=parsed["red_flags"],
            follow_ups=parsed["follow_ups"],
            confidence=parsed["confidence"],
            model=llm_client.chat_model,
            generated_at=datetime.now(timezone.utc),
        )

    async def intake_to_soap_for_patient(
        self, patient_id: UUID
    ) -> AiSoapDraftResponse:
        """Find the patient's most recent intake form with submitted data
        and synthesize a SOAP-note draft from it. Used by the SOAP drawer's
        'Fill from intake' button."""
        from sqlalchemy import desc

        form = (
            await self.db.execute(
                select(FormRequest)
                .where(
                    FormRequest.patient_id == patient_id,
                    FormRequest.form_type == FormType.intake,
                    FormRequest.status.in_(
                        [
                            FormRequestStatus.submitted,
                            FormRequestStatus.completed,
                        ]
                    ),
                )
                .order_by(desc(FormRequest.submitted_at))
                .limit(1)
            )
        ).scalar_one_or_none()

        if form is None or not form.data:
            raise HTTPException(
                status_code=404,
                detail="No submitted intake form found for this patient.",
            )

        ctx = self._format_intake_context(form.data, "clinical")
        raw = await llm_client.chat(
            messages=[
                {"role": "system", "content": SOAP_SYSTEM_PROMPT},
                {"role": "user", "content": ctx},
            ],
            json_mode=True,
            max_tokens=900,
        )
        parsed = self._safe_parse_soap(raw, form.data)

        return AiSoapDraftResponse(
            form_id=form.id,
            patient_id=patient_id,
            subjective=parsed["subjective"],
            # Objective / Assessment / Plan are intentionally empty:
            # intake forms contain no exam findings and the provider
            # must document those after the encounter.
            objective="",
            assessment="",
            plan="",
            confidence=parsed["confidence"],
            model=llm_client.chat_model,
            generated_at=datetime.now(timezone.utc),
        )

    @staticmethod
    def _safe_parse_soap(raw: str, intake_data: dict) -> dict:
        """Parse the Subjective JSON the LLM returned. Falls back to a
        deterministic stub built directly from the intake payload when the
        model isn't configured or returns malformed JSON — enough to demo
        without an API key.

        Only the Subjective field is produced here; the calling code zeros
        out Objective / Assessment / Plan because those require the
        provider to have seen the patient (out of scope for an intake
        autofill)."""
        import json

        try:
            obj = json.loads(raw)
            subjective = (obj.get("subjective") or "").strip()
            if subjective:
                return {
                    "subjective": subjective,
                    "confidence": float(obj.get("confidence", 0.6)),
                }
        except Exception:
            pass

        # Stub fallback — readable Subjective prose from raw intake fields.
        health = intake_data.get("health_history") or {}
        problems = health.get("diagnosed_problems") or "no chronic problems documented"
        allergies = health.get("allergies") or []
        meds = health.get("current_medications") or []
        surgeries = health.get("past_surgeries") or []

        allergy_str = (
            ", ".join(a.get("name", "?") for a in allergies if a.get("name"))
            or "no known allergies"
        )
        med_str = (
            ", ".join(m.get("name", "?") for m in meds if m.get("name"))
            or "no current medications"
        )
        surgery_str = (
            ", ".join(
                f"{s.get('name', '?')}"
                + (f" ({s.get('onset_date')})" if s.get("onset_date") else "")
                for s in surgeries
                if s.get("name")
            )
            or "no past surgeries reported"
        )

        return {
            "subjective": (
                f"Patient reports history of {problems}. "
                f"Past surgical history: {surgery_str}. "
                f"Current medications: {med_str}. "
                f"Reported allergies: {allergy_str}."
            ),
            "confidence": 0.4,
        }

    @staticmethod
    def _format_intake_context(data: dict, style: str) -> str:
        """Flatten the IntakeFormPayload dict into a readable prompt
        block. We deliberately walk the well-known keys instead of
        json.dumps-ing the whole thing — the LLM does noticeably better
        on labelled prose than on raw JSON for this size of payload."""
        demo = data.get("demographics") or {}
        contact = data.get("contact") or {}
        ins = data.get("insurance") or {}
        health = data.get("health_history") or {}
        family = data.get("family_health_history") or {}

        name = " ".join(
            x for x in [demo.get("first_name"), demo.get("last_name")] if x
        ).strip() or "<no name>"

        allergies = health.get("allergies") or []
        a_lines = [
            f"  - {a.get('name') or '?'} ({a.get('type') or 'unknown'}): "
            f"{a.get('description') or 'no description'}"
            for a in allergies
        ] or ["  - None reported"]

        meds = health.get("current_medications") or []
        m_lines = [
            f"  - {m.get('name') or '?'} — {m.get('frequency') or 'frequency unknown'}"
            + (f" ({m.get('note')})" if m.get("note") else "")
            for m in meds
        ] or ["  - None reported"]

        surgeries = health.get("past_surgeries") or []
        s_lines = [
            f"  - {s.get('name') or '?'} on {s.get('onset_date') or 'unknown date'}"
            + (f" at {s.get('hospital')}" if s.get("hospital") else "")
            for s in surgeries
        ] or ["  - None reported"]

        childhood = health.get("childhood_illnesses") or []
        problems = health.get("diagnosed_problems") or "None reported"

        fam = family.get("conditions") or []
        f_lines = [
            f"  - {c.get('condition_name') or '?'} ({c.get('relation') or 'unknown relation'})"
            for c in fam
        ] or ["  - None reported"]

        return (
            f"Style: {style}\n"
            f"Patient: {name}\n"
            f"DOB: {demo.get('dob') or 'unknown'}\n"
            f"Sex / gender: {demo.get('gender_at_birth') or '?'} / "
            f"{demo.get('current_gender') or '?'}\n"
            f"Preferred language: {demo.get('preferred_language') or 'unknown'}\n"
            f"Occupation: {demo.get('occupation') or 'unknown'}\n"
            f"Contact: phone {contact.get('mobile_number') or contact.get('home_number') or 'n/a'}, "
            f"email {contact.get('email') or 'n/a'}\n"
            f"Address: {contact.get('city') or ''}, {contact.get('state') or ''} "
            f"{contact.get('country') or ''}\n"
            f"Insurance: {ins.get('insurance_name') or 'none'} "
            f"(plan: {ins.get('insurance_plan') or 'n/a'})\n"
            f"\nDiagnosed problems: {problems}\n"
            f"Childhood illnesses: {', '.join(childhood) if childhood else 'None reported'}\n"
            f"\nAllergies:\n" + "\n".join(a_lines) + "\n"
            f"\nCurrent medications:\n" + "\n".join(m_lines) + "\n"
            f"\nPast surgeries:\n" + "\n".join(s_lines) + "\n"
            f"\nFamily history:\n" + "\n".join(f_lines) + "\n"
            "\nReturn JSON only — no prose around it."
        )

    @staticmethod
    def _safe_parse_intake(raw: str, data: dict) -> dict:
        import json

        try:
            obj = json.loads(raw)
            return {
                "summary": (obj.get("summary") or "").strip()
                or "Intake submitted; review allergies and current medications.",
                "bullets": list(obj.get("bullets") or []),
                "red_flags": list(obj.get("red_flags") or []),
                "follow_ups": list(obj.get("follow_ups") or []),
                "confidence": float(obj.get("confidence", 0.6)),
            }
        except Exception:
            # Stub / non-JSON fallback — surface what we can without
            # making clinical claims the model didn't make.
            allergies = (data.get("health_history") or {}).get("allergies") or []
            meds = (data.get("health_history") or {}).get("current_medications") or []
            red_flags = [
                f"Allergy: {a.get('name')}" for a in allergies if a.get("name")
            ]
            bullets = [f"Medication: {m.get('name')}" for m in meds if m.get("name")]
            return {
                "summary": "Intake form submitted. AI summary unavailable — review form manually.",
                "bullets": bullets[:8],
                "red_flags": red_flags[:5],
                "follow_ups": [
                    "Confirm allergy reactions and severity",
                    "Reconcile current medication list with patient",
                ],
                "confidence": 0.3,
            }

    @staticmethod
    def _format_context(
        patient: Patient,
        allergies: list[Allergy],
        conditions: list[Condition],
        meds: list[Medication],
        labs: list[LabResult],
        style: str,
    ) -> str:
        a = ", ".join(a.substance for a in allergies) or "None"
        c = ", ".join(c.name for c in conditions) or "None"
        m = ", ".join(f"{m.name} {m.dose}" for m in meds) or "None"
        l = "; ".join(f"{l.name} {l.value}{l.unit or ''} {l.flag or ''}" for l in labs) or "None"
        return (
            f"Style: {style}\n"
            f"Patient: {patient.first_name} {patient.last_name}, "
            f"{patient.sex}, DOB {patient.dob}\n"
            f"Procedure: {patient.procedure} on {patient.procedure_date}\n"
            f"ASA: {patient.asa or 'N/A'}; ICU needed: {patient.icu_needed}\n"
            f"Allergies: {a}\n"
            f"Conditions: {c}\n"
            f"Medications: {m}\n"
            f"Recent labs: {l}\n"
            "Return JSON only."
        )

    @staticmethod
    def _safe_parse(raw: str, patient: Patient) -> dict:
        import json

        try:
            data = json.loads(raw)
            return {
                "summary": data.get("summary", "").strip()
                or f"Surgical candidate {patient.first_name} {patient.last_name}.",
                "bullets": data.get("bullets") or [],
                "confidence": float(data.get("confidence", 0.7)),
            }
        except Exception:
            return {
                "summary": (
                    f"Patient {patient.first_name} {patient.last_name} scheduled for "
                    f"{patient.procedure or 'evaluation'}. Review allergies, anticoagulation, "
                    "and ICU planning."
                ),
                "bullets": [
                    "Review anticoagulation bridge timing",
                    "Confirm ICU bed availability",
                    "Update consent if procedure plan changes",
                ],
                "confidence": 0.5,
            }
