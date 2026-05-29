"""TranscriptService — append-only ingest of speaker-attributed
segments arriving from the provider's browser during a Daily call.

Segments are stored ordered by `start_offset_ms` (ms since the
session's provider_started_at, supplied by the client). We don't
trust wall-clock from the client; the offset is monotonic per
participant and survives clock skew.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.telehealth import (
    SpeakerRole,
    TranscriptSegment,
)
from app.schemas.telehealth import TranscriptSegmentIn


class TranscriptService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def append_batch(
        self, session_id: UUID, segments: list[TranscriptSegmentIn]
    ) -> int:
        """Insert N segments in one flush. Returns count inserted."""
        rows = [
            TranscriptSegment(
                session_id=session_id,
                speaker_role=SpeakerRole(s.speaker_role),
                daily_participant_id=s.daily_participant_id,
                text=s.text.strip(),
                start_offset_ms=s.start_offset_ms,
            )
            for s in segments
            if s.text.strip()
        ]
        if not rows:
            return 0
        self.db.add_all(rows)
        await self.db.flush()
        return len(rows)

    async def list_for_session(
        self, session_id: UUID
    ) -> list[TranscriptSegment]:
        rows = (
            await self.db.execute(
                select(TranscriptSegment)
                .where(TranscriptSegment.session_id == session_id)
                .order_by(TranscriptSegment.start_offset_ms.asc())
            )
        ).scalars().all()
        return list(rows)

    @staticmethod
    def format_for_llm(segments: list[TranscriptSegment]) -> str:
        """Speaker-prefixed plain text the LLM can read top-to-bottom.

        Example:
            Provider: Tell me what brings you in today.
            Patient: I've had a headache for three days.
        """
        lines: list[str] = []
        for seg in segments:
            role = seg.speaker_role.value.capitalize()
            lines.append(f"{role}: {seg.text}")
        return "\n".join(lines)
