# Patient Portal Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the rails for a patient-facing companion app — patient credentials, token-type-discriminated JWT auth, a sibling Vite app at `modern-ehr/patient-portal/`, and a minimal dashboard powered by one composition endpoint.

**Architecture:** Patients live in the existing `patients` table; we add columns for `hashed_password`, `portal_active`, `email_verified_at`, and a one-time `password_reset_token`. JWTs gain a `token_type` claim (`"user"` for staff, `"patient"` for patient-portal tokens), enforced at the deps layer. A new sibling Vite app sits alongside the provider portal at `modern-ehr/patient-portal/` with its own auth store, its own UI primitives, and a single dashboard surface composed from existing patient-scoped services. No code is shared between the two frontends.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 async + Alembic + passlib + python-jose · React 19 + Vite 6 + TypeScript + Tailwind + React Query + React Router + Zustand + Sonner.

**Spec:** `docs/superpowers/specs/2026-05-28-patient-portal-foundation-design.md`

## File Structure

### Backend — new

| File | Responsibility |
|------|----------------|
| `backend/alembic/versions/0014_patient_portal_auth.py` | Migration: 5 columns on `patients` |
| `backend/app/schemas/patient_auth.py` | Pydantic schemas for setup / login / refresh / reset |
| `backend/app/schemas/patient_dashboard.py` | Pydantic schemas for `/me` + `/me/dashboard` |
| `backend/app/services/patient_auth_service.py` | Invite issuance, setup, login, refresh, password reset |
| `backend/app/services/patient_dashboard_service.py` | Composition: greeting + next appt + pending + message + docs |
| `backend/app/api/v1/endpoints/patient_auth.py` | `/patient-auth/*` routes |
| `backend/app/api/v1/endpoints/patient_portal.py` | `/patient-portal/me*` routes |
| `backend/tests/test_patient_auth.py` | Happy-path + key failure tests |
| `backend/tests/test_patient_dashboard.py` | Composition smoke test |

### Backend — modified

| File | Change |
|------|--------|
| `backend/app/models/patient.py` | Add 5 columns |
| `backend/app/core/security.py` | Accept `token_type` claim, default `"user"` |
| `backend/app/core/config.py` | New `PATIENT_PORTAL_URL` setting |
| `backend/app/api/deps.py` | New `CurrentPatient` dep + reject wrong `token_type` on `CurrentUser` |
| `backend/app/api/v1/router.py` | Register new routers |
| `backend/app/api/v1/endpoints/patients.py` | Add `POST /patients/{id}/portal-invite` |
| `backend/.env.example` | Add `PATIENT_PORTAL_URL=http://localhost:5174` |

### Provider portal — modified

| File | Change |
|------|--------|
| `frontend/src/features/patients/api/patients-api.ts` | Add `invitePortal()` method |
| `frontend/src/features/patients/hooks/use-portal-invite.ts` | NEW — React Query mutation |
| `frontend/src/features/patients/components/PatientHeader.tsx` | Add "Invite to portal" button + result modal |

### Patient portal — new (sibling app)

```
modern-ehr/patient-portal/
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── index.html
└── src/
    ├── main.tsx
    ├── vite-env.d.ts
    ├── styles/globals.css
    ├── app/
    │   ├── App.tsx
    │   ├── providers.tsx
    │   └── router.tsx
    ├── config/
    │   ├── constants.ts
    │   └── env.ts
    ├── lib/
    │   ├── api-client.ts
    │   ├── form.ts
    │   ├── toast.ts
    │   └── utils.ts
    ├── stores/auth-store.ts
    ├── components/
    │   ├── ui/{Button,Card,Input,FormField,Spinner}.tsx
    │   └── layout/{Shell,Header}.tsx
    └── features/
        ├── auth/
        │   ├── api/auth-api.ts
        │   ├── hooks/use-login.ts
        │   ├── components/{ProtectedRoute,PublicRoute}.tsx
        │   ├── LoginPage.tsx
        │   ├── SetupPage.tsx
        │   └── ResetPage.tsx
        └── dashboard/
            ├── api/dashboard-api.ts
            ├── hooks/use-dashboard.ts
            ├── DashboardPage.tsx
            └── components/{Greeting,NextAppointment,Actions,RecentMessage,RecentDocuments}.tsx
```

---

## Phase A — Backend foundation

### Task 1: Migration — add 5 columns to `patients`

**Files:**
- Create: `backend/alembic/versions/0014_patient_portal_auth.py`

- [ ] **Step 1: Write the migration**

```python
"""patient portal auth columns

Revision ID: 0014_patient_portal_auth
Revises: 0013_form_requests
Create Date: 2026-05-28

Adds the five columns the patient portal needs to authenticate
patients: hashed_password (bcrypt, null until activated),
portal_active (login gate), email_verified_at (flips at setup),
and a reset_token + expiry pair for one-time invite + reset URLs.
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014_patient_portal_auth"
down_revision: Union[str, None] = "0013_form_requests"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "patients",
        sa.Column("hashed_password", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "patients",
        sa.Column(
            "portal_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "patients",
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "patients",
        sa.Column(
            "password_reset_token", sa.String(length=128), nullable=True
        ),
    )
    op.add_column(
        "patients",
        sa.Column(
            "password_reset_expires", sa.DateTime(timezone=True), nullable=True
        ),
    )
    op.create_index(
        "ix_patients_password_reset_token",
        "patients",
        ["password_reset_token"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_patients_password_reset_token", table_name="patients"
    )
    op.drop_column("patients", "password_reset_expires")
    op.drop_column("patients", "password_reset_token")
    op.drop_column("patients", "email_verified_at")
    op.drop_column("patients", "portal_active")
    op.drop_column("patients", "hashed_password")
```

- [ ] **Step 2: Update Patient model**

Edit `backend/app/models/patient.py`. After the existing `notes_internal` line (search for it), add:

```python
    # Patient portal auth — null until the patient activates via an
    # invite link. portal_active gates login independently of the
    # password being set (lets admins deactivate without wiping data).
    hashed_password: Mapped[str | None] = mapped_column(String(255))
    portal_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    password_reset_token: Mapped[str | None] = mapped_column(
        String(128), index=True
    )
    password_reset_expires: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
```

Make sure `Boolean` and `DateTime` are in the existing SQLAlchemy import block at the top of the file. If not, add them.

- [ ] **Step 3: Run the migration**

```bash
cd backend
source .venv/bin/activate
alembic upgrade head
```

Expected: `Running upgrade 0013_form_requests -> 0014_patient_portal_auth, patient portal auth columns`

- [ ] **Step 4: Verify the schema**

```bash
source .venv/bin/activate
python -c "
import asyncio
from app.db.session import AsyncSessionLocal
from app.models.patient import Patient
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        p = (await db.execute(select(Patient).limit(1))).scalar_one_or_none()
        if p:
            print(f'portal_active={p.portal_active} (should be False)')
            print(f'hashed_password={p.hashed_password!r} (should be None)')

asyncio.run(main())
"
```

Expected: `portal_active=False` and `hashed_password=None`.

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/0014_patient_portal_auth.py backend/app/models/patient.py
git commit -m "feat(patient-portal): patient credential columns + migration"
```

---

### Task 2: Token-type claim on JWT helpers

**Files:**
- Modify: `backend/app/core/security.py`
- Test: `backend/tests/test_token_type.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_token_type.py`:

```python
from app.core.security import create_access_token, create_refresh_token, decode_token


def test_default_token_type_is_user():
    token = create_access_token("u-123")
    payload = decode_token(token)
    assert payload["token_type"] == "user"


def test_token_type_can_be_overridden():
    token = create_access_token("p-456", token_type="patient")
    payload = decode_token(token)
    assert payload["token_type"] == "patient"
    assert payload["sub"] == "p-456"


def test_refresh_token_carries_type_too():
    token = create_refresh_token("p-456", token_type="patient")
    payload = decode_token(token)
    assert payload["type"] == "refresh"
    assert payload["token_type"] == "patient"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && source .venv/bin/activate && pytest tests/test_token_type.py -v
```

Expected: `test_default_token_type_is_user` FAILS with `KeyError: 'token_type'`.

- [ ] **Step 3: Add the claim**

Edit `backend/app/core/security.py`. Replace `create_access_token` and `create_refresh_token` with:

```python
def create_access_token(
    subject: str | int,
    claims: dict[str, Any] | None = None,
    *,
    token_type: str = "user",
) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload: dict[str, Any] = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
        "token_type": token_type,
    }
    if claims:
        payload.update(claims)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(
    subject: str | int, *, token_type: str = "user"
) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "refresh",
        "token_type": token_type,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && source .venv/bin/activate && pytest tests/test_token_type.py -v
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/security.py backend/tests/test_token_type.py
git commit -m "feat(patient-portal): token_type claim on access + refresh tokens"
```

---

### Task 3: CurrentPatient dep + reject wrong token_type

**Files:**
- Modify: `backend/app/api/deps.py`

- [ ] **Step 1: Update CurrentUser to reject patient tokens**

Edit `backend/app/api/deps.py`. Find `get_current_user`. After the `if payload.get("type") != "access":` line, add:

```python
        # New patient-portal tokens carry token_type="patient"; reject them
        # here so a stolen patient token can't access staff endpoints.
        if payload.get("token_type", "user") != "user":
            raise creds_exc
```

- [ ] **Step 2: Add CurrentPatient dep**

At the bottom of `backend/app/api/deps.py`, append:

```python
from app.models.patient import Patient


async def get_current_patient(
    db: DbSession,
    token: Annotated[str, Depends(oauth2_scheme)],
) -> Patient:
    """Resolve the patient behind a patient-portal JWT. Rejects tokens
    that don't carry token_type="patient" — even if they're otherwise
    valid — so staff tokens can't access patient endpoints.
    """
    creds_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        if payload.get("type") != "access":
            raise creds_exc
        if payload.get("token_type") != "patient":
            raise creds_exc
        patient_id = payload.get("sub")
    except JWTError:
        raise creds_exc
    if not patient_id:
        raise creds_exc

    from uuid import UUID

    patient = await db.get(Patient, UUID(patient_id))
    if patient is None or not patient.portal_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive portal account",
        )
    return patient


