"""SoapGeneratorService — sends a transcript to the LLM and parses
back a structured `{subjective, objective, assessment, plan}` draft.

The provider always reviews + edits before signing — we never write
to `soap_notes` directly from here. The endpoint just returns the
draft JSON to the FE.

HIPAA note: the LLM client currently routes to Groq, which does NOT
sign a BAA. Before production, route to a BAA-covered provider
(OpenAI direct, Azure OpenAI, or Bedrock). Easiest path: introduce a
`settings.SOAP_LLM_BACKEND` switch that routes only this call.
"""
from __future__ import annotations

import json
from uuid import UUID

from fastapi import HTTPException

from app.ai.llm import llm_client
from app.schemas.telehealth import SoapDraftOut
from app.services.telehealth_service import TelehealthService
from app.services.transcript_service import TranscriptService


SOAP_PROMPT = """You are a clinical scribe.

Given the transcript below of a telehealth visit between a Provider
and a Patient, generate a structured SOAP note as STRICT JSON with
exactly these keys: "subjective", "objective", "assessment", "plan".

Rules:
- "subjective" — patient's chief complaint, history of present
  illness, symptoms in their own words.
- "objective" — observable findings, mentioned vitals, exam
  findings. If no objective data was discussed, return "".
- "assessment" — provider's clinical impression / differential. If
  not stated, return "".
- "plan" — treatment, medications, follow-up, patient education.

Be concise (3–6 short sentences per section). Do not invent
information not present in the transcript. Output JSON only — no
preamble, no markdown fences.

Transcript:
---
{transcript}
---"""


class SoapGeneratorService:
    """Composes TelehealthService + TranscriptService + LLM call."""

    def __init__(self, db) -> None:
        self.db = db

    async def generate(self, session_id: UUID) -> SoapDraftOut:
        # Validate session exists (raises 404 via TelehealthService.get if not).
        await TelehealthService(self.db).get(session_id)
        segments = await TranscriptService(self.db).list_for_session(session_id)
        if not segments:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Transcript is empty — start the visit and let "
                    "the captions accumulate before generating a "
                    "SOAP note."
                ),
            )

        transcript = TranscriptService.format_for_llm(segments)
        word_count = sum(len(s.text.split()) for s in segments)

        prompt = SOAP_PROMPT.format(transcript=transcript)
        # `llm_client.chat()` is the existing thin async wrapper around
        # the configured provider (Groq / OpenAI / Ollama / stub).
        # Returns a string. The model id is configured globally.
        raw = await llm_client.chat(
            [
                {"role": "system", "content": "You output only JSON."},
                {"role": "user", "content": prompt},
            ],
            json_mode=True,
        )

        # The LLM occasionally wraps JSON in ``` fences despite the
        # instruction — strip them defensively.
        raw_text = raw.strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.strip("`")
            if raw_text.lower().startswith("json"):
                raw_text = raw_text[4:].lstrip()

        try:
            parsed = json.loads(raw_text)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"SOAP generation returned unparseable output: {exc}",
            ) from exc

        return SoapDraftOut(
            subjective=str(parsed.get("subjective", "")).strip(),
            objective=str(parsed.get("objective", "")).strip(),
            assessment=str(parsed.get("assessment", "")).strip(),
            plan=str(parsed.get("plan", "")).strip(),
            source_word_count=word_count,
            model=llm_client.chat_model,
        )
