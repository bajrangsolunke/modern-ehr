"""Patient-side AI helper. Right now it ships one feature:
suggesting 2-3 short reply drafts based on the latest staff message in
a conversation. Keep prompts patient-safe: no medical advice, no PHI
beyond what's already in the thread."""
from __future__ import annotations

import json
import re
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm import llm_client
from app.models.conversation import Conversation, Message
from app.models.patient import Patient
from app.models.user import User


SYSTEM_PROMPT = (
    "You help a patient reply to messages from their healthcare team in a "
    "secure portal. Generate 3 short, polite reply drafts (1-2 sentences each) "
    "that the patient can edit and send. Each draft should:\n"
    "- Be written in first person, as the patient.\n"
    "- Be clear, warm, and concise.\n"
    "- Cover a distinct stance: confirming, asking a clarifying question, or "
    "  scheduling-related, depending on what makes sense.\n"
    "- NEVER give medical advice. NEVER recommend dosages, treatments, or "
    "  diagnoses.\n"
    'Respond ONLY as a JSON object: {"suggestions": ["...", "...", "..."]}.'
)


class PatientAIService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def suggest_replies(
        self, conv_id: UUID, patient_id: UUID
    ) -> list[str]:
        conv = await self.db.get(Conversation, conv_id)
        if (
            conv is None
            or conv.audience != "patient"
            or conv.patient_id != patient_id
        ):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )

        # Use the last few turns as context — capped to keep tokens sane.
        msg_rows = (
            await self.db.execute(
                select(Message)
                .where(Message.conversation_id == conv.id)
                .order_by(Message.sent_at.desc())
                .limit(8)
            )
        ).scalars().all()
        msg_rows = list(reversed(msg_rows))

        if not msg_rows:
            return []

        patient = await self.db.get(Patient, patient_id)
        patient_name = patient.first_name if patient else "the patient"

        # Resolve staff names so the prompt is anchored.
        user_ids = {m.sender_user_id for m in msg_rows if m.sender_user_id}
        users = {}
        if user_ids:
            rows = (
                await self.db.execute(
                    select(User).where(User.id.in_(user_ids))
                )
            ).scalars().all()
            users = {u.id: u for u in rows}

        transcript_lines: list[str] = []
        for m in msg_rows:
            if m.sender_patient_id == patient_id:
                speaker = f"{patient_name} (you)"
            elif m.sender_user_id and m.sender_user_id in users:
                speaker = users[m.sender_user_id].full_name
            else:
                speaker = "Care team"
            transcript_lines.append(f"{speaker}: {m.body}")
        transcript = "\n".join(transcript_lines)

        user_prompt = (
            "Conversation so far:\n"
            f"{transcript}\n\n"
            f"Now suggest 3 short reply drafts {patient_name} could send next."
        )

        raw = await llm_client.chat(
            [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,
            max_tokens=400,
            json_mode=True,
        )

        return _parse_suggestions(raw)


def _parse_suggestions(raw: str) -> list[str]:
    """Tolerant parser: model may return JSON, or a JSON-in-text blob,
    or a list of dashes. We extract up to 3 distinct strings."""
    if not raw:
        return []
    text = raw.strip()

    # 1) Pure JSON object
    try:
        obj = json.loads(text)
        if isinstance(obj, dict) and isinstance(obj.get("suggestions"), list):
            return _clean([str(s) for s in obj["suggestions"]])
    except Exception:
        pass

    # 2) JSON embedded in prose
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        try:
            obj = json.loads(m.group(0))
            if isinstance(obj, dict) and isinstance(obj.get("suggestions"), list):
                return _clean([str(s) for s in obj["suggestions"]])
        except Exception:
            pass

    # 3) Bullet list fallback
    bullets = [
        line.lstrip("-*0123456789. ").strip()
        for line in text.splitlines()
        if line.strip()
    ]
    return _clean(bullets)


def _clean(items: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in items:
        s = raw.strip().strip('"').strip("'").strip()
        # Strip stub-mode prefix so the UI doesn't shout the disclaimer.
        if s.startswith("[AI stub]"):
            continue
        if not s or s in seen:
            continue
        seen.add(s)
        out.append(s)
        if len(out) >= 3:
            break
    return out
