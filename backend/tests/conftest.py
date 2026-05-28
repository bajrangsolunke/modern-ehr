"""Root test fixtures.

Provides:
  - db_session  : an AsyncSession connected to the real dev DB, rolled back
                  after each test so tests are isolated.
  - sample_patient : a minimal Patient row persisted within the test transaction.
  - provider_user  : a provider-role User row for form workflow tests.
  - submitted_intake_form : a submitted intake FormRequest ready to be approved.
"""
from __future__ import annotations

import uuid
from datetime import date

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.db.base import Base
from app.models.patient import Patient  # noqa: F401 — ensures mapper is set up


# ---------------------------------------------------------------------------
# Engine / session factory (module-scoped so the pool is shared)
# ---------------------------------------------------------------------------

_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    pool_pre_ping=True,
)

_async_session = async_sessionmaker(
    _engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


# ---------------------------------------------------------------------------
# db_session — one transaction per test, rolled back at the end
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture()
async def db_session() -> AsyncSession:
    """Yield an AsyncSession whose transaction is rolled back after the test."""
    async with _engine.connect() as conn:
        await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False)
        try:
            yield session
        finally:
            await session.close()
            await conn.rollback()


# ---------------------------------------------------------------------------
# sample_patient — minimal Patient row inside the test transaction
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture()
async def sample_patient(db_session: AsyncSession) -> Patient:
    """Insert a minimal Patient row and return it.

    The row lives only for the duration of the test (rolled back after).
    A unique MRN is generated per call so tests never collide.
    """
    patient = Patient(
        mrn=f"TEST-{uuid.uuid4().hex[:8].upper()}",
        first_name="Test",
        last_name="Patient",
        sex="M",
        dob=date(1980, 1, 1),
        procedure="Appendectomy",
        procedure_date=date(2026, 6, 1),
        asa="II",
    )
    db_session.add(patient)
    await db_session.flush()
    await db_session.refresh(patient)
    return patient


# ---------------------------------------------------------------------------
# provider_user — a provider-role User for form workflow tests
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture()
async def provider_user(db_session: AsyncSession):
    """A provider-role user that can request + review forms."""
    from app.models.user import User, UserRole

    u = User(
        email=f"provider-{uuid.uuid4()}@test.example",
        full_name="Test Provider",
        hashed_password="$2b$12$test",  # dummy bcrypt
        role=UserRole.provider,
        is_active=True,
    )
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


# ---------------------------------------------------------------------------
# submitted_intake_form — a submitted-state intake FormRequest ready to review
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture()
async def submitted_intake_form(db_session: AsyncSession, sample_patient, provider_user):
    """A submitted-state intake form_request for the sample_patient, ready
    to be approved. Data payload is minimal but valid per IntakeFormPayload."""
    from datetime import datetime, timezone

    from app.models.form_request import FormRequest, FormRequestStatus, FormType
    from app.schemas.form_request import validate_payload

    minimal_intake = {
        "demographics": {"first_name": "Test", "last_name": "Patient"},
    }
    validated = validate_payload("intake", minimal_intake)

    form = FormRequest(
        patient_id=sample_patient.id,
        form_type=FormType.intake,
        status=FormRequestStatus.submitted,
        requested_by_user_id=provider_user.id,
        data=validated,
        submitted_at=datetime.now(timezone.utc),
        submitted_by_user_id=provider_user.id,
    )
    db_session.add(form)
    await db_session.flush()
    await db_session.refresh(form)
    return form
