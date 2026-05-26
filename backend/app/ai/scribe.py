"""AI scribe: turns conversation transcripts into structured SOAP notes."""
from __future__ import annotations

from app.ai.llm import llm_client


SYSTEM = """You are a clinical scribe. Convert the doctor-patient transcript into a SOAP note.
Output JSON keys: subjective, objective, assessment, plan. Be concise and clinically accurate."""


class ScribeService:
    async def transcript_to_soap(self, transcript: str) -> dict:
        import json

        raw = await llm_client.chat(
            messages=[
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": transcript},
            ],
            json_mode=True,
            max_tokens=600,
        )
        try:
            return json.loads(raw)
        except Exception:
            return {
                "subjective": "",
                "objective": "",
                "assessment": "Auto-parsing failed; manual review required.",
                "plan": "Edit SOAP note manually.",
            }