CurrentPatient = Annotated[Patient, Depends(get_current_patient)]
```

- [ ] **Step 3: Smoke-test the dep wiring**

```bash
cd backend && source .venv/bin/activate
python -c "from app.api.deps import CurrentPatient, get_current_patient; print('OK')"
```

Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/deps.py
git commit -m "feat(patient-portal): CurrentPatient dep + token_type guard on CurrentUser"
```

---

### Task 4: PATIENT_PORTAL_URL setting

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/.env.example`

- [ ] **Step 1: Add the setting**

Edit `backend/app/core/config.py`. Find the Settings class and add (anywhere alongside the other URL settings):

```python
    PATIENT_PORTAL_URL: str = "http://localhost:5174"
```

- [ ] **Step 2: Update .env.example**

Append to `backend/.env.example`:

```
PATIENT_PORTAL_URL=http://localhost:5174
```

- [ ] **Step 3: Verify**

```bash
cd backend && source .venv/bin/activate && python -c "from app.core.config import settings; print(settings.PATIENT_PORTAL_URL)"
```

Expected: `http://localhost:5174`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/core/config.py backend/.env.example
git commit -m "feat(patient-portal): PATIENT_PORTAL_URL setting"
```

---

### Task 5: Patient auth schemas

**Files:**
- Create: `backend/app/schemas/patient_auth.py`

- [ ] **Step 1: Write the schemas**

```python
"""Pydantic schemas for the patient portal auth surface."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class PortalInviteOut(BaseModel):
    """Provider-side: response to POST /patients/{id}/portal-invite.
    Carries the un-hashed token + the magic URL for the provider to
    copy. The token is single-use and stored hashed on disk."""

    setup_url: str
    expires_at: datetime


class SetupVerifyIn(BaseModel):
    token: str = Field(min_length=16, max_length=128)


class SetupVerifyOut(BaseModel):
    """What we tell the patient on the setup page so they can confirm
    they're at the right page before typing a password."""

    first_name: str
    masked_email: str


class SetupIn(BaseModel):
    token: str = Field(min_length=16, max_length=128)
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshIn(BaseModel):
    refresh_token: str


class RequestResetIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str = Field(min_length=16, max_length=128)
    password: str = Field(min_length=8, max_length=128)


