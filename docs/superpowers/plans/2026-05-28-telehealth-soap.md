# Telehealth + Live Transcript + SOAP Generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Daily.co-powered telehealth visits to the EHR with live transcription captured during the call and an LLM-generated SOAP note draft the provider can edit and sign — end-to-end across provider portal, patient portal, and backend.

**Architecture:**
- **Daily.co** for video + native transcription (HIPAA-covered via Daily HIPAA plan).
- **Provider's browser** subscribes to Daily's `transcription-message` events and POSTs each segment to the backend (single source of truth + survives client refresh).
- **Backend** stores `telehealth_sessions` and `transcript_segments`; when the provider clicks "Generate SOAP", the full transcript is sent to an LLM (Groq llama-3.3-70b for MVP, swap to OpenAI/Bedrock under BAA before production) which returns a structured `{subjective, objective, assessment, plan}` JSON.
- Generated draft pre-fills the existing `SoapNoteDrawer` — provider edits + signs in the existing flow.
- **Patient portal** shows a consent banner before join; consent is recorded before the room URL is released.

**User stories (provider):**
- US-TH-1: As a provider, I can click "Start telehealth visit" on an appointment to launch a Daily room with the patient.
- US-TH-2: As a provider, I see a live transcript pane next to the video so I can stay focused on the patient.
- US-TH-3: As a provider, I can click "End visit" to terminate the room and finalize the transcript.
- US-TH-4: As a provider, I can click "Generate SOAP draft" after the visit to auto-create a structured note from the transcript.
- US-TH-5: As a provider, I can edit the auto-generated SOAP before signing — nothing is finalized without my review.

**User stories (patient):**
- US-TH-6: As a patient, I see a "Join visit" button on my upcoming appointment in the patient portal.
- US-TH-7: As a patient, I am shown a clear consent banner ("This visit will be transcribed for your medical record") before joining; I must accept to continue.
- US-TH-8: As a patient, after consent I join the Daily call from the browser with no install required.

**User stories (admin / ops):**
- US-TH-9: As an admin, I configure the `DAILY_API_KEY` / `DAILY_DOMAIN` env vars once and every appointment can be a telehealth visit.

**Tech Stack:**
- Backend: FastAPI + SQLAlchemy 2.0 + Alembic + httpx (already in `requirements.txt`) + Pydantic v2
- LLM: existing Groq client (`app.ai.llm` → `chat_model = "llama-3.3-70b-versatile"`)
- Frontend: React + React Query + Daily.co JS SDK (`@daily-co/daily-js`)
- HIPAA: Daily HIPAA plan signed BAA covers video + transcription. LLM call: explicit follow-up to switch to BAA-covered provider before production (see Task 13 notes).

---

## File Structure

### Backend
- **Create** `modern-ehr/backend/app/models/telehealth.py` — `TelehealthSession`, `TranscriptSegment`, `TelehealthSessionStatus` enum
- **Create** `modern-ehr/backend/alembic/versions/0023_telehealth.py` — migration
- **Modify** `modern-ehr/backend/app/models/soap_note.py` — add nullable `telehealth_session_id` FK column
- **Create** `modern-ehr/backend/app/schemas/telehealth.py` — Pydantic DTOs
- **Modify** `modern-ehr/backend/app/core/config.py` — add `DAILY_API_KEY`, `DAILY_DOMAIN`, `DAILY_WEBHOOK_SECRET`
- **Create** `modern-ehr/backend/app/services/daily_client.py` — thin httpx wrapper for Daily REST (create room, create meeting token, delete room)
- **Create** `modern-ehr/backend/app/services/telehealth_service.py` — session lifecycle (create / get / end)
- **Create** `modern-ehr/backend/app/services/transcript_service.py` — append + read segments
- **Create** `modern-ehr/backend/app/services/soap_generator_service.py` — LLM prompt + parse
- **Create** `modern-ehr/backend/app/api/v1/endpoints/telehealth.py` — provider endpoints
- **Modify** `modern-ehr/backend/app/api/v1/endpoints/patient_portal.py` — add 2 patient telehealth endpoints
- **Modify** `modern-ehr/backend/app/api/v1/router.py` — register telehealth router

### Frontend (provider portal)
- **Create** `modern-ehr/frontend/src/features/telehealth/api/telehealth-api.ts`
- **Create** `modern-ehr/frontend/src/features/telehealth/hooks/use-telehealth.ts`
- **Create** `modern-ehr/frontend/src/features/telehealth/components/TelehealthCall.tsx` — Daily iframe wrapper
- **Create** `modern-ehr/frontend/src/features/telehealth/components/LiveTranscript.tsx` — scrolling speaker-attributed transcript
- **Create** `modern-ehr/frontend/src/features/telehealth/components/TelehealthModal.tsx` — modal shell that holds call + transcript + end button
- **Modify** `modern-ehr/frontend/src/features/appointments/components/AppointmentDetailsModal.tsx` — "Start telehealth visit" button
- **Modify** `modern-ehr/frontend/src/features/patients/components/SoapNoteDrawer.tsx` — accept `prefill` prop
- **Add npm dep** `@daily-co/daily-js` to `frontend/package.json`

### Frontend (patient portal)
- **Create** `modern-ehr/patient-portal/src/features/telehealth/api/telehealth-api.ts`
- **Create** `modern-ehr/patient-portal/src/features/telehealth/components/ConsentBanner.tsx`
- **Create** `modern-ehr/patient-portal/src/features/telehealth/components/PatientTelehealthCall.tsx`
- **Create** `modern-ehr/patient-portal/src/features/telehealth/PatientTelehealthPage.tsx`
- **Modify** `modern-ehr/patient-portal/src/app/router.tsx` (or equivalent) — add `/telehealth/:appointmentId` route
- **Modify** patient appointments list — surface "Join visit" button for telehealth appointments
- **Add npm dep** `@daily-co/daily-js` to `patient-portal/package.json`

---

## Task 1: Backend config — Daily.co env vars

**Files:**
- Modify: `modern-ehr/backend/app/core/config.py`

- [ ] **Step 1: Add the three settings**

In `modern-ehr/backend/app/core/config.py`, find the `Settings` class and add to it:

```python
    # Daily.co — telehealth + transcription. The HIPAA plan signs a
    # BAA that covers BOTH video and Deepgram-backed transcription.
    DAILY_API_KEY: str = ""
    DAILY_DOMAIN: str = ""  # e.g. "modern-ehr.daily.co"
    # Daily signs webhook payloads with this shared secret — keep blank
    # in dev to disable signature verification (logged warning).
    DAILY_WEBHOOK_SECRET: str = ""
```

- [ ] **Step 2: Update `.env.example`**

Append to `modern-ehr/backend/.env.example`:

```
# Daily.co (telehealth + transcription). Leave blank in dev unless
# you have a Daily account with a HIPAA plan + BAA.
DAILY_API_KEY=
DAILY_DOMAIN=
DAILY_WEBHOOK_SECRET=
```

- [ ] **Step 3: Commit**

```bash
git add modern-ehr/backend/app/core/config.py modern-ehr/backend/.env.example
git commit -m "feat(telehealth): add DAILY_* config settings"
```

---

## Task 2: Backend migration — `telehealth_sessions` + `transcript_segments`

**Files:**
- Create: `modern-ehr/backend/alembic/versions/0023_telehealth.py`

- [ ] **Step 1: Create the migration file**

```python
"""telehealth sessions + transcript segments

Revision ID: 0023_telehealth
Revises: 0022_lab_source_document
Create Date: 2026-05-28

Adds two tables:
  * telehealth_sessions — one row per video visit, owned by an
    appointment. Holds the Daily room name/URL, lifecycle status,
    consent + start/end timestamps.
  * transcript_segments — one row per speaker-attributed utterance.
    Append-only; we never edit a segment after the client posts it.

Also extends `soap_notes` with a nullable `telehealth_session_id`
FK so generated drafts trace back to their source transcript.
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op


revision: str = "0023_telehealth"
down_revision: Union[str, None] = "0022_lab_source_document"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SESSION_STATUS = sa.Enum(
    "scheduled",
    "patient_consented",
    "active",
    "ended",
    "cancelled",
    name="telehealth_session_status",
)
SPEAKER_ROLE = sa.Enum(
    "provider",
    "patient",
    "unknown",
    name="telehealth_speaker_role",
)


def upgrade() -> None:
    SESSION_STATUS.create(op.get_bind(), checkfirst=True)
    SPEAKER_ROLE.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "telehealth_sessions",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "appointment_id",
            sa.UUID(),
            sa.ForeignKey("appointments.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("daily_room_name", sa.String(96), nullable=False, unique=True),
        sa.Column("daily_room_url", sa.String(512), nullable=False),
        sa.Column("status", SESSION_STATUS, nullable=False, server_default="scheduled"),
        sa.Column("patient_consented_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("provider_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_telehealth_sessions_status",
        "telehealth_sessions",
        ["status"],
    )

    op.create_table(
        "transcript_segments",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "session_id",
            sa.UUID(),
            sa.ForeignKey("telehealth_sessions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("speaker_role", SPEAKER_ROLE, nullable=False),
        sa.Column("daily_participant_id", sa.String(96), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("start_offset_ms", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_transcript_segments_session_start",
        "transcript_segments",
        ["session_id", "start_offset_ms"],
    )

    op.add_column(
        "soap_notes",
        sa.Column(
            "telehealth_session_id",
            sa.UUID(),
            sa.ForeignKey("telehealth_sessions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("soap_notes", "telehealth_session_id")
    op.drop_index(
        "ix_transcript_segments_session_start", table_name="transcript_segments"
    )
    op.drop_table("transcript_segments")
    op.drop_index(
        "ix_telehealth_sessions_status", table_name="telehealth_sessions"
    )
    op.drop_table("telehealth_sessions")
    SPEAKER_ROLE.drop(op.get_bind(), checkfirst=True)
    SESSION_STATUS.drop(op.get_bind(), checkfirst=True)
```

