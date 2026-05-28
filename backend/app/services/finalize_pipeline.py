"""End-of-encounter pipeline: transcript → SOAP → ICD candidates →
catalog validate → visit summary. Each stage emits an SSE event on
the per-session bus; failures set session.status='failed' and persist
session.error_message but do NOT raise (this runs as a BackgroundTask
in Phase 2)."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm import llm_client
from app.ai.prompts.icd import ICD_SYSTEM_PROMPT
from app.ai.prompts.soap import SOAP_SYSTEM_PROMPT
from app.ai.prompts.summary import SUMMARY_SYSTEM_PROMPT
from app.core.logging import get_logger
from app.models.scribe_icd_suggestion import ScribeIcdSuggestion
from app.models.scribe_session import ScribeSession, ScribeSessionStatus
from app.models.scribe_soap_note import ScribeSoapNote
from app.schemas.scribe import (
    LlmIcdOutput,
    LlmSoapOutput,
    LlmSummaryOutput,
)
from app.services import scribe_event_bus
from app.services.icd_validator import validate_codes

log = get_logger(__name__)


class FinalizePipeline:
    """One-shot pipeline driver. Construct with a session_id + an
    AsyncSession factory (Phase 2 will pass session.scoped_session
    so the BackgroundTask gets its own connection), then call run()."""

    def __init__(self, db: AsyncSession, session_id: UUID) -> None:
        self.db = db
        self.session_id = session_id

    async def run(self) -> None:
        session = await self.db.get(ScribeSession, self.session_id)
        if session is None:
            scribe_event_bus.publish(
                self.session_id,
                "error",
                {"message": "Scribe session not found"},
            )
            return

        if not (session.transcript_text or "").strip():
            session.status = ScribeSessionStatus.failed
            session.error_message = "Cannot finalize: transcript is empty"
            await self.db.flush()
            scribe_event_bus.publish(
                self.session_id,
                "error",
                {"message": session.error_message},
            )
            scribe_event_bus.close(self.session_id)
            return

        session.status = ScribeSessionStatus.processing
        await self.db.flush()

        try:
            soap = await self._draft_soap(session.transcript_text)
            await self._persist_soap(soap)

            icd_raw = await self._draft_icds(soap)
            await self._persist_icds(icd_raw)

            summary = await self._draft_summary(session.transcript_text, soap)
            session.visit_summary = summary

            session.status = ScribeSessionStatus.completed
            session.completed_at = datetime.now(timezone.utc)
            await self.db.flush()

            scribe_event_bus.publish(self.session_id, "done", {})
        except Exception as exc:  # pragma: no cover — defensive
            log.error("scribe_finalize_failed", session_id=str(self.session_id), error=str(exc))
            session.status = ScribeSessionStatus.failed
            session.error_message = str(exc)[:1000]
            await self.db.flush()
            scribe_event_bus.publish(
                self.session_id, "error", {"message": session.error_message}
            )
        finally:
            scribe_event_bus.close(self.session_id)

    # --------------------------------------------------------- stages

    async def _draft_soap(self, transcript: str) -> LlmSoapOutput:
        scribe_event_bus.publish(
            self.session_id, "stage", {"name": "soap", "status": "started"}
        )
        raw = await llm_client.chat(
            messages=[
                {"role": "system", "content": SOAP_SYSTEM_PROMPT},
                {"role": "user", "content": transcript},
            ],
            json_mode=True,
            max_tokens=900,
        )
        soap = self._safe_parse_soap(raw)
        scribe_event_bus.publish(
            self.session_id, "stage", {"name": "soap", "status": "completed"}
        )
        return soap

    async def _persist_soap(self, soap: LlmSoapOutput) -> None:
        row = ScribeSoapNote(
            session_id=self.session_id,
            subjective=soap.subjective,
            objective=soap.objective,
            assessment=soap.assessment,
            plan=soap.plan,
        )
        self.db.add(row)
        await self.db.flush()

    async def _draft_icds(self, soap: LlmSoapOutput) -> LlmIcdOutput:
        scribe_event_bus.publish(
            self.session_id, "stage", {"name": "icd", "status": "started"}
        )
        # The model sees the SOAP (json_mode-safe input) — that's what
        # the codes should be derived from.
        soap_text = (
            f"Subjective: {soap.subjective}\n\n"
            f"Objective: {soap.objective}\n\n"
            f"Assessment: {soap.assessment}\n\n"
            f"Plan: {soap.plan}"
        )
        raw = await llm_client.chat(
            messages=[
                {"role": "system", "content": ICD_SYSTEM_PROMPT},
                {"role": "user", "content": soap_text},
            ],
            json_mode=True,
            max_tokens=600,
        )
        out = self._safe_parse_icd(raw)
        scribe_event_bus.publish(
            self.session_id, "stage", {"name": "icd", "status": "completed"}
        )
        return out

    async def _persist_icds(self, raw: LlmIcdOutput) -> None:
        validated = await validate_codes(self.db, raw.suggestions)
        for v in validated:
            self.db.add(
                ScribeIcdSuggestion(
                    session_id=self.session_id,
                    code=v.code,
                    description=v.description,
                    confidence=v.confidence,
                    reasoning=v.reasoning,
                    is_validated=v.is_validated,
                    accepted_by_user=False,
                )
            )
        await self.db.flush()

    async def _draft_summary(
        self, transcript: str, soap: LlmSoapOutput
    ) -> str:
        scribe_event_bus.publish(
            self.session_id, "stage", {"name": "summary", "status": "started"}
        )
        soap_text = (
            f"SOAP note:\nS: {soap.subjective}\nO: {soap.objective}\n"
            f"A: {soap.assessment}\nP: {soap.plan}\n\n"
            f"Transcript:\n{transcript}"
        )
        raw = await llm_client.chat(
            messages=[
                {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
                {"role": "user", "content": soap_text},
            ],
            json_mode=True,
            max_tokens=400,
        )
        summary = self._safe_parse_summary(raw)
        scribe_event_bus.publish(
            self.session_id, "stage", {"name": "summary", "status": "completed"}
        )
        return summary

    # ---------------------------------------------------- safe parsers

    @staticmethod
    def _safe_parse_soap(raw: str) -> LlmSoapOutput:
        try:
            return LlmSoapOutput.model_validate_json(raw)
        except Exception:
            try:
                return LlmSoapOutput.model_validate(json.loads(raw))
            except Exception:
                return LlmSoapOutput()

    @staticmethod
    def _safe_parse_icd(raw: str) -> LlmIcdOutput:
        try:
            return LlmIcdOutput.model_validate_json(raw)
        except Exception:
            try:
                return LlmIcdOutput.model_validate(json.loads(raw))
            except Exception:
                return LlmIcdOutput()

    @staticmethod
    def _safe_parse_summary(raw: str) -> str:
        try:
            return LlmSummaryOutput.model_validate_json(raw).summary.strip()
        except Exception:
            try:
                return LlmSummaryOutput.model_validate(json.loads(raw)).summary.strip()
            except Exception:
                return ""