class TokensOut(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    """Seconds until the access token expires."""


class PatientMeOut(BaseModel):
    """Slim profile returned by GET /patient-portal/me."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    mrn: str
    first_name: str
    last_name: str
    email: str | None = None
    phone: str | None = None
    dob: str | None = None
```

- [ ] **Step 2: Smoke-test the import**

```bash
cd backend && source .venv/bin/activate && python -c "from app.schemas.patient_auth import SetupIn, LoginIn, TokensOut; print('OK')"
```

Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/patient_auth.py
git commit -m "feat(patient-portal): patient auth schemas"
```

---

### Task 6: PatientAuthService

**Files:**
- Create: `backend/app/services/patient_auth_service.py`
- Test: `backend/tests/test_patient_auth_service.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_patient_auth_service.py`:

```python
"""Service-layer tests for the patient auth flow. Use an in-process
async session against the dev DB — no separate test DB setup yet."""
import asyncio
import secrets
import uuid
from datetime import datetime, timezone

import pytest

from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.patient import Patient, PatientStatus, RiskLevel
from app.services.patient_auth_service import PatientAuthService


@pytest.fixture
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


async def _make_patient(db, *, email: str, portal_active: bool = False) -> Patient:
    p = Patient(
        mrn=f"TEST-{uuid.uuid4().hex[:8]}",
        first_name="Test",
        last_name="Patient",
        sex="F",
        dob=datetime(1990, 1, 1).date(),
        email=email,
        status=PatientStatus.scheduled,
        risk=RiskLevel.low,
        portal_active=portal_active,
    )
    db.add(p)
    await db.flush()
    return p


@pytest.mark.asyncio
async def test_issue_invite_returns_url_and_stores_hashed_token():
    async with AsyncSessionLocal() as db:
        p = await _make_patient(db, email=f"{uuid.uuid4().hex}@test.local")
        url, expires = await PatientAuthService(db).issue_invite(p.id)
        assert "/setup?token=" in url
        assert p.password_reset_token is not None
        assert p.password_reset_token != url.rsplit("=", 1)[-1], (
            "stored token must be hashed, not raw"
        )
        await db.rollback()


@pytest.mark.asyncio
async def test_setup_consumes_token_and_activates_account():
    async with AsyncSessionLocal() as db:
        p = await _make_patient(db, email=f"{uuid.uuid4().hex}@test.local")
        url, _ = await PatientAuthService(db).issue_invite(p.id)
        raw_token = url.rsplit("=", 1)[-1]
        await db.flush()

        tokens = await PatientAuthService(db).setup(
            token=raw_token, password="hunter22pw"
        )
        assert tokens.access_token
        assert tokens.refresh_token
        assert p.portal_active is True
        assert p.password_reset_token is None
        await db.rollback()


@pytest.mark.asyncio
async def test_login_rejects_wrong_password():
    async with AsyncSessionLocal() as db:
        from fastapi import HTTPException

        p = await _make_patient(
            db,
            email=f"{uuid.uuid4().hex}@test.local",
            portal_active=True,
        )
        p.hashed_password = hash_password("correct-password")
        await db.flush()

        with pytest.raises(HTTPException) as exc_info:
            await PatientAuthService(db).login(
                email=p.email, password="wrong"
            )
        assert exc_info.value.status_code == 401
        await db.rollback()
```

- [ ] **Step 2: Add pytest-asyncio dep if missing**

```bash
cd backend && source .venv/bin/activate && pip install pytest-asyncio
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend && source .venv/bin/activate && pytest tests/test_patient_auth_service.py -v
```

Expected: 3 tests FAIL with `ModuleNotFoundError: app.services.patient_auth_service`.

- [ ] **Step 4: Write the service**

Create `backend/app/services/patient_auth_service.py`:

```python
"""
Patient portal auth — invite issuance, setup, login, refresh, password
reset. Token storage is hashed (SHA-256) on disk; only the un-hashed
value travels in the URL.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.patient import Patient
from app.schemas.patient_auth import TokensOut

# Setup tokens (provider invite) get 24h; password resets get 1h.
SETUP_TOKEN_TTL = timedelta(hours=24)
RESET_TOKEN_TTL = timedelta(hours=1)


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _make_tokens(patient_id: UUID) -> TokensOut:
    access = create_access_token(str(patient_id), token_type="patient")
    refresh = create_refresh_token(str(patient_id), token_type="patient")
    return TokensOut(
        access_token=access,
        refresh_token=refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


def _mask_email(email: str) -> str:
    if "@" not in email:
        return email
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        return f"{local[0]}*@{domain}"
    return f"{local[0]}{'*' * (len(local) - 2)}{local[-1]}@{domain}"


class PatientAuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # --------------------------------------------------- invite + setup

    async def issue_invite(self, patient_id: UUID) -> tuple[str, datetime]:
        """Provider-side: generate a one-time invite URL + expiry."""
        patient = await self.db.get(Patient, patient_id)
        if patient is None:
            raise HTTPException(status_code=404, detail="Patient not found")
        if not patient.email:
            raise HTTPException(
                status_code=400,
                detail="Patient has no email on file.",
            )
        raw = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + SETUP_TOKEN_TTL
        patient.password_reset_token = _hash_token(raw)
        patient.password_reset_expires = expires
        await self.db.flush()
        url = f"{settings.PATIENT_PORTAL_URL}/setup?token={raw}"
        return url, expires

    async def verify_setup_token(self, raw: str) -> tuple[str, str]:
        """Returns (first_name, masked_email) for the setup page."""
        patient = await self._lookup_by_reset_token(raw)
        return patient.first_name, _mask_email(patient.email or "")

    async def setup(self, *, token: str, password: str) -> TokensOut:
        patient = await self._lookup_by_reset_token(token)
        patient.hashed_password = hash_password(password)
        patient.portal_active = True
        patient.email_verified_at = datetime.now(timezone.utc)
        patient.password_reset_token = None
        patient.password_reset_expires = None
        await self.db.flush()
        return _make_tokens(patient.id)

    # --------------------------------------------------- login + refresh

    async def login(self, *, email: str, password: str) -> TokensOut:
        patient = (
            await self.db.execute(
                select(Patient).where(Patient.email == email)
            )
        ).scalar_one_or_none()
        if (
            patient is None
            or not patient.portal_active
            or not patient.hashed_password
            or not verify_password(password, patient.hashed_password)
        ):
            raise HTTPException(
                status_code=401, detail="Invalid credentials"
            )
        return _make_tokens(patient.id)

    async def refresh(self, *, refresh_token: str) -> TokensOut:
        try:
            payload = decode_token(refresh_token)
        except ValueError:
            raise HTTPException(status_code=401, detail="Invalid token")
        if (
            payload.get("type") != "refresh"
            or payload.get("token_type") != "patient"
        ):
            raise HTTPException(status_code=401, detail="Invalid token")
        patient = await self.db.get(Patient, UUID(payload["sub"]))
        if patient is None or not patient.portal_active:
            raise HTTPException(
                status_code=401, detail="Inactive portal account"
            )
        return _make_tokens(patient.id)

    # --------------------------------------------------- password reset

    async def request_reset(self, *, email: str) -> None:
        """Always returns silently — no account enumeration."""
        patient = (
            await self.db.execute(
                select(Patient).where(Patient.email == email)
            )
        ).scalar_one_or_none()
        if patient is None or not patient.portal_active:
            return
        raw = secrets.token_urlsafe(32)
        patient.password_reset_token = _hash_token(raw)
        patient.password_reset_expires = (
            datetime.now(timezone.utc) + RESET_TOKEN_TTL
        )
        await self.db.flush()
        # NOTE: real email delivery is a follow-up. For now the URL
        # ends up in the audit log via the endpoint layer.

    async def reset(self, *, token: str, password: str) -> TokensOut:
        patient = await self._lookup_by_reset_token(token)
        patient.hashed_password = hash_password(password)
        patient.password_reset_token = None
        patient.password_reset_expires = None
        await self.db.flush()
        return _make_tokens(patient.id)

    # --------------------------------------------------- helpers

    async def _lookup_by_reset_token(self, raw: str) -> Patient:
        hashed = _hash_token(raw)
        patient = (
            await self.db.execute(
                select(Patient).where(Patient.password_reset_token == hashed)
            )
        ).scalar_one_or_none()
        if patient is None:
            raise HTTPException(
                status_code=400, detail="Token expired or already used"
            )
        expires = patient.password_reset_expires
        if expires is None or expires < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=400, detail="Token expired or already used"
            )
        return patient
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && source .venv/bin/activate && pytest tests/test_patient_auth_service.py -v
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/patient_auth_service.py backend/tests/test_patient_auth_service.py
git commit -m "feat(patient-portal): PatientAuthService — invite, setup, login, refresh, reset"
```

---

### Task 7: `/patient-auth/*` endpoints

**Files:**
- Create: `backend/app/api/v1/endpoints/patient_auth.py`
- Modify: `backend/app/api/v1/router.py`

- [ ] **Step 1: Write the endpoints**

Create `backend/app/api/v1/endpoints/patient_auth.py`:

```python
"""Patient portal auth endpoints. See spec
docs/superpowers/specs/2026-05-28-patient-portal-foundation-design.md
for the flow."""
from fastapi import APIRouter, Request, status

from app.api.deps import DbSession
from app.schemas.patient_auth import (
    LoginIn,
    RefreshIn,
    RequestResetIn,
    ResetIn,
    SetupIn,
    SetupVerifyIn,
    SetupVerifyOut,
    TokensOut,
)
from app.services.audit_service import AuditService
from app.services.patient_auth_service import PatientAuthService


router = APIRouter(prefix="/patient-auth", tags=["patient-auth"])


@router.post("/setup-verify", response_model=SetupVerifyOut)
async def setup_verify(
    payload: SetupVerifyIn, db: DbSession
) -> SetupVerifyOut:
    first_name, masked_email = await PatientAuthService(db).verify_setup_token(
        payload.token
    )
    return SetupVerifyOut(first_name=first_name, masked_email=masked_email)


@router.post(
    "/setup",
    response_model=TokensOut,
    status_code=status.HTTP_201_CREATED,
)
async def setup(
    request: Request, payload: SetupIn, db: DbSession
) -> TokensOut:
    tokens = await PatientAuthService(db).setup(
        token=payload.token, password=payload.password
    )
    await AuditService(db).record_request(
        request,
        user_id=None,
        action="patient.setup",
        resource_type="patient",
        resource_id=None,
    )
    return tokens


@router.post("/login", response_model=TokensOut)
async def login(
    request: Request, payload: LoginIn, db: DbSession
) -> TokensOut:
    try:
        tokens = await PatientAuthService(db).login(
            email=payload.email, password=payload.password
        )
    except Exception:
        await AuditService(db).record_request(
            request,
            user_id=None,
            action="patient.login_failed",
            resource_type="patient",
            resource_id=None,
            payload={"email": payload.email},
        )
        raise
    await AuditService(db).record_request(
        request,
        user_id=None,
        action="patient.login",
        resource_type="patient",
        resource_id=None,
        payload={"email": payload.email},
    )
    return tokens


@router.post("/refresh", response_model=TokensOut)
async def refresh(payload: RefreshIn, db: DbSession) -> TokensOut:
    return await PatientAuthService(db).refresh(
        refresh_token=payload.refresh_token
    )


@router.post(
    "/request-reset",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def request_reset(
    request: Request, payload: RequestResetIn, db: DbSession
) -> None:
    await PatientAuthService(db).request_reset(email=payload.email)
    await AuditService(db).record_request(
        request,
        user_id=None,
        action="patient.password_reset_requested",
        resource_type="patient",
        resource_id=None,
        payload={"email": payload.email},
    )


@router.post("/reset", response_model=TokensOut)
async def reset(
    request: Request, payload: ResetIn, db: DbSession
) -> TokensOut:
    tokens = await PatientAuthService(db).reset(
        token=payload.token, password=payload.password
    )
    await AuditService(db).record_request(
        request,
        user_id=None,
        action="patient.password_reset",
        resource_type="patient",
        resource_id=None,
    )
    return tokens
```

- [ ] **Step 2: Register the router**

Edit `backend/app/api/v1/router.py`. Add `patient_auth` to the import block (alphabetical, before `patients`):

```python
    patient_auth,
    patients,
```

Then add the include below the existing `auth.router` line:

```python
api_router.include_router(patient_auth.router)
```

- [ ] **Step 3: Smoke-test the routes**

```bash
cd backend && source .venv/bin/activate
python -c "
from app.main import create_app
app = create_app()
for r in app.routes:
    if hasattr(r, 'path') and '/patient-auth' in r.path:
        print(r.methods, r.path)
"
```

Expected: 6 routes printed — `/setup-verify`, `/setup`, `/login`, `/refresh`, `/request-reset`, `/reset`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/endpoints/patient_auth.py backend/app/api/v1/router.py
git commit -m "feat(patient-portal): /patient-auth/* endpoints"
```

---

### Task 8: Provider-side `POST /patients/{id}/portal-invite`

**Files:**
- Modify: `backend/app/api/v1/endpoints/patients.py`

- [ ] **Step 1: Add the endpoint**

Edit `backend/app/api/v1/endpoints/patients.py`. Add to the imports:

```python
from app.schemas.patient_auth import PortalInviteOut
from app.services.patient_auth_service import PatientAuthService
```

Append this endpoint at the bottom of the router definitions (after `create_patient` and friends):

```python
@router.post(
    "/{patient_id}/portal-invite",
    response_model=PortalInviteOut,
    dependencies=[write_role_dep],
)
async def invite_to_portal(
    patient_id: UUID,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> PortalInviteOut:
    """Provider/admin generates a one-time setup URL the patient uses
    to set their portal password. The provider copies the URL out-of-
    band (email/SMS/print) for the first ship; email auto-delivery is
    a follow-up."""
    url, expires = await PatientAuthService(db).issue_invite(patient_id)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="patient.invite",
        resource_type="patient",
        resource_id=str(patient_id),
    )
    return PortalInviteOut(setup_url=url, expires_at=expires)
```

`write_role_dep` is already defined at the top of this file — it gates provider/admin writes via `require_roles`. Reuse it as shown.

- [ ] **Step 2: Smoke-test**

```bash
cd backend && source .venv/bin/activate
python -c "
from app.main import create_app
app = create_app()
for r in app.routes:
    if hasattr(r, 'path') and 'portal-invite' in r.path:
        print(r.methods, r.path)
"
```

Expected: `{'POST'} /api/v1/patients/{patient_id}/portal-invite`.

- [ ] **Step 3: End-to-end smoke**

```bash
cd backend && source .venv/bin/activate
python -c "
import asyncio
from uuid import UUID
from app.db.session import AsyncSessionLocal
from app.services.patient_auth_service import PatientAuthService
from app.models.patient import Patient
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        p = (await db.execute(select(Patient).where(Patient.email.isnot(None)).limit(1))).scalar_one()
        url, expires = await PatientAuthService(db).issue_invite(p.id)
        raw = url.rsplit('=', 1)[-1]
        print(f'URL: {url}')
        # Now verify the token round-trips
        fn, masked = await PatientAuthService(db).verify_setup_token(raw)
        print(f'verify → {fn} / {masked}')
        # Set password
        tokens = await PatientAuthService(db).setup(token=raw, password='hunter22pw')
        print(f'tokens OK: access starts with {tokens.access_token[:20]}...')
        # Login
        login_tokens = await PatientAuthService(db).login(email=p.email, password='hunter22pw')
        print(f'login OK')
        await db.rollback()

asyncio.run(main())
" 2>&1 | grep -E "URL|verify|tokens|login"
```

Expected: 4 lines, all reading like success.

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/endpoints/patients.py
git commit -m "feat(patient-portal): provider invite endpoint POST /patients/{id}/portal-invite"
```

---

### Task 9: Patient dashboard schemas + service

**Files:**
- Create: `backend/app/schemas/patient_dashboard.py`
- Create: `backend/app/services/patient_dashboard_service.py`

- [ ] **Step 1: Write the schemas**

Create `backend/app/schemas/patient_dashboard.py`:

```python
"""Composed dashboard payload for GET /patient-portal/me/dashboard.
Each section is independent — null when there's nothing to show."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DashboardGreeting(BaseModel):
    first_name: str


class DashboardNextAppointment(BaseModel):
    id: UUID
    starts_at: datetime
    provider_name: str | None = None
    specialty: str | None = None
    location: str | None = None
    appointment_type: str | None = None


class DashboardPendingActions(BaseModel):
    forms_count: int
    tasks_count: int
    total: int


class DashboardRecentMessage(BaseModel):
    conversation_id: UUID
    sender_name: str | None = None
    preview: str
    sent_at: datetime


class DashboardRecentDocument(BaseModel):
    id: UUID
    name: str
    category: str
    created_at: datetime


class DashboardOut(BaseModel):
    greeting: DashboardGreeting
    next_appointment: DashboardNextAppointment | None = None
    pending_actions: DashboardPendingActions
    recent_message: DashboardRecentMessage | None = None
    recent_documents: list[DashboardRecentDocument] = []
```

- [ ] **Step 2: Write the service**

Create `backend/app/services/patient_dashboard_service.py`:

```python
"""Composition-only service for the patient dashboard. Pulls slim
projections from existing tables — does not add new business logic."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment, AppointmentStatus
from app.models.conversation import Conversation, Message
from app.models.document import Document
from app.models.form_request import FormRequest, FormRequestStatus
from app.models.patient import Patient
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.schemas.patient_dashboard import (
    DashboardGreeting,
    DashboardNextAppointment,
    DashboardOut,
    DashboardPendingActions,
    DashboardRecentDocument,
    DashboardRecentMessage,
)


class PatientDashboardService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def for_patient(self, patient: Patient) -> DashboardOut:
        return DashboardOut(
            greeting=DashboardGreeting(first_name=patient.first_name),
            next_appointment=await self._next_appointment(patient.id),
            pending_actions=await self._pending_actions(patient.id),
            recent_message=await self._recent_message(patient.id),
            recent_documents=await self._recent_documents(patient.id),
        )

    async def _next_appointment(
        self, patient_id: UUID
    ) -> DashboardNextAppointment | None:
        now = datetime.now(timezone.utc)
        row = (
            await self.db.execute(
                select(Appointment)
                .where(
                    Appointment.patient_id == patient_id,
                    Appointment.starts_at >= now,
                    Appointment.status.in_(
                        [
                            AppointmentStatus.scheduled,
                            AppointmentStatus.confirmed,
                        ]
                    ),
                )
                .order_by(Appointment.starts_at.asc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if row is None:
            return None

        provider_name = None
        specialty = None
        if row.physician_id:
            provider = await self.db.get(User, row.physician_id)
            if provider is not None:
                provider_name = provider.full_name
                specialty = provider.specialty
        return DashboardNextAppointment(
            id=row.id,
            starts_at=row.starts_at,
            provider_name=provider_name,
            specialty=specialty,
            location=row.room,
            appointment_type=row.type.value if row.type else None,
        )

    async def _pending_actions(
        self, patient_id: UUID
    ) -> DashboardPendingActions:
        forms_count = int(
            (
                await self.db.execute(
                    select(func.count(FormRequest.id)).where(
                        FormRequest.patient_id == patient_id,
                        FormRequest.status == FormRequestStatus.pending,
                    )
                )
            ).scalar_one()
        )
        tasks_count = int(
            (
                await self.db.execute(
                    select(func.count(Task.id)).where(
                        Task.patient_id == patient_id,
                        Task.status.in_(
                            [TaskStatus.new, TaskStatus.in_progress]
                        ),
                    )
                )
            ).scalar_one()
        )
        return DashboardPendingActions(
            forms_count=forms_count,
            tasks_count=tasks_count,
            total=forms_count + tasks_count,
        )

    async def _recent_message(
        self, patient_id: UUID
    ) -> DashboardRecentMessage | None:
        conv = (
            await self.db.execute(
                select(Conversation)
                .where(Conversation.patient_id == patient_id)
                .order_by(Conversation.last_message_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if conv is None or conv.last_message_preview is None:
            return None
        sender_name = None
        latest = (
            await self.db.execute(
                select(Message)
                .where(Message.conversation_id == conv.id)
                .order_by(Message.sent_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if latest is not None and latest.sender_user_id is not None:
            sender = await self.db.get(User, latest.sender_user_id)
            sender_name = sender.full_name if sender else None
        return DashboardRecentMessage(
            conversation_id=conv.id,
            sender_name=sender_name,
            preview=conv.last_message_preview,
            sent_at=conv.last_message_at,
        )

    async def _recent_documents(
        self, patient_id: UUID
    ) -> list[DashboardRecentDocument]:
        rows = (
            await self.db.execute(
                select(Document)
                .where(Document.patient_id == patient_id)
                .order_by(Document.created_at.desc())
                .limit(3)
            )
        ).scalars().all()
        return [
            DashboardRecentDocument(
                id=d.id, name=d.name, category=d.category, created_at=d.created_at
            )
            for d in rows
        ]
```

All model field names above are verified against the current codebase: `Appointment.starts_at` / `physician_id` / `room` / `type` (enum), `Conversation.last_message_at` / `last_message_preview`, `FormRequest.status`, `Task.patient_id` / `status`.

- [ ] **Step 3: Smoke-test composition**

```bash
cd backend && source .venv/bin/activate
python -c "
import asyncio
from app.db.session import AsyncSessionLocal
from app.services.patient_dashboard_service import PatientDashboardService
from app.models.patient import Patient
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        p = (await db.execute(select(Patient).limit(1))).scalar_one()
        out = await PatientDashboardService(db).for_patient(p)
        print(f'greeting: {out.greeting.first_name}')
        print(f'next_appt: {out.next_appointment}')
        print(f'pending: forms={out.pending_actions.forms_count} tasks={out.pending_actions.tasks_count}')
        print(f'recent_message: {out.recent_message is not None}')
        print(f'recent_documents: {len(out.recent_documents)}')

asyncio.run(main())
" 2>&1 | grep -E "greeting|next_appt|pending|recent"
```

Expected: 5 lines, all printing without errors.

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/patient_dashboard.py backend/app/services/patient_dashboard_service.py
git commit -m "feat(patient-portal): dashboard schemas + composition service"
```

---

### Task 10: `/patient-portal/*` endpoints

**Files:**
- Create: `backend/app/api/v1/endpoints/patient_portal.py`
- Modify: `backend/app/api/v1/router.py`

- [ ] **Step 1: Write the endpoints**

Create `backend/app/api/v1/endpoints/patient_portal.py`:

```python
"""Patient portal endpoints. Every route uses CurrentPatient — the dep
enforces token_type=='patient' so staff tokens can't reach here."""
from fastapi import APIRouter

from app.api.deps import CurrentPatient, DbSession
from app.schemas.patient_auth import PatientMeOut
from app.schemas.patient_dashboard import DashboardOut
from app.services.patient_dashboard_service import PatientDashboardService


router = APIRouter(prefix="/patient-portal", tags=["patient-portal"])


@router.get("/me", response_model=PatientMeOut)
async def me(current: CurrentPatient) -> PatientMeOut:
    return PatientMeOut(
        id=current.id,
        mrn=current.mrn,
        first_name=current.first_name,
        last_name=current.last_name,
        email=current.email,
        phone=current.phone,
        dob=current.dob.isoformat() if current.dob else None,
    )


@router.get("/me/dashboard", response_model=DashboardOut)
async def my_dashboard(
    db: DbSession, current: CurrentPatient
) -> DashboardOut:
    return await PatientDashboardService(db).for_patient(current)
```

- [ ] **Step 2: Register the router**

Edit `backend/app/api/v1/router.py`. Add `patient_portal` to the import block (after `patient_auth`):

```python
    patient_portal,
```

And add the include below `patient_auth.router`:

```python
api_router.include_router(patient_portal.router)
```

- [ ] **Step 3: Smoke-test the routes**

```bash
cd backend && source .venv/bin/activate
python -c "
from app.main import create_app
app = create_app()
for r in app.routes:
    if hasattr(r, 'path') and '/patient-portal' in r.path:
        print(r.methods, r.path)
"
```

Expected: 2 routes — `/me` and `/me/dashboard`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/endpoints/patient_portal.py backend/app/api/v1/router.py
git commit -m "feat(patient-portal): /patient-portal/me + /me/dashboard endpoints"
```

---

## Phase B — Provider portal: "Invite to portal" button

### Task 11: API client + hook + UI on patient profile

**Files:**
- Modify: `frontend/src/features/patients/api/patients-api.ts`
- Create: `frontend/src/features/patients/hooks/use-portal-invite.ts`
- Modify: `frontend/src/features/patients/components/PatientHeader.tsx`

- [ ] **Step 1: Add the API method**

Edit `frontend/src/features/patients/api/patients-api.ts`. Inside the `patientsApi` object (add as the last method), insert:

```typescript
  invitePortal: async (
    patientId: string
  ): Promise<{ setup_url: string; expires_at: string }> => {
    return await api.post<{ setup_url: string; expires_at: string }>(
      `/patients/${patientId}/portal-invite`,
      {}
    );
  },
```

- [ ] **Step 2: Write the hook**

Create `frontend/src/features/patients/hooks/use-portal-invite.ts`:

```typescript
import { useMutation } from "@tanstack/react-query";
import { patientsApi } from "@/features/patients/api/patients-api";
import { toast } from "@/lib/toast";

export function usePortalInvite() {
  return useMutation({
    mutationFn: (patientId: string) => patientsApi.invitePortal(patientId),
    onError: (err) =>
      toast.error("Couldn't generate invite", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}
```

- [ ] **Step 3: Wire the button on PatientHeader**

Edit `frontend/src/features/patients/components/PatientHeader.tsx`.

Add imports at the top:

```typescript
import { useState } from "react";
import { Copy, Send } from "lucide-react";
import { usePortalInvite } from "@/features/patients/hooks/use-portal-invite";
import { toast } from "@/lib/toast";
```

Inside the `PatientHeader` component body (before the `return`), add:

```typescript
  const invite = usePortalInvite();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const handleInvite = async () => {
    const result = await invite.mutateAsync(patient.id);
    setInviteUrl(result.setup_url);
  };

  const copyUrl = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite URL copied to clipboard");
  };
```

In the JSX, find the row of action buttons (usually next to "Edit" / "Remove") and add:

```tsx
              <Button
                variant="secondary"
                size="sm"
                onClick={handleInvite}
                disabled={invite.isPending}
                className="h-9"
              >
                <Send className="size-3.5" />
                {invite.isPending ? "Generating…" : "Invite to portal"}
              </Button>
```

After the closing tag of the header card, before the closing fragment, add the invite-result strip:

```tsx
      {inviteUrl && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="text-sm font-semibold text-primary mb-1">
            Patient portal invite ready
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Share this one-time URL with the patient by email, SMS, or
            in person. It expires in 24 hours.
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={inviteUrl}
              className="flex-1 h-9 rounded-full border border-border bg-white px-3 text-xs font-mono ring-focus"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={copyUrl}
              className="h-9"
            >
              <Copy className="size-3.5" /> Copy
            </Button>
          </div>
        </div>
      )}
```

- [ ] **Step 4: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/patients/api/patients-api.ts \
        frontend/src/features/patients/hooks/use-portal-invite.ts \
        frontend/src/features/patients/components/PatientHeader.tsx
git commit -m "feat(patient-portal): provider 'Invite to portal' button + copy-URL strip"
```

---

## Phase C — Patient portal frontend scaffold

### Task 12: Create the Vite app skeleton

**Files:**
- Create: `patient-portal/package.json`
- Create: `patient-portal/vite.config.ts`
- Create: `patient-portal/tsconfig.json`
- Create: `patient-portal/tsconfig.app.json`
- Create: `patient-portal/tsconfig.node.json`
- Create: `patient-portal/postcss.config.js`
- Create: `patient-portal/tailwind.config.ts`
- Create: `patient-portal/index.html`
- Create: `patient-portal/src/main.tsx`
- Create: `patient-portal/src/vite-env.d.ts`
- Create: `patient-portal/src/styles/globals.css`

- [ ] **Step 1: package.json**

Create `modern-ehr/patient-portal/package.json`:

```json
{
  "name": "padmavat-patient-portal",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port 5174",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@hookform/resolvers": "^5.4.0",
    "@radix-ui/react-slot": "^1.1.2",
    "@tanstack/react-query": "^5.66.0",
    "clsx": "^2.1.1",
    "lucide-react": "^0.474.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-hook-form": "^7.54.2",
    "react-router-dom": "^7.1.5",
    "sonner": "^1.7.4",
    "tailwind-merge": "^3.0.1",
    "zod": "^3.24.1",
    "zustand": "^5.0.3"
  },
  "devDependencies": {
    "@types/node": "^22.13.4",
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.4",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.5.2",
    "tailwindcss": "^3.4.17",
    "tailwindcss-animate": "^1.0.7",
    "typescript": "^5.7.3",
    "vite": "^6.1.0"
  }
}
```

- [ ] **Step 2: vite.config.ts**

Create `modern-ehr/patient-portal/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: TypeScript configs**

Create `modern-ehr/patient-portal/tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

Create `modern-ehr/patient-portal/tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

Create `modern-ehr/patient-portal/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: PostCSS + Tailwind**

Create `modern-ehr/patient-portal/postcss.config.js`:

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

Create `modern-ehr/patient-portal/tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F8FAF7",
        surface: "#FFFFFF",
        foreground: "#0F1F1A",
        muted: "#5C6F66",
        primary: {
          DEFAULT: "#0E8A6C",
          soft: "#E8F5EF",
          foreground: "#FFFFFF",
        },
        accent: "#B4D7C7",
        danger: "#D04848",
        warning: "#E0A536",
        border: "#E5EDE8",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "20px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15, 31, 26, 0.06), 0 2px 8px rgba(15, 31, 26, 0.08)",
      },
      maxWidth: {
        column: "720px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

- [ ] **Step 5: index.html + entry**

Create `modern-ehr/patient-portal/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Padmavat — Patient Portal</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `modern-ehr/patient-portal/src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `modern-ehr/patient-portal/src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 6: globals.css**

Create `modern-ehr/patient-portal/src/styles/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    font-size: 16px;
  }
  body {
    @apply bg-bg text-foreground font-sans antialiased;
  }
  *,
  *::before,
  *::after {
    @apply border-border;
  }
}

@layer utilities {
  .ring-focus {
    @apply focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-bg;
  }
}
```

- [ ] **Step 7: Install + verify**

```bash
cd patient-portal && npm install
```

Then create a temporary `src/app/App.tsx` placeholder so the build succeeds:

```bash
mkdir -p src/app
cat > src/app/App.tsx << 'EOF'
export function App() {
  return <div className="p-8">Patient portal — scaffold OK</div>;
}
EOF
```

Run typecheck:

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add patient-portal/
git commit -m "feat(patient-portal): Vite app scaffold + tailwind palette + globals.css"
```

---

### Task 13: Config + lib + auth store

**Files:**
- Create: `patient-portal/src/config/constants.ts`
- Create: `patient-portal/src/config/env.ts`
- Create: `patient-portal/src/lib/utils.ts`
- Create: `patient-portal/src/lib/toast.ts`
- Create: `patient-portal/src/lib/api-client.ts`
- Create: `patient-portal/src/lib/form.ts`
- Create: `patient-portal/src/stores/auth-store.ts`

- [ ] **Step 1: constants**

Create `patient-portal/src/config/constants.ts`:

```ts
export const APP_NAME = "Padmavat";

export const ROUTES = {
  dashboard: "/",
  login: "/login",
  setup: "/setup",
  reset: "/reset",
} as const;

export const STORAGE_KEYS = {
  accessToken: "padmavat-portal.access_token",
  refreshToken: "padmavat-portal.refresh_token",
} as const;
```

- [ ] **Step 2: env**

Create `patient-portal/src/config/env.ts`:

```ts
function read(key: string, fallback: string): string {
  const value = import.meta.env[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export const env = {
  API_BASE_URL: read("VITE_API_BASE_URL", "http://localhost:8000/api/v1"),
} as const;
```

- [ ] **Step 3: utils**

Create `patient-portal/src/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Greeting based on local time. */
export function timeOfDayGreeting(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

/** Human-friendly date/time for the next-appointment card. */
export function humanWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const diffDays = Math.round(
    (d.setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86400000
  );
  const d2 = new Date(iso);
  const time = d2.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (diffDays === 0) return `Today at ${time}`;
  if (diffDays === 1) return `Tomorrow at ${time}`;
  if (diffDays > 1 && diffDays < 7) {
    return `${d2.toLocaleDateString("en-US", { weekday: "long" })} at ${time}`;
  }
  return `${d2.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} at ${time}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
```

- [ ] **Step 4: toast**

Create `patient-portal/src/lib/toast.ts`:

```ts
export { toast } from "sonner";
```

- [ ] **Step 5: api-client**

Create `patient-portal/src/lib/api-client.ts`:

```ts
import { env } from "@/config/env";
import { STORAGE_KEYS } from "@/config/constants";

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

let logoutListener: (() => void) | null = null;

export function registerLogout(fn: () => void) {
  logoutListener = fn;
}

function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.accessToken);
}

async function attemptRefresh(): Promise<string | null> {
  const refresh = localStorage.getItem(STORAGE_KEYS.refreshToken);
  if (!refresh) return null;
  try {
    const res = await fetch(`${env.API_BASE_URL}/patient-auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
    };
    localStorage.setItem(STORAGE_KEYS.accessToken, data.access_token);
    localStorage.setItem(STORAGE_KEYS.refreshToken, data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  skipAuth?: boolean;
  searchParams?: Record<string, string | number | undefined>;
}

function buildUrl(path: string, params?: RequestOptions["searchParams"]) {
  const url = new URL(`${env.API_BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function doRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const token = options.skipAuth ? null : getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res = await fetch(buildUrl(path, options.searchParams), {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && !options.skipAuth) {
    const fresh = await attemptRefresh();
    if (fresh) {
      headers.Authorization = `Bearer ${fresh}`;
      res = await fetch(buildUrl(path, options.searchParams), {
        method: options.method ?? "GET",
        headers,
        body:
          options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } else if (logoutListener) {
      logoutListener();
    }
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") ?? "";
  const payload: unknown = contentType.includes("application/json")
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    const message =
      payload && typeof payload === "object" && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : res.statusText || "Request failed";
    throw new ApiError(res.status, message, payload);
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    doRequest<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    doRequest<T>(path, { ...opts, method: "POST", body }),
};
```

- [ ] **Step 6: form helpers**

Create `patient-portal/src/lib/form.ts`:

```ts
export { useForm } from "react-hook-form";
export { zodResolver } from "@hookform/resolvers/zod";
export { z } from "zod";
```

- [ ] **Step 7: auth-store**

Create `patient-portal/src/stores/auth-store.ts`:

```ts
import { create } from "zustand";
import { STORAGE_KEYS } from "@/config/constants";
import { registerLogout } from "@/lib/api-client";

export interface PatientMe {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  dob: string | null;
}

interface AuthState {
  me: PatientMe | null;
  accessToken: string | null;
  refreshToken: string | null;
  setMe: (me: PatientMe | null) => void;
  setTokens: (tokens: { access: string; refresh: string }) => void;
  logout: () => void;
}

function readStored(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

function writeStored(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
}

export const useAuthStore = create<AuthState>((set) => ({
  me: null,
  accessToken: readStored(STORAGE_KEYS.accessToken),
  refreshToken: readStored(STORAGE_KEYS.refreshToken),

  setMe: (me) => set({ me }),

  setTokens: ({ access, refresh }) => {
    writeStored(STORAGE_KEYS.accessToken, access);
    writeStored(STORAGE_KEYS.refreshToken, refresh);
    set({ accessToken: access, refreshToken: refresh });
  },

  logout: () => {
    writeStored(STORAGE_KEYS.accessToken, null);
    writeStored(STORAGE_KEYS.refreshToken, null);
    set({ me: null, accessToken: null, refreshToken: null });
  },
}));

// Wire the api-client → store: on a refresh failure, blow away state.
registerLogout(() => {
  useAuthStore.getState().logout();
});
```

- [ ] **Step 8: Typecheck**

```bash
cd patient-portal && npm run typecheck
```

Expected: no output.

- [ ] **Step 9: Commit**

```bash
git add patient-portal/src
git commit -m "feat(patient-portal): config + lib + auth store"
```

---

### Task 14: UI primitives (Button, Card, Input, FormField, Spinner)

**Files:**
- Create: `patient-portal/src/components/ui/Button.tsx`
- Create: `patient-portal/src/components/ui/Card.tsx`
- Create: `patient-portal/src/components/ui/Input.tsx`
- Create: `patient-portal/src/components/ui/FormField.tsx`
- Create: `patient-portal/src/components/ui/Spinner.tsx`

- [ ] **Step 1: Button**

Create `patient-portal/src/components/ui/Button.tsx`:

```tsx
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95",
  secondary:
    "bg-primary-soft text-primary hover:bg-primary-soft/70 border border-primary/15",
  ghost: "text-foreground hover:bg-primary-soft",
};

const sizes: Record<Size, string> = {
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", size = "lg", className, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ring-focus",
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    />
  )
);
Button.displayName = "Button";
```

- [ ] **Step 2: Card**

Create `patient-portal/src/components/ui/Card.tsx`:

```tsx
import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-surface rounded-card border border-border shadow-soft p-6",
        className
      )}
      {...rest}
    />
  );
}
```

- [ ] **Step 3: Input**

Create `patient-portal/src/components/ui/Input.tsx`:

```tsx
import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ className, invalid, ...rest }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-full border bg-surface px-4 text-base ring-focus transition",
        invalid
          ? "border-danger focus-visible:ring-danger/30"
          : "border-border focus-visible:border-primary/40",
        className
      )}
      {...rest}
    />
  )
);
Input.displayName = "Input";
```

- [ ] **Step 4: FormField**

Create `patient-portal/src/components/ui/FormField.tsx`:

```tsx
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: Props) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-semibold text-foreground"
      >
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-muted">{hint}</p>
      )}
      {error && (
        <p className={cn("text-xs text-danger font-medium")}>{error}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Spinner**

Create `patient-portal/src/components/ui/Spinner.tsx`:

```tsx
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("animate-spin size-4", className)} />;
}
```

- [ ] **Step 6: Typecheck**

```bash
cd patient-portal && npm run typecheck
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add patient-portal/src/components
git commit -m "feat(patient-portal): UI primitives (Button, Card, Input, FormField, Spinner)"
```

---

### Task 15: Layout (Shell + Header) + providers + router skeleton

**Files:**
- Create: `patient-portal/src/components/layout/Header.tsx`
- Create: `patient-portal/src/components/layout/Shell.tsx`
- Create: `patient-portal/src/app/providers.tsx`
- Create: `patient-portal/src/app/router.tsx`
- Replace: `patient-portal/src/app/App.tsx`

- [ ] **Step 1: Header**

Create `patient-portal/src/components/layout/Header.tsx`:

```tsx
import { LogOut } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/Button";

export function Header() {
  const me = useAuthStore((s) => s.me);
  const logout = useAuthStore((s) => s.logout);

  return (
    <header className="border-b border-border bg-surface">
      <div className="max-w-column mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-full bg-primary grid place-items-center text-primary-foreground font-bold">
            P
          </div>
          <span className="font-bold text-foreground">Padmavat</span>
        </div>
        {me && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted">
              Hi, {me.first_name}
            </span>
            <Button
              variant="ghost"
              size="md"
              onClick={logout}
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Shell**

Create `patient-portal/src/components/layout/Shell.tsx`:

```tsx
import { Outlet } from "react-router-dom";
import { Header } from "./Header";

export function Shell() {
  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <main className="max-w-column mx-auto px-6 py-8 space-y-6">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: providers**

Create `patient-portal/src/app/providers.tsx`:

```tsx
import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>{children}</BrowserRouter>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: router skeleton (placeholder pages)**

Create `patient-portal/src/app/router.tsx`:

```tsx
import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "@/components/layout/Shell";

function DashboardPlaceholder() {
  return <div className="text-foreground">Dashboard placeholder</div>;
}

function LoginPlaceholder() {
  return <div className="p-8">Login placeholder</div>;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPlaceholder />} />
      <Route element={<Shell />}>
        <Route path="/" element={<DashboardPlaceholder />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 5: App entry**

Replace `patient-portal/src/app/App.tsx`:

```tsx
import { Providers } from "./providers";
import { AppRouter } from "./router";

export function App() {
  return (
    <Providers>
      <AppRouter />
    </Providers>
  );
}
```

- [ ] **Step 6: Verify boot**

```bash
cd patient-portal && npm run dev &
sleep 2
curl -s http://localhost:5174/ | head -20
kill %1
```

Expected: HTML response with `<div id="root"></div>` and the Vite client script.

- [ ] **Step 7: Commit**

```bash
git add patient-portal/src/components/layout patient-portal/src/app
git commit -m "feat(patient-portal): layout shell + providers + router skeleton"
```

---

### Task 16: Auth API client + hooks

**Files:**
- Create: `patient-portal/src/features/auth/api/auth-api.ts`
- Create: `patient-portal/src/features/auth/hooks/use-login.ts`
- Create: `patient-portal/src/features/auth/hooks/use-setup.ts`
- Create: `patient-portal/src/features/auth/hooks/use-request-reset.ts`
- Create: `patient-portal/src/features/auth/hooks/use-me.ts`

- [ ] **Step 1: API client**

Create `patient-portal/src/features/auth/api/auth-api.ts`:

```ts
import { api } from "@/lib/api-client";
import type { PatientMe } from "@/stores/auth-store";

export interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface SetupVerifyOut {
  first_name: string;
  masked_email: string;
}

export const authApi = {
  setupVerify: (token: string): Promise<SetupVerifyOut> =>
    api.post<SetupVerifyOut>(
      "/patient-auth/setup-verify",
      { token },
      { skipAuth: true }
    ),

  setup: (input: { token: string; password: string }): Promise<Tokens> =>
    api.post<Tokens>("/patient-auth/setup", input, { skipAuth: true }),

  login: (input: { email: string; password: string }): Promise<Tokens> =>
    api.post<Tokens>("/patient-auth/login", input, { skipAuth: true }),

  requestReset: (email: string): Promise<void> =>
    api.post<void>(
      "/patient-auth/request-reset",
      { email },
      { skipAuth: true }
    ),

  reset: (input: { token: string; password: string }): Promise<Tokens> =>
    api.post<Tokens>("/patient-auth/reset", input, { skipAuth: true }),

  me: (): Promise<PatientMe> => api.get<PatientMe>("/patient-portal/me"),
};
```

- [ ] **Step 2: Login hook**

Create `patient-portal/src/features/auth/hooks/use-login.ts`:

```ts
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/features/auth/api/auth-api";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/lib/toast";

export function useLogin() {
  const setTokens = useAuthStore((s) => s.setTokens);
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      authApi.login(input),
    onSuccess: (tokens) => {
      setTokens({
        access: tokens.access_token,
        refresh: tokens.refresh_token,
      });
    },
    onError: (err) =>
      toast.error("Couldn't sign in", {
        description:
          err instanceof Error ? err.message : "Check your email and password.",
      }),
  });
}
```

- [ ] **Step 3: Setup hook**

Create `patient-portal/src/features/auth/hooks/use-setup.ts`:

```ts
import { useMutation, useQuery } from "@tanstack/react-query";
import { authApi } from "@/features/auth/api/auth-api";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/lib/toast";

export function useSetupVerify(token: string | null) {
  return useQuery({
    queryKey: ["setup-verify", token],
    queryFn: () => authApi.setupVerify(token as string),
    enabled: Boolean(token),
    retry: false,
  });
}

export function useSetup() {
  const setTokens = useAuthStore((s) => s.setTokens);
  return useMutation({
    mutationFn: (input: { token: string; password: string }) =>
      authApi.setup(input),
    onSuccess: (tokens) => {
      setTokens({
        access: tokens.access_token,
        refresh: tokens.refresh_token,
      });
      toast.success("Welcome! Your account is ready.");
    },
    onError: (err) =>
      toast.error("Couldn't set password", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}
```

- [ ] **Step 4: Reset hook**

Create `patient-portal/src/features/auth/hooks/use-request-reset.ts`:

```ts
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/features/auth/api/auth-api";
import { toast } from "@/lib/toast";

export function useRequestReset() {
  return useMutation({
    mutationFn: (email: string) => authApi.requestReset(email),
    onSuccess: () => {
      toast.success(
        "If that email is on file, a reset link is on its way."
      );
    },
  });
}
```

- [ ] **Step 5: Me hook**

Create `patient-portal/src/features/auth/hooks/use-me.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/features/auth/api/auth-api";
import { useAuthStore } from "@/stores/auth-store";
import { useEffect } from "react";

export function useMe() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setMe = useAuthStore((s) => s.setMe);
  const query = useQuery({
    queryKey: ["me"],
    queryFn: authApi.me,
    enabled: Boolean(accessToken),
    retry: false,
  });
  useEffect(() => {
    if (query.data) setMe(query.data);
  }, [query.data, setMe]);
  return query;
}
```

- [ ] **Step 6: Typecheck**

```bash
cd patient-portal && npm run typecheck
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add patient-portal/src/features/auth/api patient-portal/src/features/auth/hooks
git commit -m "feat(patient-portal): auth API client + React Query hooks"
```

---

### Task 17: Public + Protected route gates

**Files:**
- Create: `patient-portal/src/features/auth/components/PublicRoute.tsx`
- Create: `patient-portal/src/features/auth/components/ProtectedRoute.tsx`

- [ ] **Step 1: PublicRoute**

Create `patient-portal/src/features/auth/components/PublicRoute.tsx`:

```tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { ROUTES } from "@/config/constants";

/** Bounces signed-in patients away from /login + /setup + /reset. */
export function PublicRoute() {
  const token = useAuthStore((s) => s.accessToken);
  if (token) return <Navigate to={ROUTES.dashboard} replace />;
  return <Outlet />;
}
```

- [ ] **Step 2: ProtectedRoute**

Create `patient-portal/src/features/auth/components/ProtectedRoute.tsx`:

```tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { ROUTES } from "@/config/constants";
import { useMe } from "@/features/auth/hooks/use-me";
import { Spinner } from "@/components/ui/Spinner";

export function ProtectedRoute() {
  const token = useAuthStore((s) => s.accessToken);
  const { isLoading, isError } = useMe();

  if (!token) return <Navigate to={ROUTES.login} replace />;
  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }
  if (isError) return <Navigate to={ROUTES.login} replace />;
  return <Outlet />;
}
```

- [ ] **Step 3: Typecheck**

```bash
cd patient-portal && npm run typecheck
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add patient-portal/src/features/auth/components
git commit -m "feat(patient-portal): public + protected route gates"
```

---

### Task 18: LoginPage

**Files:**
- Create: `patient-portal/src/features/auth/LoginPage.tsx`

- [ ] **Step 1: Write the page**

Create `patient-portal/src/features/auth/LoginPage.tsx`:

```tsx
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Spinner } from "@/components/ui/Spinner";
import { useForm, zodResolver, z } from "@/lib/form";
import { useLogin } from "@/features/auth/hooks/use-login";
import { ROUTES } from "@/config/constants";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Required"),
});
type Values = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const submit = handleSubmit(async (values) => {
    await login.mutateAsync(values);
    navigate(ROUTES.dashboard);
  });

  return (
    <div className="min-h-screen bg-bg grid place-items-center px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="size-12 rounded-full bg-primary grid place-items-center text-primary-foreground font-bold text-xl mx-auto">
            P
          </div>
          <h1 className="text-2xl font-bold text-foreground">Sign in</h1>
          <p className="text-muted">Welcome back. Sign in to your portal.</p>
        </div>

        <Card>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <FormField
              label="Email"
              htmlFor="email"
              required
              error={errors.email?.message}
            >
              <Input
                id="email"
                type="email"
                autoComplete="email"
                {...register("email")}
                invalid={Boolean(errors.email)}
              />
            </FormField>

            <FormField
              label="Password"
              htmlFor="password"
              required
              error={errors.password?.message}
            >
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
                invalid={Boolean(errors.password)}
              />
            </FormField>

            <Button
              type="submit"
              className="w-full"
              disabled={login.isPending}
            >
              {login.isPending && <Spinner />}
              {login.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-muted">
          Need help signing in? Contact your provider.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd patient-portal && npm run typecheck
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add patient-portal/src/features/auth/LoginPage.tsx
git commit -m "feat(patient-portal): LoginPage"
```

---

### Task 19: SetupPage

**Files:**
- Create: `patient-portal/src/features/auth/SetupPage.tsx`

- [ ] **Step 1: Write the page**

Create `patient-portal/src/features/auth/SetupPage.tsx`:

```tsx
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Spinner } from "@/components/ui/Spinner";
import { useForm, zodResolver, z } from "@/lib/form";
import { useSetup, useSetupVerify } from "@/features/auth/hooks/use-setup";
import { ROUTES } from "@/config/constants";

const schema = z
  .object({
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });
type Values = z.infer<typeof schema>;

export function SetupPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token");
  const verify = useSetupVerify(token);
  const setup = useSetup();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const submit = handleSubmit(async (values) => {
    if (!token) return;
    await setup.mutateAsync({ token, password: values.password });
    navigate(ROUTES.dashboard);
  });

  if (!token) {
    return (
      <div className="min-h-screen bg-bg grid place-items-center px-6">
        <Card className="max-w-md w-full text-center space-y-3">
          <h1 className="text-xl font-bold">Missing setup link</h1>
          <p className="text-muted text-sm">
            Open the setup link your provider shared with you.
          </p>
        </Card>
      </div>
    );
  }

  if (verify.isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  if (verify.isError || !verify.data) {
    return (
      <div className="min-h-screen bg-bg grid place-items-center px-6">
        <Card className="max-w-md w-full text-center space-y-3">
          <h1 className="text-xl font-bold">Link expired</h1>
          <p className="text-muted text-sm">
            This setup link is no longer valid. Ask your provider for a fresh
            invite.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg grid place-items-center px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="size-12 rounded-full bg-primary grid place-items-center text-primary-foreground font-bold text-xl mx-auto">
            P
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome, {verify.data.first_name}
          </h1>
          <p className="text-muted">
            Set a password for {verify.data.masked_email} to finish setup.
          </p>
        </div>

        <Card>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <FormField
              label="New password"
              htmlFor="password"
              required
              hint="At least 8 characters."
              error={errors.password?.message}
            >
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register("password")}
                invalid={Boolean(errors.password)}
              />
            </FormField>

            <FormField
              label="Confirm password"
              htmlFor="confirm"
              required
              error={errors.confirm?.message}
            >
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                {...register("confirm")}
                invalid={Boolean(errors.confirm)}
              />
            </FormField>

            <Button
              type="submit"
              className="w-full"
              disabled={setup.isPending}
            >
              {setup.isPending && <Spinner />}
              {setup.isPending ? "Setting up…" : "Set password & sign in"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd patient-portal && npm run typecheck
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add patient-portal/src/features/auth/SetupPage.tsx
git commit -m "feat(patient-portal): SetupPage"
```

---

### Task 20: ResetPage

**Files:**
- Create: `patient-portal/src/features/auth/ResetPage.tsx`

- [ ] **Step 1: Write the page**

Create `patient-portal/src/features/auth/ResetPage.tsx`:

```tsx
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Spinner } from "@/components/ui/Spinner";
import { useForm, zodResolver, z } from "@/lib/form";
import { useAuthStore } from "@/stores/auth-store";
import { authApi } from "@/features/auth/api/auth-api";
import { useRequestReset } from "@/features/auth/hooks/use-request-reset";
import { toast } from "@/lib/toast";
import { ROUTES } from "@/config/constants";

const resetSchema = z
  .object({
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });
type ResetValues = z.infer<typeof resetSchema>;

const requestSchema = z.object({
  email: z.string().email("Enter a valid email"),
});
type RequestValues = z.infer<typeof requestSchema>;

export function ResetPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token");

  if (token) return <FinishReset token={token} onDone={() => navigate(ROUTES.dashboard)} />;
  return <RequestReset />;
}

function RequestReset() {
  const ask = useRequestReset();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestValues>({ resolver: zodResolver(requestSchema) });

  const submit = handleSubmit(async (values) => {
    await ask.mutateAsync(values.email);
  });

  return (
    <div className="min-h-screen bg-bg grid place-items-center px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Reset password</h1>
          <p className="text-muted">
            Enter your email and we'll send a reset link.
          </p>
        </div>
        <Card>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <FormField label="Email" htmlFor="email" required error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                {...register("email")}
                invalid={Boolean(errors.email)}
              />
            </FormField>
            <Button type="submit" className="w-full" disabled={ask.isPending}>
              {ask.isPending && <Spinner />}
              {ask.isPending ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function FinishReset({ token, onDone }: { token: string; onDone: () => void }) {
  const setTokens = useAuthStore((s) => s.setTokens);
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetValues>({ resolver: zodResolver(resetSchema) });

  const submit = handleSubmit(async (values) => {
    setBusy(true);
    try {
      const tokens = await authApi.reset({ token, password: values.password });
      setTokens({
        access: tokens.access_token,
        refresh: tokens.refresh_token,
      });
      toast.success("Password reset. You're signed in.");
      onDone();
    } catch (err) {
      toast.error("Couldn't reset password", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  });

  return (
    <div className="min-h-screen bg-bg grid place-items-center px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Choose a new password</h1>
        </div>
        <Card>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <FormField
              label="New password"
              htmlFor="password"
              required
              hint="At least 8 characters."
              error={errors.password?.message}
            >
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register("password")}
                invalid={Boolean(errors.password)}
              />
            </FormField>
            <FormField
              label="Confirm password"
              htmlFor="confirm"
              required
              error={errors.confirm?.message}
            >
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                {...register("confirm")}
                invalid={Boolean(errors.confirm)}
              />
            </FormField>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Spinner />}
              {busy ? "Saving…" : "Save & sign in"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd patient-portal && npm run typecheck
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add patient-portal/src/features/auth/ResetPage.tsx
git commit -m "feat(patient-portal): ResetPage (request + finish flows)"
```

---

### Task 21: Dashboard API + hook + component subtree

**Files:**
- Create: `patient-portal/src/features/dashboard/api/dashboard-api.ts`
- Create: `patient-portal/src/features/dashboard/hooks/use-dashboard.ts`
- Create: `patient-portal/src/features/dashboard/components/Greeting.tsx`
- Create: `patient-portal/src/features/dashboard/components/NextAppointment.tsx`
- Create: `patient-portal/src/features/dashboard/components/Actions.tsx`
- Create: `patient-portal/src/features/dashboard/components/RecentMessage.tsx`
- Create: `patient-portal/src/features/dashboard/components/RecentDocuments.tsx`
- Create: `patient-portal/src/features/dashboard/DashboardPage.tsx`

- [ ] **Step 1: API client**

Create `patient-portal/src/features/dashboard/api/dashboard-api.ts`:

```ts
import { api } from "@/lib/api-client";

export interface DashboardGreeting {
  first_name: string;
}

export interface DashboardNextAppointment {
  id: string;
  starts_at: string;
  provider_name: string | null;
  specialty: string | null;
  location: string | null;
  appointment_type: string | null;
}

export interface DashboardPendingActions {
  forms_count: number;
  tasks_count: number;
  total: number;
}

export interface DashboardRecentMessage {
  conversation_id: string;
  sender_name: string | null;
  preview: string;
  sent_at: string;
}

export interface DashboardRecentDocument {
  id: string;
  name: string;
  category: string;
  created_at: string;
}

export interface DashboardOut {
  greeting: DashboardGreeting;
  next_appointment: DashboardNextAppointment | null;
  pending_actions: DashboardPendingActions;
  recent_message: DashboardRecentMessage | null;
  recent_documents: DashboardRecentDocument[];
}

export const dashboardApi = {
  get: (): Promise<DashboardOut> =>
    api.get<DashboardOut>("/patient-portal/me/dashboard"),
};
```

- [ ] **Step 2: Hook**

Create `patient-portal/src/features/dashboard/hooks/use-dashboard.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/features/dashboard/api/dashboard-api";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: dashboardApi.get,
  });
}
```

- [ ] **Step 3: Greeting**

Create `patient-portal/src/features/dashboard/components/Greeting.tsx`:

```tsx
import { timeOfDayGreeting } from "@/lib/utils";

export function Greeting({ firstName }: { firstName: string }) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
        Good {timeOfDayGreeting()}, {firstName}
      </h1>
      <p className="text-muted">Here's what's happening with your care.</p>
    </div>
  );
}
```

- [ ] **Step 4: NextAppointment**

Create `patient-portal/src/features/dashboard/components/NextAppointment.tsx`:

```tsx
import { CalendarClock, MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { humanWhen } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { DashboardNextAppointment } from "@/features/dashboard/api/dashboard-api";

export function NextAppointment({ appt }: { appt: DashboardNextAppointment }) {
  return (
    <Card>
      <div className="flex items-start gap-4">
        <div className="size-12 rounded-full bg-primary-soft text-primary grid place-items-center shrink-0">
          <CalendarClock className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-muted font-semibold mb-1">
            Next appointment
          </div>
          <div className="text-lg font-bold tabular-nums">
            {humanWhen(appt.starts_at)}
          </div>
          {appt.provider_name && (
            <div className="text-sm text-muted mt-0.5">
              with {appt.provider_name}
              {appt.specialty ? ` · ${appt.specialty}` : ""}
            </div>
          )}
          {appt.location && (
            <div className="flex items-center gap-1.5 text-sm text-muted mt-2">
              <MapPin className="size-3.5" />
              {appt.location}
            </div>
          )}
          <div className="mt-4">
            <Button
              size="md"
              onClick={() => toast.info("Appointment details — coming soon")}
            >
              View details
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 5: Actions**

Create `patient-portal/src/features/dashboard/components/Actions.tsx`:

```tsx
import { CheckCircle2, ListTodo } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import type { DashboardPendingActions } from "@/features/dashboard/api/dashboard-api";

export function Actions({ data }: { data: DashboardPendingActions }) {
  if (data.total === 0) {
    return (
      <Card className="border-primary/20 bg-primary-soft/40">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-6 text-primary" />
          <div>
            <div className="font-semibold text-foreground">
              You're all caught up
            </div>
            <div className="text-sm text-muted">No pending actions right now.</div>
          </div>
        </div>
      </Card>
    );
  }
  return (
    <Card>
      <div className="flex items-start gap-4">
        <div className="size-12 rounded-full bg-warning/10 text-warning grid place-items-center shrink-0">
          <ListTodo className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-muted font-semibold mb-1">
            Things to do
          </div>
          <div className="text-lg font-bold">
            You have {data.total} {data.total === 1 ? "item" : "items"}
          </div>
          <div className="text-sm text-muted mt-0.5">
            {data.forms_count} {data.forms_count === 1 ? "form" : "forms"} ·{" "}
            {data.tasks_count} {data.tasks_count === 1 ? "task" : "tasks"}
          </div>
          <div className="mt-4">
            <Button
              size="md"
              onClick={() => toast.info("Your to-do list — coming soon")}
            >
              View list
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 6: RecentMessage**

Create `patient-portal/src/features/dashboard/components/RecentMessage.tsx`:

```tsx
import { MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import type { DashboardRecentMessage } from "@/features/dashboard/api/dashboard-api";

function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

export function RecentMessage({ msg }: { msg: DashboardRecentMessage }) {
  return (
    <Card>
      <div className="flex items-start gap-4">
        <div className="size-12 rounded-full bg-primary-soft text-primary grid place-items-center shrink-0">
          <MessageCircle className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-muted font-semibold mb-1">
            Latest message
          </div>
          {msg.sender_name && (
            <div className="text-sm font-semibold text-foreground">
              {msg.sender_name}{" "}
              <span className="text-muted font-normal">
                · {relativeTime(msg.sent_at)}
              </span>
            </div>
          )}
          <p className="text-sm text-muted mt-1 line-clamp-2">{msg.preview}</p>
          <div className="mt-4">
            <Button
              size="md"
              onClick={() => toast.info("Messages — coming soon")}
            >
              Open message
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 7: RecentDocuments**

Create `patient-portal/src/features/dashboard/components/RecentDocuments.tsx`:

```tsx
import { FileText } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { DashboardRecentDocument } from "@/features/dashboard/api/dashboard-api";

export function RecentDocuments({ docs }: { docs: DashboardRecentDocument[] }) {
  if (docs.length === 0) return null;
  return (
    <Card>
      <div className="text-xs uppercase tracking-wider text-muted font-semibold mb-3">
        Recent documents
      </div>
      <ul className="space-y-2">
        {docs.map((d) => (
          <li
            key={d.id}
            className="flex items-center gap-3 rounded-2xl border border-border px-3 py-2"
          >
            <div className="size-9 rounded-full bg-primary-soft text-primary grid place-items-center shrink-0">
              <FileText className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{d.name}</div>
              <div className="text-xs text-muted">
                {d.category} · {formatDate(d.created_at)}
              </div>
            </div>
            <Button
              size="md"
              variant="secondary"
              onClick={() => toast.info("Documents — coming soon")}
            >
              View
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
```

- [ ] **Step 8: DashboardPage**

Create `patient-portal/src/features/dashboard/DashboardPage.tsx`:

```tsx
import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";
import { Spinner } from "@/components/ui/Spinner";
import { Card } from "@/components/ui/Card";
import { Greeting } from "./components/Greeting";
import { NextAppointment } from "./components/NextAppointment";
import { Actions } from "./components/Actions";
import { RecentMessage } from "./components/RecentMessage";
import { RecentDocuments } from "./components/RecentDocuments";

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboard();

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="text-center space-y-3">
        <div className="font-semibold">Couldn't load your dashboard</div>
        <p className="text-muted text-sm">Pull-to-refresh or try again.</p>
        <button
          onClick={() => refetch()}
          className="text-primary text-sm font-semibold underline"
        >
          Try again
        </button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Greeting firstName={data.greeting.first_name} />
      {data.next_appointment && <NextAppointment appt={data.next_appointment} />}
      <Actions data={data.pending_actions} />
      {data.recent_message && <RecentMessage msg={data.recent_message} />}
      <RecentDocuments docs={data.recent_documents} />
    </div>
  );
}
```

- [ ] **Step 9: Typecheck**

```bash
cd patient-portal && npm run typecheck
```

Expected: no output.

- [ ] **Step 10: Commit**

```bash
git add patient-portal/src/features/dashboard
git commit -m "feat(patient-portal): dashboard page + composed cards"
```

---

### Task 22: Wire the real router (replace placeholders)

**Files:**
- Modify: `patient-portal/src/app/router.tsx`

- [ ] **Step 1: Replace the placeholder router**

Replace the contents of `patient-portal/src/app/router.tsx`:

```tsx
import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "@/components/layout/Shell";
import { LoginPage } from "@/features/auth/LoginPage";
import { SetupPage } from "@/features/auth/SetupPage";
import { ResetPage } from "@/features/auth/ResetPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { PublicRoute } from "@/features/auth/components/PublicRoute";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { ROUTES } from "@/config/constants";

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path={ROUTES.login} element={<LoginPage />} />
        <Route path={ROUTES.setup} element={<SetupPage />} />
        <Route path={ROUTES.reset} element={<ResetPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<Shell />}>
          <Route path={ROUTES.dashboard} element={<DashboardPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
    </Routes>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd patient-portal && npm run typecheck
```

Expected: no output.

- [ ] **Step 3: Build**

```bash
cd patient-portal && npm run build
```

Expected: a successful build with a `dist/` output.

- [ ] **Step 4: Commit**

```bash
git add patient-portal/src/app/router.tsx
git commit -m "feat(patient-portal): wire real router (login / setup / reset / dashboard)"
```

---

## Phase D — End-to-end smoke test

### Task 23: Manual happy-path verification

This task is manual — no code, just verification that the foundation works end to end. Make sure both servers are running.

- [ ] **Step 1: Start both servers**

Terminal 1 — backend:

```bash
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000
```

Terminal 2 — patient portal:

```bash
cd patient-portal && npm run dev
```

Terminal 3 — provider portal:

```bash
cd frontend && npm run dev
```

- [ ] **Step 2: Provider issues an invite**

In the provider portal (http://localhost:5173):
1. Log in as any provider/admin
2. Open any patient profile that has an email on file
3. Click the new "Invite to portal" button next to Edit / Remove
4. A green strip appears with the setup URL
5. Click "Copy"

Expected: success toast, URL is in your clipboard.

- [ ] **Step 3: Patient completes setup**

Open the copied URL in a fresh browser window/incognito (the URL goes to http://localhost:5174/setup?token=…):

1. Page shows "Welcome, {first_name}" + masked email
2. Enter a password (≥ 8 chars), confirm it
3. Click "Set password & sign in"

Expected: lands on http://localhost:5174/ with the dashboard rendered.

- [ ] **Step 4: Verify dashboard content**

The dashboard shows:
1. "Good {morning/afternoon/evening}, {first_name}" header
2. "Next appointment" card if the patient has one upcoming
3. Either "You're all caught up" (zero) or "You have N items" (with form / task counts)
4. "Latest message" card if the patient has any conversation
5. Up to 3 "Recent documents" rows

Expected: all sections render without errors. Coming-soon toasts fire when buttons are clicked.

- [ ] **Step 5: Verify token isolation**

In the browser's devtools console while on http://localhost:5174:

```js
localStorage.getItem("padmavat-portal.access_token")
```

Copy the value, then in a separate fetch:

```bash
curl -X GET http://localhost:8000/api/v1/users \
  -H "Authorization: Bearer <patient_token>"
```

Expected: `{"detail":"Could not validate credentials"}` — the patient token is rejected on the staff endpoint.

Now try a staff token on the patient endpoint:

```bash
# Get a staff token from http://localhost:5173 localStorage
curl -X GET http://localhost:8000/api/v1/patient-portal/me \
  -H "Authorization: Bearer <staff_token>"
```

Expected: `{"detail":"Could not validate credentials"}` — the staff token is rejected on the patient endpoint.

- [ ] **Step 6: Verify sign-out + login**

In the patient portal:
1. Click "Sign out" in the header
2. Lands on /login
3. Enter the email + password from Step 3
4. Click "Sign in"

Expected: lands back on the dashboard with the same content.

- [ ] **Step 7: Final commit (smoke test passes)**

If everything above worked:

```bash
git commit --allow-empty -m "test(patient-portal): foundation smoke test passes end-to-end"
```

If something failed, capture the failure mode in the issue tracker and fix before declaring done.

---

## Done criteria

All of the following must be true:

1. `alembic current` shows `0014_patient_portal_auth (head)`.
2. `cd backend && pytest tests/test_token_type.py tests/test_patient_auth_service.py` — all tests green.
3. `cd frontend && npm run typecheck` — clean.
4. `cd patient-portal && npm run typecheck && npm run build` — both clean.
5. Provider can issue an invite → patient can complete setup → patient lands on a dashboard with real data → patient can sign out and back in.
6. Patient JWT rejected by staff endpoints. Staff JWT rejected by patient endpoints.