- [ ] **Step 2: Run the migration**

```bash
cd modern-ehr/backend && source .venv/bin/activate && alembic upgrade head
```

Expected output: `Running upgrade 0022_lab_source_document -> 0023_telehealth, telehealth sessions + transcript segments`

- [ ] **Step 3: Commit**

```bash
git add modern-ehr/backend/alembic/versions/0023_telehealth.py
git commit -m "feat(telehealth): migration 0023 — telehealth_sessions + transcript_segments"
```

---

## Task 3: Backend models — Telehealth + TranscriptSegment

**Files:**
- Create: `modern-ehr/backend/app/models/telehealth.py`
- Modify: `modern-ehr/backend/app/models/soap_note.py`

- [ ] **Step 1: Write the models file**

Create `modern-ehr/backend/app/models/telehealth.py`:

```python
from __future__ import annotations

import enum
from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin, TimestampMixin


class TelehealthSessionStatus(str, enum.Enum):
    """Lifecycle of a telehealth visit. `scheduled` until patient
    consents; `active` once the provider joins; `ended` after the
    provider clicks End. `cancelled` is for visits that never started."""

    scheduled = "scheduled"
    patient_consented = "patient_consented"
    active = "active"
    ended = "ended"
    cancelled = "cancelled"


class SpeakerRole(str, enum.Enum):
    provider = "provider"
    patient = "patient"
    unknown = "unknown"


class TelehealthSession(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "telehealth_sessions"

    appointment_id: Mapped[UUID] = mapped_column(
        ForeignKey("appointments.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    # Short opaque room id from Daily — used to build the room URL +
    # as the joinable name in the iframe.
    daily_room_name: Mapped[str] = mapped_column(String(96), nullable=False, unique=True)
    daily_room_url: Mapped[str] = mapped_column(String(512), nullable=False)
    status: Mapped[TelehealthSessionStatus] = mapped_column(
        Enum(TelehealthSessionStatus, name="telehealth_session_status"),
        default=TelehealthSessionStatus.scheduled,
        nullable=False,
        index=True,
    )
    patient_consented_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    provider_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    segments: Mapped[list["TranscriptSegment"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="TranscriptSegment.start_offset_ms",
    )


class TranscriptSegment(Base, UUIDMixin):
    __tablename__ = "transcript_segments"

    session_id: Mapped[UUID] = mapped_column(
        ForeignKey("telehealth_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    speaker_role: Mapped[SpeakerRole] = mapped_column(
        Enum(SpeakerRole, name="telehealth_speaker_role"),
        nullable=False,
    )
    # Daily's `participantId` — we keep it so we can correlate
    # multiple segments from the same speaker even if their human
    # role isn't resolved at insert time.
    daily_participant_id: Mapped[str | None] = mapped_column(String(96))
    text: Mapped[str] = mapped_column(Text, nullable=False)
    # Milliseconds since the session's provider_started_at — used to
    # order the transcript deterministically without relying on
    # wall-clock timestamps from the client.
    start_offset_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    session: Mapped[TelehealthSession] = relationship(back_populates="segments")
```

- [ ] **Step 2: Add the FK on `SoapNote`**

In `modern-ehr/backend/app/models/soap_note.py`, find the `SoapNote` class and add the column near the other FK columns:

```python
    # Set when this SOAP note was generated from a telehealth visit's
    # transcript. Lets us trace the draft back to its source.
    telehealth_session_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("telehealth_sessions.id", ondelete="SET NULL"),
        nullable=True,
    )
```

Also add `from uuid import UUID` if not already present and `from sqlalchemy import ForeignKey` if needed.

- [ ] **Step 3: Verify imports**

```bash
cd modern-ehr/backend && source .venv/bin/activate
python3 -c "
from app.models.telehealth import TelehealthSession, TranscriptSegment, TelehealthSessionStatus, SpeakerRole
from app.models.soap_note import SoapNote
print('OK')
print('SoapNote has telehealth_session_id:', hasattr(SoapNote, 'telehealth_session_id'))
"
```

Expected: `OK\nSoapNote has telehealth_session_id: True`

- [ ] **Step 4: Commit**

```bash
git add modern-ehr/backend/app/models/telehealth.py modern-ehr/backend/app/models/soap_note.py
git commit -m "feat(telehealth): TelehealthSession + TranscriptSegment models"
```

---

## Task 4: Backend schemas — Pydantic DTOs

**Files:**
- Create: `modern-ehr/backend/app/schemas/telehealth.py`

- [ ] **Step 1: Write the schema file**

```python
"""Pydantic DTOs for the telehealth endpoints."""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


SessionStatusLiteral = Literal[
    "scheduled", "patient_consented", "active", "ended", "cancelled"
]
SpeakerRoleLiteral = Literal["provider", "patient", "unknown"]


class TranscriptSegmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    speaker_role: SpeakerRoleLiteral
    text: str
    start_offset_ms: int
    created_at: datetime


class TranscriptSegmentIn(BaseModel):
    """One transcript chunk posted by the provider's browser as Daily
    fires `transcription-message` events. We accept multiple per
    request to keep the network chatty under control."""

    speaker_role: SpeakerRoleLiteral = "unknown"
    daily_participant_id: str | None = None
    text: str = Field(min_length=1, max_length=8000)
    start_offset_ms: int = Field(ge=0)


class TranscriptBatchIn(BaseModel):
    segments: list[TranscriptSegmentIn] = Field(min_length=1, max_length=50)


class TelehealthSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    appointment_id: UUID
    daily_room_url: str
    daily_room_name: str
    status: SessionStatusLiteral
    patient_consented_at: datetime | None = None
    provider_started_at: datetime | None = None
    ended_at: datetime | None = None
    created_at: datetime


class TelehealthSessionWithTokenOut(TelehealthSessionOut):
    """Returned to the provider on session create. The meeting token
    is short-lived (~2h) so we mint a fresh one per session.

    Not returned anywhere else — tokens never leave the create
    response. The patient gets their own token via the consent
    endpoint."""

    meeting_token: str


class PatientConsentOut(BaseModel):
    """Returned to the patient after they accept the consent prompt.
    The token + url let them join the call."""

    session_id: UUID
    daily_room_url: str
    meeting_token: str


class SoapDraftOut(BaseModel):
    """LLM-generated SOAP draft. The provider edits + signs in the
    existing SoapNoteDrawer UI; nothing is persisted to soap_notes
    until they save."""

    subjective: str = ""
    objective: str = ""
    assessment: str = ""
    plan: str = ""
    # The transcript word count we sent to the LLM — useful for
    # debugging short visits with sparse drafts.
    source_word_count: int = 0
    model: str
```

- [ ] **Step 2: Verify imports**

```bash
cd modern-ehr/backend && source .venv/bin/activate
python3 -c "
from app.schemas.telehealth import (
    TelehealthSessionOut, TelehealthSessionWithTokenOut, PatientConsentOut,
    TranscriptBatchIn, TranscriptSegmentOut, SoapDraftOut
)
print('schemas OK')
"
```

Expected: `schemas OK`

- [ ] **Step 3: Commit**

```bash
git add modern-ehr/backend/app/schemas/telehealth.py
git commit -m "feat(telehealth): Pydantic DTOs for telehealth + transcript"
```

---

## Task 5: Backend Daily.co REST client

**Files:**
- Create: `modern-ehr/backend/app/services/daily_client.py`

- [ ] **Step 1: Write the client**

