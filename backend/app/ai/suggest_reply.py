"""
AI suggest-reply for the Communication module.

Pulls the conversation's recent messages + (for patient threads) a
slim patient context — last few labs / meds / allergies — and asks
the LLM to propose a single short reply the clinician can send.

Falls back to a deterministic template when OPENAI_API_KEY isn't set
so the button still does something useful in dev/demo.
"""
from __future__ import annotations

import json
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm import llm_client
from app.models.conversation import Conversation, Message
from app.models.lab_result import LabResult
from app.models.medication import Medication
from app.models.patient import Patient


SYSTEM_PROMPT = """You are an AI assistant drafting a reply for a clinician messaging
their patient or a fellow team member. Tone is warm, professional, and
concise — like SMS, not formal email.

Hard rules:
- Reply must be at most 320 characters.
- Do NOT diagnose, prescribe, or commit to specific medications or dosages.
- Do NOT promise care outcomes ("you'll feel better by Monday").
- If the most recent message asks for something only the clinician can decide
  (procedure approval, dosage change), acknowledge and say you'll review.
- Match the tone of the patient (formal vs casual) when the conversation has
  precedent.

Output JSON exactly:
{
  "suggestion": "<the reply text>",
  "rationale": "<one short clause explaining why this reply>"
}
"""


class SuggestReplyService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def suggest(self, conversation: Conversation) -> str:
        """Returns a single suggested reply string. Empty on failure."""
        msgs = await self._recent_messages(conversation.id)
        patient_ctx = await self._patient_context(conversation)

        user_prompt = self._build_prompt(conversation, msgs, patient_ctx)

        raw = await llm_client.chat(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            json_mode=True,
            temperature=0.4,
            max_tokens=240,
        )

        # Stub path returns plain text starting with "[AI stub]" — degrade
        # gracefully by falling back to a sensible template.
        if not llm_client.enabled or raw.startswith("[AI stub]"):
            return _fallback_reply(msgs)

        try:
            payload = json.loads(raw)
            suggestion = str(payload.get("suggestion", "")).strip()
            if not suggestion:
                return _fallback_reply(msgs)
            # Hard cap on length in case the model overshoots.
            return suggestion[:320]
        except (ValueError, TypeError):
            return _fallback_reply(msgs)

    # ----------------------------------------------------------------

    async def _recent_messages(self, conversation_id: UUID) -> list[Message]:
        rows = (
            await self.db.execute(
                select(Message)
                .where(Message.conversation_id == conversation_id)
                .order_by(Message.sent_at.desc())
                .limit(12)
            )
        ).scalars().all()
        return list(reversed(rows))

    async def _patient_context(self, conv: Conversation) -> str | None:
        if not conv.patient_id:
            return None
        patient = await self.db.get(Patient, conv.patient_id)
        if not patient:
            return None

        meds = (
            await self.db.execute(
                select(Medication).where(Medication.patient_id == patient.id).limit(6)
            )
        ).scalars().all()
        labs = (
            await self.db.execute(
                select(LabResult)
                .where(LabResult.patient_id == patient.id)
                .order_by(LabResult.collected_at.desc())
                .limit(4)
            )
        ).scalars().all()

        chunks: list[str] = []
        chunks.append(
            f"Patient: {patient.first_name} {patient.last_name}, "
            f"sex={patient.sex}, dob={patient.dob}"
        )
        if patient.procedure:
            chunks.append(f"Procedure on file: {patient.procedure}")
        if patient.condition_tag:
            chunks.append(f"Condition tag: {patient.condition_tag}")
        if meds:
            chunks.append(
                "Active meds: "
                + ", ".join(f"{m.name}" for m in meds if m.name)
            )
        if labs:
            chunks.append(
                "Recent labs: "
                + "; ".join(
                    f"{l.name}={l.value}{l.unit or ''}" for l in labs if l.name
                )
            )
        return "\n".join(chunks)

    def _build_prompt(
        self,
        conv: Conversation,
        msgs: list[Message],
        patient_ctx: str | None,
    ) -> str:
        lines: list[str] = []
        lines.append(
            f"Thread type: {conv.audience}. You are the clinician composing the reply."
        )
        if patient_ctx:
            lines.append("\nPatient chart context:")
            lines.append(patient_ctx)
        lines.append("\nRecent messages (oldest first):")
        for m in msgs[-8:]:
            who = "Me (clinician)" if m.sender_user_id else "Other party"
            lines.append(f"- {who}: {m.body}")
        lines.append(
            "\nDraft a single SMS-length reply. Do not greet again if the "
            "thread is mid-conversation. Output JSON only."
        )
        return "\n".join(lines)


def _fallback_reply(msgs: list[Message]) -> str:
    """Deterministic fallback when the LLM is unavailable.

    Picks one of a handful of generic replies based on the last incoming
    message's content — better than silent failure.
    """
    if not msgs:
        return "Thanks for reaching out — I'll review and get back to you."

    last = msgs[-1].body.lower()
    if any(kw in last for kw in ("appointment", "slot", "schedule", "book")):
        return (
            "Let me check the schedule and confirm a slot — I'll get back to "
            "you within the day."
        )
    if any(kw in last for kw in ("pain", "hurt", "ache", "sore", "fever")):
        return (
            "Thanks for the update. If symptoms worsen or you spike a fever, "
            "please call the clinic right away. I'll review and follow up."
        )
    if any(kw in last for kw in ("lab", "result", "report")):
        return (
            "I'll pull up the results and get back to you with what they "
            "show and any next steps."
        )
    if any(kw in last for kw in ("medication", "med ", "pill", "dose", "refill")):
        return (
            "Got it — let me review the chart and confirm the dosage before "
            "I send anything in writing."
        )
    return "Thanks — noted. I'll review and circle back shortly."