```python
"""Thin async wrapper around the Daily.co REST API.

We use only three endpoints:
  * POST /rooms — create a fresh room per appointment
  * POST /meeting-tokens — mint a short-lived join token per user
  * DELETE /rooms/{name} — clean up after the call ends

`enable_transcription_storage` is OFF — we don't want Daily to keep
a copy. Our backend already stores every transcript segment in our
own DB, which is HIPAA-controlled.
"""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import settings


DAILY_API = "https://api.daily.co/v1"


class DailyClient:
    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or settings.DAILY_API_KEY
        if not self.api_key:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Telehealth is not configured. Set DAILY_API_KEY in "
                    "the backend env."
                ),
            )

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def create_room(self, *, ttl_seconds: int = 60 * 60 * 4) -> dict[str, Any]:
        """Create a private room with transcription enabled.

        `ttl_seconds` is wall-clock; rooms auto-delete after this
        even if we forget to call `delete_room`. Default = 4h, enough
        for the longest realistic appointment + buffer.
        """
        # 12-char URL-safe random name → unguessable, fits well in URLs
        name = secrets.token_urlsafe(9)  # ~12 chars
        exp = int(
            (datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)).timestamp()
        )
        payload = {
            "name": name,
            "privacy": "private",
            "properties": {
                "exp": exp,
                "enable_chat": False,
                "enable_screenshare": True,
                "enable_knocking": True,
                "enable_transcription_storage": False,
                "transcription_provider": "deepgram",
            },
        }
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(
                f"{DAILY_API}/rooms",
                json=payload,
                headers=self._headers(),
            )
        if res.status_code >= 400:
            raise HTTPException(
                status_code=502,
                detail=f"Daily.co create_room failed: {res.text}",
            )
        return res.json()

    async def create_meeting_token(
        self,
        *,
        room_name: str,
        user_name: str,
        is_owner: bool,
        ttl_seconds: int = 60 * 60 * 2,
    ) -> str:
        """Mint a short-lived join token. `is_owner=True` for the
        provider — only owners can start/stop transcription, eject
        participants, etc."""
        exp = int(
            (datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)).timestamp()
        )
        payload = {
            "properties": {
                "room_name": room_name,
                "user_name": user_name,
                "is_owner": is_owner,
                "exp": exp,
            }
        }
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(
                f"{DAILY_API}/meeting-tokens",
                json=payload,
                headers=self._headers(),
            )
        if res.status_code >= 400:
            raise HTTPException(
                status_code=502,
                detail=f"Daily.co create_meeting_token failed: {res.text}",
            )
        return res.json()["token"]

    async def delete_room(self, room_name: str) -> None:
        """Best-effort cleanup — we don't fail the End-visit flow if
        Daily returns 404 (room already auto-expired)."""
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.delete(
                f"{DAILY_API}/rooms/{room_name}",
                headers=self._headers(),
            )
        if res.status_code not in (200, 204, 404):
            # Log only — don't bubble an error to the user.
            from structlog import get_logger
            get_logger().warning(
                "daily.delete_room_failed",
                room_name=room_name,
                status=res.status_code,
                body=res.text[:200],
            )
```

- [ ] **Step 2: Verify it imports**

```bash
cd modern-ehr/backend && source .venv/bin/activate
python3 -c "from app.services.daily_client import DailyClient; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add modern-ehr/backend/app/services/daily_client.py
git commit -m "feat(telehealth): Daily.co REST client (create_room + token + delete)"
```

---

## Task 6: Backend `TelehealthService` — session lifecycle

**Files:**
- Create: `modern-ehr/backend/app/services/telehealth_service.py`

- [ ] **Step 1: Write the service**

```python
"""TelehealthService — owns the lifecycle of a telehealth session.

Each appointment can have at most one session row (unique FK). The
service is intentionally narrow: create, get, end. Transcript
ingestion lives in TranscriptService; SOAP generation in
SoapGeneratorService.
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment
from app.models.telehealth import (
    TelehealthSession,
    TelehealthSessionStatus,
)
from app.services.daily_client import DailyClient


class TelehealthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_or_create_for_appointment(
        self, *, appointment_id: UUID, provider_id: UUID, provider_name: str
    ) -> tuple[TelehealthSession, str]:
        """Idempotent: returns the existing session if one is already
        attached to the appointment; otherwise creates a new Daily
        room + DB row. Returns the session + the provider's join token
        (which is freshly minted every call — tokens are short-lived
        so we don't reuse them)."""
        appt = await self.db.get(Appointment, appointment_id)
        if appt is None:
            raise HTTPException(status_code=404, detail="Appointment not found")

        session = (
            await self.db.execute(
                select(TelehealthSession).where(
                    TelehealthSession.appointment_id == appointment_id
                )
            )
        ).scalar_one_or_none()

        client = DailyClient()
        if session is None:
            room = await client.create_room()
            session = TelehealthSession(
                appointment_id=appointment_id,
                daily_room_name=room["name"],
                daily_room_url=room["url"],
                status=TelehealthSessionStatus.scheduled,
            )
            self.db.add(session)
            await self.db.flush()

        # Mint a fresh provider token regardless — even on re-open.
        token = await client.create_meeting_token(
            room_name=session.daily_room_name,
            user_name=provider_name or "Provider",
            is_owner=True,
        )
        # Mark active on join — the visit has "started" when the
        # provider opens the call window.
        if session.provider_started_at is None:
            session.provider_started_at = datetime.now(timezone.utc)
        if session.status == TelehealthSessionStatus.patient_consented:
            session.status = TelehealthSessionStatus.active
        await self.db.flush()
        return session, token

    async def get(self, session_id: UUID) -> TelehealthSession:
        s = await self.db.get(TelehealthSession, session_id)
        if s is None:
            raise HTTPException(status_code=404, detail="Session not found")
        return s

    async def consent_and_mint_patient_token(
        self,
        *,
        appointment_id: UUID,
        patient_id: UUID,
        patient_name: str,
    ) -> tuple[TelehealthSession, str]:
        """Patient accepted the consent banner. Records the consent
        timestamp and mints a non-owner join token.

        If the session doesn't exist yet (provider hasn't clicked
        Start), we create it here — patient-initiated join is OK as
        long as the appointment is real and belongs to them."""
        appt = await self.db.get(Appointment, appointment_id)
        if appt is None or appt.patient_id != patient_id:
            raise HTTPException(status_code=404, detail="Appointment not found")

        session = (
            await self.db.execute(
                select(TelehealthSession).where(
                    TelehealthSession.appointment_id == appointment_id
                )
            )
        ).scalar_one_or_none()

        client = DailyClient()
        if session is None:
            room = await client.create_room()
            session = TelehealthSession(
                appointment_id=appointment_id,
                daily_room_name=room["name"],
                daily_room_url=room["url"],
                status=TelehealthSessionStatus.scheduled,
            )
            self.db.add(session)
            await self.db.flush()

        if session.patient_consented_at is None:
            session.patient_consented_at = datetime.now(timezone.utc)
        if session.status == TelehealthSessionStatus.scheduled:
            session.status = TelehealthSessionStatus.patient_consented
        await self.db.flush()

        token = await client.create_meeting_token(
            room_name=session.daily_room_name,
            user_name=patient_name or "Patient",
            is_owner=False,
        )
        return session, token

    async def end(self, session_id: UUID) -> TelehealthSession:
        s = await self.get(session_id)
        if s.status == TelehealthSessionStatus.ended:
            return s  # idempotent
        s.status = TelehealthSessionStatus.ended
        s.ended_at = datetime.now(timezone.utc)
        await self.db.flush()
        # Best-effort room cleanup — failures are logged inside the
        # client and don't bubble up.
        try:
            await DailyClient().delete_room(s.daily_room_name)
        except Exception:  # noqa: BLE001
            pass
        return s
```

- [ ] **Step 2: Verify imports**

```bash
cd modern-ehr/backend && source .venv/bin/activate
python3 -c "from app.services.telehealth_service import TelehealthService; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add modern-ehr/backend/app/services/telehealth_service.py
git commit -m "feat(telehealth): TelehealthService session lifecycle"
```

---

## Task 7: Backend `TranscriptService` — segment ingestion

**Files:**
- Create: `modern-ehr/backend/app/services/transcript_service.py`

- [ ] **Step 1: Write the service**

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add modern-ehr/backend/app/services/transcript_service.py
git commit -m "feat(telehealth): TranscriptService — append + format for LLM"
```

---

## Task 8: Backend `SoapGeneratorService` — LLM call

**Files:**
- Create: `modern-ehr/backend/app/services/soap_generator_service.py`

- [ ] **Step 1: Inspect the existing LLM client**

```bash
cd modern-ehr/backend && grep -n "def chat\|chat_model\|class " app/ai/llm.py | head -10
```

Note the function signature you'll call — the plan assumes `chat(messages, model=None)`. If the actual function differs, adjust the call site in Step 2.

- [ ] **Step 2: Write the service**

```python
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

from app.ai.llm import chat
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
        session = await TelehealthService(self.db).get(session_id)
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
        # `chat()` is the existing thin client around the Groq SDK.
        # Returns a string. The model id is configured globally.
        raw = await chat(
            [
                {"role": "system", "content": "You output only JSON."},
                {"role": "user", "content": prompt},
            ]
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
            model="llama-3.3-70b-versatile",  # mirrors app/ai/llm.py
        )
```

- [ ] **Step 3: Verify imports**

```bash
cd modern-ehr/backend && source .venv/bin/activate
python3 -c "from app.services.soap_generator_service import SoapGeneratorService; print('OK')"
```

Expected: `OK`. If you see `ImportError: cannot import name 'chat'`, inspect `app/ai/llm.py` and replace the import + call in Step 2 with the actual chat function name (e.g. `complete`, `generate`).

- [ ] **Step 4: Commit**

```bash
git add modern-ehr/backend/app/services/soap_generator_service.py
git commit -m "feat(telehealth): SoapGeneratorService — LLM-driven SOAP draft"
```

---

## Task 9: Backend endpoints — provider telehealth routes

**Files:**
- Create: `modern-ehr/backend/app/api/v1/endpoints/telehealth.py`
- Modify: `modern-ehr/backend/app/api/v1/router.py`

- [ ] **Step 1: Write the endpoints**

Create `modern-ehr/backend/app/api/v1/endpoints/telehealth.py`:

```python
"""Telehealth endpoints (provider-side).

Patient-side endpoints live in `endpoints/patient_portal.py` to keep
the auth boundary (CurrentUser vs CurrentPatient) clear.
"""
from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.telehealth import (
    SoapDraftOut,
    TelehealthSessionOut,
    TelehealthSessionWithTokenOut,
    TranscriptBatchIn,
    TranscriptSegmentOut,
)
from app.services.soap_generator_service import SoapGeneratorService
from app.services.telehealth_service import TelehealthService
from app.services.transcript_service import TranscriptService


router = APIRouter(prefix="/telehealth", tags=["telehealth"])


@router.post(
    "/sessions/by-appointment/{appointment_id}",
    response_model=TelehealthSessionWithTokenOut,
    status_code=status.HTTP_201_CREATED,
)
async def start_or_get_session(
    appointment_id: UUID,
    db: DbSession,
    current: CurrentUser,
) -> TelehealthSessionWithTokenOut:
    """Provider clicks 'Start telehealth visit' on an appointment.
    Idempotent — returns the existing session if one is attached,
    otherwise creates a fresh room. Mints a new provider join token
    every time."""
    name = current.full_name or current.email
    session, token = await TelehealthService(db).get_or_create_for_appointment(
        appointment_id=appointment_id,
        provider_id=current.id,
        provider_name=name,
    )
    return TelehealthSessionWithTokenOut(
        **TelehealthSessionOut.model_validate(session).model_dump(),
        meeting_token=token,
    )


@router.get(
    "/sessions/{session_id}",
    response_model=TelehealthSessionOut,
)
async def get_session(
    session_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001 — auth gate
) -> TelehealthSessionOut:
    return TelehealthSessionOut.model_validate(
        await TelehealthService(db).get(session_id)
    )


@router.post("/sessions/{session_id}/end", response_model=TelehealthSessionOut)
async def end_session(
    session_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
) -> TelehealthSessionOut:
    return TelehealthSessionOut.model_validate(
        await TelehealthService(db).end(session_id)
    )


@router.post(
    "/sessions/{session_id}/transcript",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def append_transcript(
    session_id: UUID,
    payload: TranscriptBatchIn,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
) -> None:
    await TranscriptService(db).append_batch(session_id, payload.segments)


@router.get(
    "/sessions/{session_id}/transcript",
    response_model=list[TranscriptSegmentOut],
)
async def get_transcript(
    session_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
) -> list[TranscriptSegmentOut]:
    rows = await TranscriptService(db).list_for_session(session_id)
    return [TranscriptSegmentOut.model_validate(r) for r in rows]


@router.post(
    "/sessions/{session_id}/generate-soap",
    response_model=SoapDraftOut,
)
async def generate_soap(
    session_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
) -> SoapDraftOut:
    return await SoapGeneratorService(db).generate(session_id)
```

- [ ] **Step 2: Register the router**

Edit `modern-ehr/backend/app/api/v1/router.py`. In the import block add `telehealth`:

```python
from app.api.v1.endpoints import (
    ...,
    tasks,
    telehealth,
    ...,
)
```

After `api_router.include_router(dashboard.router)` (or wherever feels natural), add:

```python
api_router.include_router(telehealth.router)
```

- [ ] **Step 3: Verify imports**

```bash
cd modern-ehr/backend && source .venv/bin/activate
python3 -c "
from app.api.v1.endpoints.telehealth import router
from app.api.v1.router import api_router
print('router OK')
print('routes:', [r.path for r in router.routes])
"
```

Expected: prints 6 telehealth routes.

- [ ] **Step 4: Commit**

```bash
git add modern-ehr/backend/app/api/v1/endpoints/telehealth.py modern-ehr/backend/app/api/v1/router.py
git commit -m "feat(telehealth): provider endpoints + router wiring"
```

---

## Task 10: Backend endpoints — patient consent + join

**Files:**
- Modify: `modern-ehr/backend/app/api/v1/endpoints/patient_portal.py`

- [ ] **Step 1: Add the patient telehealth endpoints**

In `modern-ehr/backend/app/api/v1/endpoints/patient_portal.py`, add the import:

```python
from app.schemas.telehealth import PatientConsentOut
from app.services.telehealth_service import TelehealthService
```

Then append (after the existing conversation endpoints):

```python
@router.post(
    "/me/telehealth/{appointment_id}/consent",
    response_model=PatientConsentOut,
)
async def consent_to_telehealth(
    appointment_id: UUID,
    db: DbSession,
    current: CurrentPatient,
) -> PatientConsentOut:
    """Patient accepts the consent banner. Records the timestamp and
    mints a Daily join token. The frontend then opens the iframe
    with `daily_room_url` + `meeting_token`."""
    name = f"{current.first_name} {current.last_name}".strip() or "Patient"
    session, token = await TelehealthService(db).consent_and_mint_patient_token(
        appointment_id=appointment_id,
        patient_id=current.id,
        patient_name=name,
    )
    return PatientConsentOut(
        session_id=session.id,
        daily_room_url=session.daily_room_url,
        meeting_token=token,
    )
```

- [ ] **Step 2: Verify imports**

```bash
cd modern-ehr/backend && source .venv/bin/activate
python3 -c "from app.api.v1.endpoints.patient_portal import router; print('OK', [r.path for r in router.routes if 'telehealth' in r.path])"
```

Expected: prints the new `/me/telehealth/{appointment_id}/consent` route.

- [ ] **Step 3: Commit**

```bash
git add modern-ehr/backend/app/api/v1/endpoints/patient_portal.py
git commit -m "feat(telehealth): patient-portal consent + join endpoint"
```

---

## Task 11: Backend smoke test — start session → append transcript → generate SOAP

**Files:**
- Create: `modern-ehr/backend/tests/test_telehealth_smoke.py`

This test exercises the whole backend pipeline with the LLM mocked out, so it runs in CI without Daily credentials.

- [ ] **Step 1: Write the test**

```python
"""End-to-end smoke for telehealth lifecycle. Mocks Daily REST + the
LLM so the test runs without external credentials."""
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.models.appointment import Appointment, AppointmentStatus
from app.models.patient import Patient
from app.models.telehealth import (
    TelehealthSession,
    TelehealthSessionStatus,
    TranscriptSegment,
    SpeakerRole,
)
from app.schemas.telehealth import TranscriptSegmentIn
from app.services.soap_generator_service import SoapGeneratorService
from app.services.telehealth_service import TelehealthService
from app.services.transcript_service import TranscriptService


@pytest.mark.asyncio
async def test_telehealth_pipeline(db_session, factory_user):
    # Arrange — a patient + appointment + provider.
    provider = await factory_user(role="provider")
    patient = Patient(
        first_name="Test",
        last_name="Patient",
        mrn="MRN-TH-001",
    )
    db_session.add(patient)
    await db_session.flush()
    appt = Appointment(
        patient_id=patient.id,
        physician_id=provider.id,
        starts_at=__import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ),
        duration_min=30,
        status=AppointmentStatus.scheduled,
        appointment_type="telehealth",
    )
    db_session.add(appt)
    await db_session.flush()

    # Mock Daily.
    fake_room = {"name": "abc123xyz", "url": "https://x.daily.co/abc123xyz"}
    with patch(
        "app.services.daily_client.DailyClient.create_room",
        new=AsyncMock(return_value=fake_room),
    ), patch(
        "app.services.daily_client.DailyClient.create_meeting_token",
        new=AsyncMock(return_value="tok_test"),
    ), patch(
        "app.services.daily_client.DailyClient.delete_room",
        new=AsyncMock(return_value=None),
    ):
        # Act 1 — provider starts session.
        session, token = await TelehealthService(
            db_session
        ).get_or_create_for_appointment(
            appointment_id=appt.id,
            provider_id=provider.id,
            provider_name="Dr. Test",
        )
        assert session.daily_room_name == "abc123xyz"
        assert token == "tok_test"
        assert session.status == TelehealthSessionStatus.active

        # Act 2 — append a few segments.
        n = await TranscriptService(db_session).append_batch(
            session.id,
            [
                TranscriptSegmentIn(
                    speaker_role="provider",
                    text="What brings you in today?",
                    start_offset_ms=0,
                ),
                TranscriptSegmentIn(
                    speaker_role="patient",
                    text="I've had a headache for three days.",
                    start_offset_ms=3500,
                ),
            ],
        )
        assert n == 2

        # Act 3 — generate SOAP, mocking the LLM.
        with patch(
            "app.services.soap_generator_service.chat",
            new=AsyncMock(
                return_value='{"subjective": "3-day headache.", '
                '"objective": "", '
                '"assessment": "Headache, etiology TBD.", '
                '"plan": "Rest, fluids, follow up in 1w."}'
            ),
        ):
            draft = await SoapGeneratorService(db_session).generate(session.id)
        assert "headache" in draft.subjective.lower()
        assert draft.source_word_count > 0

        # Act 4 — end session.
        ended = await TelehealthService(db_session).end(session.id)
        assert ended.status == TelehealthSessionStatus.ended
        assert ended.ended_at is not None
```

- [ ] **Step 2: Run the test**

```bash
cd modern-ehr/backend && source .venv/bin/activate
pytest tests/test_telehealth_smoke.py -v
```

Expected: 1 passed. If `factory_user` doesn't exist in your conftest, adapt the fixture name to match the project's existing user factory.

- [ ] **Step 3: Commit**

```bash
git add modern-ehr/backend/tests/test_telehealth_smoke.py
git commit -m "test(telehealth): pipeline smoke — start → transcript → SOAP → end"
```

---

## Task 12: Frontend (provider) — npm dep + API client

**Files:**
- Modify: `modern-ehr/frontend/package.json`
- Create: `modern-ehr/frontend/src/features/telehealth/api/telehealth-api.ts`

- [ ] **Step 1: Install Daily.co SDK**

```bash
cd modern-ehr/frontend && npm install @daily-co/daily-js
```

- [ ] **Step 2: Write the API client**

Create `modern-ehr/frontend/src/features/telehealth/api/telehealth-api.ts`:

```ts
/**
 * Typed client for the provider telehealth endpoints.
 */
import { api } from "@/lib/api-client";

export type TelehealthSessionStatus =
  | "scheduled"
  | "patient_consented"
  | "active"
  | "ended"
  | "cancelled";

export type SpeakerRole = "provider" | "patient" | "unknown";

export interface TelehealthSession {
  id: string;
  appointmentId: string;
  dailyRoomUrl: string;
  dailyRoomName: string;
  status: TelehealthSessionStatus;
  patientConsentedAt: string | null;
  providerStartedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

export interface TelehealthSessionWithToken extends TelehealthSession {
  meetingToken: string;
}

export interface TranscriptSegment {
  id: string;
  sessionId: string;
  speakerRole: SpeakerRole;
  text: string;
  startOffsetMs: number;
  createdAt: string;
}

export interface TranscriptSegmentIn {
  speaker_role: SpeakerRole;
  daily_participant_id?: string | null;
  text: string;
  start_offset_ms: number;
}

export interface SoapDraft {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  sourceWordCount: number;
  model: string;
}

interface BackendSessionDto {
  id: string;
  appointment_id: string;
  daily_room_url: string;
  daily_room_name: string;
  status: TelehealthSessionStatus;
  patient_consented_at: string | null;
  provider_started_at: string | null;
  ended_at: string | null;
  created_at: string;
  meeting_token?: string;
}

interface BackendSegmentDto {
  id: string;
  session_id: string;
  speaker_role: SpeakerRole;
  text: string;
  start_offset_ms: number;
  created_at: string;
}

interface BackendDraftDto {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  source_word_count: number;
  model: string;
}

function mapSession(dto: BackendSessionDto): TelehealthSessionWithToken {
  return {
    id: dto.id,
    appointmentId: dto.appointment_id,
    dailyRoomUrl: dto.daily_room_url,
    dailyRoomName: dto.daily_room_name,
    status: dto.status,
    patientConsentedAt: dto.patient_consented_at,
    providerStartedAt: dto.provider_started_at,
    endedAt: dto.ended_at,
    createdAt: dto.created_at,
    meetingToken: dto.meeting_token ?? "",
  };
}

function mapSegment(dto: BackendSegmentDto): TranscriptSegment {
  return {
    id: dto.id,
    sessionId: dto.session_id,
    speakerRole: dto.speaker_role,
    text: dto.text,
    startOffsetMs: dto.start_offset_ms,
    createdAt: dto.created_at,
  };
}

export const telehealthApi = {
  startOrGet: async (
    appointmentId: string,
  ): Promise<TelehealthSessionWithToken> => {
    const dto = await api.post<BackendSessionDto>(
      `/telehealth/sessions/by-appointment/${appointmentId}`,
    );
    return mapSession(dto);
  },

  end: async (sessionId: string): Promise<TelehealthSession> => {
    const dto = await api.post<BackendSessionDto>(
      `/telehealth/sessions/${sessionId}/end`,
    );
    return mapSession(dto);
  },

  appendTranscript: (
    sessionId: string,
    segments: TranscriptSegmentIn[],
  ): Promise<void> =>
    api.post<void>(`/telehealth/sessions/${sessionId}/transcript`, {
      segments,
    }),

  listTranscript: async (sessionId: string): Promise<TranscriptSegment[]> => {
    const rows = await api.get<BackendSegmentDto[]>(
      `/telehealth/sessions/${sessionId}/transcript`,
    );
    return rows.map(mapSegment);
  },

  generateSoap: async (sessionId: string): Promise<SoapDraft> => {
    const dto = await api.post<BackendDraftDto>(
      `/telehealth/sessions/${sessionId}/generate-soap`,
    );
    return {
      subjective: dto.subjective,
      objective: dto.objective,
      assessment: dto.assessment,
      plan: dto.plan,
      sourceWordCount: dto.source_word_count,
      model: dto.model,
    };
  },
};
```

- [ ] **Step 3: Type check**

```bash
cd modern-ehr/frontend && ./node_modules/.bin/tsc -b 2>&1 | grep telehealth || echo "OK"
```

Expected: `OK` (no errors in telehealth files).

- [ ] **Step 4: Commit**

```bash
git add modern-ehr/frontend/package.json modern-ehr/frontend/package-lock.json modern-ehr/frontend/src/features/telehealth/api/telehealth-api.ts
git commit -m "feat(telehealth/web): npm dep + api client"
```

---

## Task 13: Frontend (provider) — `useTelehealth` hook

**Files:**
- Create: `modern-ehr/frontend/src/features/telehealth/hooks/use-telehealth.ts`

- [ ] **Step 1: Write the hook**

```ts
/**
 * React Query hook layer for telehealth. The TelehealthModal owns the
 * Daily call object; this hook handles session creation + the
 * transcript poll fallback + SOAP generation mutation.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { telehealthApi } from "../api/telehealth-api";

const TELEHEALTH_KEY = ["telehealth"] as const;

export function useStartTelehealth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (appointmentId: string) =>
      telehealthApi.startOrGet(appointmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TELEHEALTH_KEY });
    },
  });
}

export function useEndTelehealth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => telehealthApi.end(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TELEHEALTH_KEY });
    },
  });
}

/**
 * Polls the transcript every 2s as a fallback against the client
 * losing a few `transcription-message` events. Stops once the
 * caller passes `enabled: false` (call ended).
 */
export function useTranscript(sessionId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...TELEHEALTH_KEY, "transcript", sessionId],
    queryFn: () => telehealthApi.listTranscript(sessionId as string),
    enabled: Boolean(sessionId) && enabled,
    refetchInterval: enabled ? 2_000 : false,
  });
}

export function useGenerateSoap() {
  return useMutation({
    mutationFn: (sessionId: string) => telehealthApi.generateSoap(sessionId),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add modern-ehr/frontend/src/features/telehealth/hooks/use-telehealth.ts
git commit -m "feat(telehealth/web): React Query hooks"
```

---

## Task 14: Frontend (provider) — `<LiveTranscript>` component

**Files:**
- Create: `modern-ehr/frontend/src/features/telehealth/components/LiveTranscript.tsx`

- [ ] **Step 1: Write the component**

```tsx
/**
 * Scrolling, speaker-attributed transcript pane displayed next to
 * the Daily iframe. Auto-scrolls to the bottom on new segments
 * unless the user has scrolled up.
 */
import { useEffect, useRef } from "react";
import { Stethoscope, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TranscriptSegment } from "../api/telehealth-api";

interface Props {
  segments: TranscriptSegment[];
}

export function LiveTranscript({ segments }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      // "stuck to bottom" if within 80px of the floor
      stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (stickRef.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [segments.length]);

  return (
    <div className="flex flex-col h-full bg-slate-50/40 border-l border-border">
      <div className="px-4 py-3 border-b border-border bg-white">
        <h3 className="text-sm font-semibold">Live transcript</h3>
        <p className="text-[11px] text-muted-foreground">
          Captions update as you speak.
        </p>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {segments.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-12">
            Waiting for the first caption…
          </div>
        ) : (
          segments.map((s) => <Bubble key={s.id} segment={s} />)
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function Bubble({ segment }: { segment: TranscriptSegment }) {
  const isProvider = segment.speakerRole === "provider";
  const isPatient = segment.speakerRole === "patient";
  return (
    <div className="flex items-start gap-2">
      <div
        className={cn(
          "size-7 rounded-full grid place-items-center shrink-0 [&_svg]:size-3.5 ring-1",
          isProvider
            ? "bg-primary/10 text-primary ring-primary/20"
            : isPatient
              ? "bg-success/10 text-success ring-success/20"
              : "bg-muted text-muted-foreground ring-border",
        )}
      >
        {isProvider ? <Stethoscope /> : <UserIcon />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {segment.speakerRole}
        </div>
        <div className="text-sm leading-snug">{segment.text}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add modern-ehr/frontend/src/features/telehealth/components/LiveTranscript.tsx
git commit -m "feat(telehealth/web): LiveTranscript component"
```

---

## Task 15: Frontend (provider) — `<TelehealthModal>` with Daily iframe

**Files:**
- Create: `modern-ehr/frontend/src/features/telehealth/components/TelehealthModal.tsx`

This is the biggest single component — it owns the Daily call object, subscribes to transcription events, batches them to the backend, and renders the iframe + transcript side-by-side.

- [ ] **Step 1: Write the component**

```tsx
/**
 * The provider's telehealth call window — a Daily iframe on the left,
 * <LiveTranscript> on the right, with End / Generate SOAP buttons
 * along the bottom.
 *
 * Transcription:
 *   1. Provider clicks "Start visit" → we mint a session + token.
 *   2. Daily iframe joins the room with `subscribeToTracksAutomatically`.
 *   3. We call `startTranscription({ tier: 'nova' })` once the call
 *      object reports `joined-meeting`.
 *   4. Each `transcription-message` event is buffered and flushed to
 *      the backend in 1.5s windows so we don't post once per word.
 *
 * The local buffer is the source of truth for the FE display until
 * the backend poll catches up — keeps the UX feeling instant even on
 * slow networks.
 */
import { useEffect, useRef, useState } from "react";
import DailyIframe, {
  type DailyCall,
  type DailyEventObjectTranscriptionMessage,
} from "@daily-co/daily-js";
import { Loader2, PhoneOff, Sparkles, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  useEndTelehealth,
  useGenerateSoap,
  useTranscript,
} from "../hooks/use-telehealth";
import {
  type SoapDraft,
  type TelehealthSessionWithToken,
  type TranscriptSegmentIn,
  telehealthApi,
} from "../api/telehealth-api";
import { LiveTranscript } from "./LiveTranscript";
import { toast } from "@/lib/toast";

interface Props {
  open: boolean;
  session: TelehealthSessionWithToken | null;
  /** Current viewer's user id — used so we tag our own transcription
   *  messages as `provider` immediately, without waiting for the
   *  backend to resolve roles. */
  viewerUserId: string | undefined;
  onClose: () => void;
  onDraftGenerated: (draft: SoapDraft) => void;
}

const FLUSH_INTERVAL_MS = 1500;

export function TelehealthModal({
  open,
  session,
  viewerUserId,
  onClose,
  onDraftGenerated,
}: Props) {
  const callRef = useRef<DailyCall | null>(null);
  const startedAtRef = useRef<number>(0);
  const bufferRef = useRef<TranscriptSegmentIn[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const ownParticipantIdRef = useRef<string | null>(null);
  const [joining, setJoining] = useState(false);

  const end = useEndTelehealth();
  const generate = useGenerateSoap();
  const { data: transcript = [] } = useTranscript(
    session?.id ?? null,
    open && session?.status !== "ended",
  );

  // Mount / unmount the Daily call object alongside the modal.
  useEffect(() => {
    if (!open || !session) return;

    const iframeContainer = document.getElementById("daily-iframe-mount");
    if (!iframeContainer) return;

    setJoining(true);
    const call = DailyIframe.createFrame(iframeContainer, {
      iframeStyle: {
        width: "100%",
        height: "100%",
        border: "0",
        borderRadius: "12px",
      },
      showLeaveButton: false,
      showFullscreenButton: true,
    });
    callRef.current = call;
    startedAtRef.current = Date.now();

    call.on("joined-meeting", (evt) => {
      setJoining(false);
      ownParticipantIdRef.current = evt?.participants?.local?.session_id ?? null;
      // Start Deepgram-backed transcription. Only owners can do this;
      // the provider's token is_owner=true.
      call.startTranscription({ tier: "nova" }).catch((e) => {
        toast.error("Couldn't start transcription", {
          description: e instanceof Error ? e.message : undefined,
        });
      });
    });

    const onTranscript = (evt: DailyEventObjectTranscriptionMessage) => {
      const text = (evt.text || "").trim();
      if (!text) return;
      const offset = Math.max(0, Date.now() - startedAtRef.current);
      const isOwn = evt.participantId === ownParticipantIdRef.current;
      bufferRef.current.push({
        speaker_role: isOwn ? "provider" : "patient",
        daily_participant_id: evt.participantId,
        text,
        start_offset_ms: offset,
      });
    };
    call.on("transcription-message", onTranscript);

    call
      .join({ url: session.dailyRoomUrl, token: session.meetingToken })
      .catch((e) => {
        setJoining(false);
        toast.error("Failed to join the call", {
          description: e instanceof Error ? e.message : undefined,
        });
      });

    flushTimerRef.current = window.setInterval(() => {
      const buf = bufferRef.current;
      if (!buf.length || !session) return;
      bufferRef.current = [];
      telehealthApi
        .appendTranscript(session.id, buf)
        .catch(() => {
          // Don't drop on failure — re-queue at the front so the
          // next flush retries.
          bufferRef.current = [...buf, ...bufferRef.current];
        });
    }, FLUSH_INTERVAL_MS);

    return () => {
      if (flushTimerRef.current !== null) {
        window.clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      call.off("transcription-message", onTranscript);
      call.leave().catch(() => {});
      call.destroy().catch(() => {});
      callRef.current = null;
    };
    // viewerUserId is only used to label; deps stay narrow to avoid
    // re-mounting the call on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session?.id]);

  const handleEnd = async () => {
    if (!session) return;
    try {
      await callRef.current?.stopTranscription();
    } catch {
      /* swallow */
    }
    // Flush any buffered chunks one last time.
    const buf = bufferRef.current;
    if (buf.length > 0) {
      bufferRef.current = [];
      await telehealthApi.appendTranscript(session.id, buf).catch(() => {});
    }
    await end.mutateAsync(session.id);
    onClose();
  };

  const handleGenerate = async () => {
    if (!session) return;
    try {
      const draft = await generate.mutateAsync(session.id);
      onDraftGenerated(draft);
      toast.success("SOAP draft ready", {
        description: "Review and sign in the note drawer.",
      });
    } catch (e) {
      toast.error("Couldn't generate SOAP", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Telehealth visit"
      size="xl"
      footer={
        <div className="flex items-center justify-between gap-2 w-full">
          <Button
            variant="secondary"
            onClick={handleGenerate}
            disabled={generate.isPending}
            className="h-10"
          >
            {generate.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Generate SOAP draft
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} className="h-10">
              <X className="size-4" /> Minimize
            </Button>
            <Button
              onClick={handleEnd}
              disabled={end.isPending}
              className="h-10 bg-danger hover:bg-danger/90"
            >
              {end.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PhoneOff className="size-4" />
              )}
              End visit
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-3 h-[60vh] min-h-[420px]">
        <div className="relative rounded-2xl overflow-hidden bg-slate-900">
          <div id="daily-iframe-mount" className="absolute inset-0" />
          {joining && (
            <div className="absolute inset-0 grid place-items-center bg-slate-900/80 text-white">
              <Loader2 className="size-6 animate-spin" />
            </div>
          )}
        </div>
        <LiveTranscript segments={transcript} />
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Type check**

```bash
cd modern-ehr/frontend && ./node_modules/.bin/tsc -b 2>&1 | grep -E "TelehealthModal|telehealth" | tail -10 || echo "OK"
```

If you see a Daily SDK type error like `DailyEventObjectTranscriptionMessage` is not exported, the SDK's type names occasionally change between minor versions. Replace with:

```ts
type DailyEventObjectTranscriptionMessage = {
  text?: string;
  participantId?: string;
};
```

- [ ] **Step 3: Commit**

```bash
git add modern-ehr/frontend/src/features/telehealth/components/TelehealthModal.tsx
git commit -m "feat(telehealth/web): TelehealthModal with Daily iframe + live transcript"
```

---

## Task 16: Frontend (provider) — wire "Start telehealth visit" into AppointmentDetailsModal

**Files:**
- Modify: `modern-ehr/frontend/src/features/appointments/components/AppointmentDetailsModal.tsx`

- [ ] **Step 1: Find the action row + add the button**

In `AppointmentDetailsModal.tsx`, inside the action button cluster (next to "Edit appointment" / status controls), add:

```tsx
<Button
  onClick={() => setTelehealthOpen(true)}
  className="h-9 bg-info hover:bg-info/90"
>
  <Video className="size-3.5" />
  Start telehealth visit
</Button>
```

Add the icon import at the top:

```tsx
import { Video } from "lucide-react";
```

Hold the modal state + the kicked-off session:

```tsx
import { useState } from "react";
import { useStartTelehealth } from "@/features/telehealth/hooks/use-telehealth";
import { TelehealthModal } from "@/features/telehealth/components/TelehealthModal";
import type { TelehealthSessionWithToken, SoapDraft } from "@/features/telehealth/api/telehealth-api";

// inside the component:
const [telehealthOpen, setTelehealthOpen] = useState(false);
const [tSession, setTSession] = useState<TelehealthSessionWithToken | null>(null);
const start = useStartTelehealth();

const openTelehealth = async () => {
  try {
    const session = await start.mutateAsync(appointment.id);
    setTSession(session);
    setTelehealthOpen(true);
  } catch (e) {
    toast.error("Couldn't start visit", {
      description: e instanceof Error ? e.message : undefined,
    });
  }
};
```

Wire the button's `onClick` to `openTelehealth` (not the local setter):

```tsx
onClick={openTelehealth}
disabled={start.isPending}
```

At the bottom of the modal's JSX (next to where `<DenyDialog>` lives, before the closing `</Modal>` if any):

```tsx
<TelehealthModal
  open={telehealthOpen}
  session={tSession}
  viewerUserId={currentUser?.id}
  onClose={() => setTelehealthOpen(false)}
  onDraftGenerated={(draft) => {
    // Caller stores the draft + opens SoapNoteDrawer pre-filled.
    // For now, log it; Task 17 wires it into the drawer.
    console.info("SOAP draft", draft);
  }}
/>
```

Add `useAuthStore` access if not already present:

```tsx
import { useAuthStore } from "@/stores/auth-store";
const currentUser = useAuthStore((s) => s.user);
```

- [ ] **Step 2: Type check**

```bash
cd modern-ehr/frontend && ./node_modules/.bin/tsc -b 2>&1 | grep AppointmentDetailsModal || echo "OK"
```

Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add modern-ehr/frontend/src/features/appointments/components/AppointmentDetailsModal.tsx
git commit -m "feat(telehealth/web): Start telehealth visit button in AppointmentDetailsModal"
```

---

## Task 17: Frontend (provider) — pre-fill `SoapNoteDrawer` from the draft

**Files:**
- Modify: `modern-ehr/frontend/src/features/patients/components/SoapNoteDrawer.tsx`
- Modify: `modern-ehr/frontend/src/features/appointments/components/AppointmentDetailsModal.tsx`

- [ ] **Step 1: Add a `prefill` prop to `SoapNoteDrawer`**

In `SoapNoteDrawer.tsx`, find the Props interface and add:

```ts
  /** Optional pre-filled draft (e.g. from telehealth SOAP generation).
   *  When provided, the four fields seed on first open; user can
   *  freely edit before saving. */
  prefill?: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  } | null;
```

In the component body where the existing `useState`/`useForm` sets initial values, add a `useEffect` that re-seeds the form fields when `prefill` changes and the drawer is opening:

```tsx
useEffect(() => {
  if (open && prefill) {
    reset({
      subjective: prefill.subjective,
      objective: prefill.objective,
      assessment: prefill.assessment,
      plan: prefill.plan,
    });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [open, prefill]);
```

(If the drawer doesn't use react-hook-form, replace `reset(...)` with the equivalent `setX` setters.)

- [ ] **Step 2: Wire the draft → drawer in `AppointmentDetailsModal`**

In `AppointmentDetailsModal.tsx`, add another piece of state:

```tsx
const [pendingDraft, setPendingDraft] = useState<SoapDraft | null>(null);
const [soapOpen, setSoapOpen] = useState(false);
```

Update `onDraftGenerated` in the `<TelehealthModal>` to:

```tsx
onDraftGenerated={(draft) => {
  setPendingDraft(draft);
  setTelehealthOpen(false);
  setSoapOpen(true);
}}
```

Mount the SOAP drawer below:

```tsx
<SoapNoteDrawer
  open={soapOpen}
  onOpenChange={(o) => {
    setSoapOpen(o);
    if (!o) setPendingDraft(null);
  }}
  patientId={appointment.patientId}
  encounterId={appointment.encounterId ?? undefined}
  prefill={pendingDraft}
/>
```

If `SoapNoteDrawer` props differ from these names, adapt to the actual signature.

- [ ] **Step 3: Type check**

```bash
cd modern-ehr/frontend && ./node_modules/.bin/tsc -b 2>&1 | grep -E "SoapNoteDrawer|AppointmentDetailsModal" || echo "OK"
```

Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add modern-ehr/frontend/src/features/patients/components/SoapNoteDrawer.tsx modern-ehr/frontend/src/features/appointments/components/AppointmentDetailsModal.tsx
git commit -m "feat(telehealth/web): pre-fill SoapNoteDrawer from generated draft"
```

---

## Task 18: Patient portal — npm dep + API client

**Files:**
- Modify: `modern-ehr/patient-portal/package.json`
- Create: `modern-ehr/patient-portal/src/features/telehealth/api/telehealth-api.ts`

- [ ] **Step 1: Install Daily.co SDK**

```bash
cd modern-ehr/patient-portal && npm install @daily-co/daily-js
```

- [ ] **Step 2: Write the API client**

```ts
import { api } from "@/lib/api-client";

export interface PatientConsent {
  session_id: string;
  daily_room_url: string;
  meeting_token: string;
}

export const telehealthApi = {
  consent: (appointmentId: string): Promise<PatientConsent> =>
    api.post<PatientConsent>(
      `/patient-portal/me/telehealth/${appointmentId}/consent`,
    ),
};
```

- [ ] **Step 3: Commit**

```bash
git add modern-ehr/patient-portal/package.json modern-ehr/patient-portal/package-lock.json modern-ehr/patient-portal/src/features/telehealth/api/telehealth-api.ts
git commit -m "feat(telehealth/patient): npm dep + consent api client"
```

---

## Task 19: Patient portal — `<ConsentBanner>` component

**Files:**
- Create: `modern-ehr/patient-portal/src/features/telehealth/components/ConsentBanner.tsx`

- [ ] **Step 1: Write the component**

```tsx
/**
 * Pre-call consent screen. Patient must read + accept before we
 * release the Daily join token. The text below is intentionally
 * plain-English — check with legal before production.
 */
import { ShieldCheck, Video } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  providerName?: string;
  busy?: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function ConsentBanner({
  providerName = "your care team",
  busy = false,
  onAccept,
  onDecline,
}: Props) {
  return (
    <div className="max-w-xl mx-auto rounded-3xl bg-white ring-1 ring-slate-200/80 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.18)] p-8 space-y-5">
      <div className="flex items-center gap-3">
        <span className="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center">
          <Video className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Telehealth visit with {providerName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Before you join, please review the consent below.
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm leading-relaxed space-y-2">
        <p className="font-semibold inline-flex items-center gap-2">
          <ShieldCheck className="size-4 text-success" />
          This visit will be transcribed for your medical record.
        </p>
        <p className="text-muted-foreground">
          The audio is converted to text in real time and saved to your chart.
          The video itself is <strong>not</strong> recorded. You can leave the
          call at any time. The transcript is treated as protected health
          information and stored under the same HIPAA safeguards as the rest
          of your chart.
        </p>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" onClick={onDecline} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={onAccept} disabled={busy} className="h-10">
          I accept — join the visit
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add modern-ehr/patient-portal/src/features/telehealth/components/ConsentBanner.tsx
git commit -m "feat(telehealth/patient): consent banner component"
```

---

## Task 20: Patient portal — `<PatientTelehealthCall>` + page

**Files:**
- Create: `modern-ehr/patient-portal/src/features/telehealth/components/PatientTelehealthCall.tsx`
- Create: `modern-ehr/patient-portal/src/features/telehealth/PatientTelehealthPage.tsx`
- Modify: patient-portal router (`src/app/router.tsx` or equivalent) — add `/telehealth/:appointmentId` route

- [ ] **Step 1: Write the call component**

`PatientTelehealthCall.tsx`:

```tsx
/**
 * Patient-side Daily iframe. No transcript pane (patient doesn't
 * need to see captions in this build), no End button — patient
 * leaves the call by closing the tab or hitting the iframe's
 * built-in leave button.
 */
import { useEffect, useRef } from "react";
import DailyIframe, { type DailyCall } from "@daily-co/daily-js";

interface Props {
  roomUrl: string;
  token: string;
  patientName?: string;
}

export function PatientTelehealthCall({
  roomUrl,
  token,
  patientName,
}: Props) {
  const callRef = useRef<DailyCall | null>(null);

  useEffect(() => {
    const mount = document.getElementById("patient-daily-mount");
    if (!mount) return;
    const call = DailyIframe.createFrame(mount, {
      iframeStyle: {
        width: "100%",
        height: "100%",
        border: "0",
        borderRadius: "16px",
      },
      showLeaveButton: true,
      showFullscreenButton: true,
      userName: patientName,
    });
    callRef.current = call;
    call.join({ url: roomUrl, token }).catch(() => {});

    return () => {
      call.leave().catch(() => {});
      call.destroy().catch(() => {});
      callRef.current = null;
    };
  }, [roomUrl, token, patientName]);

  return <div id="patient-daily-mount" className="w-full h-full" />;
}
```

- [ ] **Step 2: Write the page**

`PatientTelehealthPage.tsx`:

```tsx
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { toast } from "@/lib/toast";
import { telehealthApi, type PatientConsent } from "./api/telehealth-api";
import { ConsentBanner } from "./components/ConsentBanner";
import { PatientTelehealthCall } from "./components/PatientTelehealthCall";

export function PatientTelehealthPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const [consent, setConsent] = useState<PatientConsent | null>(null);
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    if (!appointmentId) return;
    setBusy(true);
    try {
      const res = await telehealthApi.consent(appointmentId);
      setConsent(res);
    } catch (e) {
      toast.error("Couldn't start the visit", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Video visit" />
      {!consent ? (
        <ConsentBanner
          busy={busy}
          onAccept={accept}
          onDecline={() => navigate("/")}
        />
      ) : (
        <div className="h-[calc(100vh-180px)] min-h-[420px] rounded-3xl overflow-hidden ring-1 ring-slate-200/80 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.18)] bg-slate-900">
          {busy ? (
            <div className="grid place-items-center h-full text-white">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : (
            <PatientTelehealthCall
              roomUrl={consent.daily_room_url}
              token={consent.meeting_token}
            />
          )}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Register the route**

In `modern-ehr/patient-portal/src/app/router.tsx` (path may vary — find the file that defines patient-portal routes), import the page and add:

```tsx
import { PatientTelehealthPage } from "@/features/telehealth/PatientTelehealthPage";

// inside the <Routes>:
<Route path="/telehealth/:appointmentId" element={<PatientTelehealthPage />} />
```

- [ ] **Step 4: Commit**

```bash
git add modern-ehr/patient-portal/src/features/telehealth modern-ehr/patient-portal/src/app/router.tsx
git commit -m "feat(telehealth/patient): consent + Daily call page"
```

---

## Task 21: Patient portal — surface "Join visit" on the appointment row

**Files:**
- Modify: the patient appointments page/component that lists upcoming appointments (likely `modern-ehr/patient-portal/src/features/appointments/AppointmentsPage.tsx` or similar; locate via `grep -rn "Upcoming" patient-portal/src/features/appointments`)

- [ ] **Step 1: Find the appointment row component**

```bash
cd /home/ttpl-lnv-0264/Modern-EHR-Design/modern-ehr/patient-portal && \
  grep -rn "appointment_type\|appointmentType\|telehealth\|Upcoming" src/features/appointments | head -10
```

Identify the file that renders the upcoming appointment row.

- [ ] **Step 2: Add the Join button**

For each appointment row where the appointment is in the future and the type is telehealth (or always, if the schema doesn't yet have an `appointment_type` enum), add:

```tsx
{isUpcoming && (
  <Button
    size="sm"
    onClick={() => navigate(`/telehealth/${appointment.id}`)}
  >
    <Video className="size-3.5" /> Join visit
  </Button>
)}
```

`isUpcoming` = `new Date(appointment.starts_at).getTime() > Date.now() - 15 * 60_000` (allow 15min early join). Adapt to the actual field names.

- [ ] **Step 3: Commit**

```bash
git add modern-ehr/patient-portal/src/features/appointments
git commit -m "feat(telehealth/patient): Join visit button on upcoming appointments"
```

---

## Task 22: Verification — end-to-end manual smoke

**Files:** none

- [ ] **Step 1: Set DAILY_* env vars**

Create a Daily.co account, generate an API key, fill in `modern-ehr/backend/.env`:

```
DAILY_API_KEY=<your key>
DAILY_DOMAIN=<your-team>.daily.co
DAILY_WEBHOOK_SECRET=
```

Restart the backend.

- [ ] **Step 2: Start backend + both frontends**

```bash
# Terminal 1
cd modern-ehr/backend && source .venv/bin/activate && uvicorn app.main:app --reload

# Terminal 2
cd modern-ehr/frontend && npm run dev

# Terminal 3
cd modern-ehr/patient-portal && npm run dev
```

- [ ] **Step 3: Provider flow**

1. Log in as Dr. Robert Fox on the provider portal.
2. Open an appointment with a patient.
3. Click **Start telehealth visit**. Modal opens with Daily iframe.
4. Verify your camera + mic come up.
5. Speak — within a few seconds, captions appear in the right pane labeled `provider`.

- [ ] **Step 4: Patient flow**

1. In another browser / incognito, log in as the same appointment's patient on the patient portal.
2. Click **Join visit** on the upcoming appointment.
3. See the consent banner. Click **I accept**.
4. Daily iframe loads, patient joins. Both sides see each other.
5. Speak as the patient — provider's transcript shows your text labeled `patient`.

- [ ] **Step 5: SOAP draft**

1. Have a 30-second mock conversation: provider asks "What brings you in?" → patient describes symptoms → provider says "I'd recommend rest and a follow-up in 1 week."
2. On the provider side, click **Generate SOAP draft**.
3. Within ~10s, the SoapNoteDrawer opens pre-filled. Verify the four sections are non-empty and clinically reasonable.
4. Edit a field, click Save. Confirm the saved note appears under the patient's Notes tab.

- [ ] **Step 6: End the visit**

1. Click **End visit** on the provider side.
2. Verify the modal closes, the patient's iframe drops the connection.
3. In the backend, query `SELECT status, ended_at FROM telehealth_sessions ORDER BY created_at DESC LIMIT 1;` — should show `ended` + a timestamp.

- [ ] **Step 7: Commit any final tweaks**

```bash
git status
# only commit if there are real changes from verification
```

---

## Self-Review

**1. Spec coverage:**
- US-TH-1 (provider start) → Task 9 (endpoint) + Task 16 (button) ✅
- US-TH-2 (live transcript) → Task 14 (LiveTranscript) + Task 15 (subscription + buffer) ✅
- US-TH-3 (end visit) → Task 6 + Task 9 + Task 15 ✅
- US-TH-4 (generate SOAP) → Task 8 + Task 9 + Task 15 + Task 17 ✅
- US-TH-5 (edit before sign) → Task 17 (drawer pre-fill, existing save flow) ✅
- US-TH-6 (patient join button) → Task 21 ✅
- US-TH-7 (consent banner) → Task 19 + Task 20 ✅
- US-TH-8 (browser join) → Task 20 (Daily iframe) ✅
- US-TH-9 (admin config) → Task 1 ✅

**2. Placeholder scan:** No "TBD"/"implement later" in steps. The only "investigate"-style step is Task 8 Step 1 (inspect existing LLM client) — that's a deliberate guard rail because the LLM function name varies by codebase, not a punt.

**3. Type consistency:**
- `TelehealthSession` field names match between model (Task 3), schema (Task 4), and FE type (Task 12).
- `TranscriptSegmentIn` payload shape matches between FE (Task 12) and backend schema (Task 4).
- `meeting_token` is snake_case on the wire (Task 9, Task 10) and `meetingToken` after the FE mapper (Task 12).
- `dailyRoomUrl` consistent.
- `SoapDraft` field names match across Task 4, Task 8, Task 12, Task 17.

---

## Notes for the executor

- **HIPAA reminder:** the LLM call in Task 8 currently routes through Groq. Before any production launch, switch to a BAA-covered LLM provider. See the docstring on `SoapGeneratorService` for the suggested switch path.
- **Cost guardrails:** Daily transcription is ~$0.043/min. A misconfigured environment that keeps transcription running across multiple long-abandoned rooms can rack up bills. The 4h room TTL in `DailyClient.create_room` is the safety net; don't relax it without thinking through ops cost.
- **Webhook (not in MVP):** Daily can push a final transcript file to a webhook when transcription stops. We chose client-streamed segments instead because (a) we already have the segments live for the UI, (b) webhooks need public ingress + signature verification. If you later want webhook-based redundancy, add a new endpoint `POST /telehealth/webhooks/transcript-complete` that downloads + parses the .vtt file.
- **One existing file (`app/ai/llm.py`) might use a different export name than `chat`.** Task 8 Step 1 explicitly asks the executor to look, so they catch this before writing the import.
