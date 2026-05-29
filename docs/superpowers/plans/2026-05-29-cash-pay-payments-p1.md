# Cash-Pay Payments — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the foundation of cash-pay billing: service catalog,
charges on encounters, invoices, cash + Stripe online payments, PDF
receipts, and the Stripe webhook.

**Architecture:** Five new tables (`service_catalog`, `charges`,
`invoices`, `payments`, `refunds` — refunds DDL only, used in P3) plus
`patient.stripe_customer_id`. All money is **integer cents**. Stripe
webhook is the authoritative confirmation; the browser callback only
nudges the UI. PCI scope is minimised via Stripe Elements — no card
numbers touch our server.

**Tech Stack:** Backend additions: `stripe` (Python SDK), `reportlab`
(already in deps for receipt PDF). Frontend additions: `@stripe/stripe-js`
+ `@stripe/react-stripe-js` (both portals).

**Spec:** [`docs/superpowers/specs/2026-05-29-cash-pay-payments-design.md`](../specs/2026-05-29-cash-pay-payments-design.md)

---

## File structure

### Backend (new)

- `backend/alembic/versions/0022_payments_v1.py` — single migration for
  all 5 tables + `patient.stripe_customer_id`
- `backend/app/models/service_catalog.py`
- `backend/app/models/charge.py`
- `backend/app/models/invoice.py`
- `backend/app/models/payment.py`
- `backend/app/models/refund.py` *(DDL only; service lands in P3)*
- `backend/app/schemas/service_catalog.py`
- `backend/app/schemas/charge.py`
- `backend/app/schemas/invoice.py`
- `backend/app/schemas/payment.py`
- `backend/app/services/service_catalog_service.py`
- `backend/app/services/charge_service.py`
- `backend/app/services/invoice_service.py`
- `backend/app/services/payment_service.py`
- `backend/app/services/receipt_pdf_service.py`
- `backend/app/integrations/stripe_client.py`
- `backend/app/api/v1/endpoints/service_catalog.py`
- `backend/app/api/v1/endpoints/charges.py`
- `backend/app/api/v1/endpoints/invoices.py`
- `backend/app/api/v1/endpoints/payments.py`
- `backend/app/api/v1/endpoints/stripe_webhook.py`

### Backend (modified)

- `backend/pyproject.toml` — add `stripe` dep
- `backend/app/core/config.py` — Stripe + receipt env keys
- `backend/app/models/patient.py` — add `stripe_customer_id`
- `backend/app/models/__init__.py` — export new models
- `backend/app/api/v1/router.py` — wire 5 new routers

### Tests

- `backend/tests/test_service_catalog_service.py`
- `backend/tests/test_charge_service.py`
- `backend/tests/test_invoice_service.py`
- `backend/tests/test_payment_service.py`
- `backend/tests/test_stripe_webhook.py`

### Frontend — provider portal (new)

- `frontend/src/features/billing/api/services-api.ts`
- `frontend/src/features/billing/api/charges-api.ts`
- `frontend/src/features/billing/api/invoices-api.ts`
- `frontend/src/features/billing/api/payments-api.ts`
- `frontend/src/features/billing/hooks/use-services.ts`
- `frontend/src/features/billing/hooks/use-charges.ts`
- `frontend/src/features/billing/hooks/use-invoices.ts`
- `frontend/src/features/billing/hooks/use-payments.ts`
- `frontend/src/features/billing/ServicesCatalogPage.tsx`
- `frontend/src/features/billing/components/ServiceFormModal.tsx`
- `frontend/src/features/billing/components/ChargesPanel.tsx`
- `frontend/src/features/billing/components/AddChargeModal.tsx`
- `frontend/src/features/billing/components/PatientBillingTab.tsx`
- `frontend/src/features/billing/components/TakeCashPaymentModal.tsx`

### Frontend — provider portal (modified)

- `frontend/src/app/router.tsx` — `/settings/services` route
- `frontend/src/features/settings/SettingsPage.tsx` — Services & Pricing tab
- `frontend/src/features/patients/PatientProfilePage.tsx` — Billing tab
- `frontend/src/features/encounter/EncounterPage.tsx` (or equivalent) — ChargesPanel slot

### Frontend — patient portal (new)

- `patient-portal/src/features/billing/api/billing-api.ts`
- `patient-portal/src/features/billing/hooks/use-billing.ts`
- `patient-portal/src/features/billing/BillingPage.tsx`
- `patient-portal/src/features/billing/components/PayInvoiceModal.tsx`

### Frontend — patient portal (modified)

- `patient-portal/package.json` — add `@stripe/stripe-js`, `@stripe/react-stripe-js`
- `patient-portal/src/config/constants.ts` — `ROUTES.billing`
- `patient-portal/src/components/layout/Topbar.tsx` — Billing nav item
- `patient-portal/src/app/router.tsx` — `/billing` route

---

## Money handling — house rules

**Read these before writing any task.** Violations cause silent
financial bugs that take weeks to find.

1. All money fields are **integer cents** in DB + Pydantic.
2. Never `float(price)`. Never `Decimal / 100`. Use `cents // 100` for
   dollars and `cents % 100` for the remainder.
3. Pydantic schemas validate `>= 0` on every cents field.
4. Currency code is hard-coded `"usd"` in this phase.
5. Invoice numbers come from a sequential DB sequence —
   `nextval('invoice_number_seq')` — atomic, no gaps.
6. `invoice.paid_cents` and `invoice.balance_cents` are **derived
   columns**, recomputed on every payment/refund write inside a single
   transaction with row lock (`SELECT ... FOR UPDATE`).
7. Stripe webhook handler is idempotent on `event.id`. Replays write
   no rows.

---

## Task 0: Add `stripe` dependency

**Files:**
- Modify: `backend/pyproject.toml`

- [ ] **Step 1: Add `stripe` to dependencies**

In `backend/pyproject.toml`, add to the `dependencies` list:

```toml
"stripe>=11.0",
```

- [ ] **Step 2: Install**

```bash
cd backend && source .venv/bin/activate && pip install -e .
```

Expected: `Successfully installed stripe-11.x`

- [ ] **Step 3: Commit**

```bash
git add backend/pyproject.toml
git commit -m "chore(payments): add stripe dependency"
```

---

## Task 1: Stripe + receipt env keys

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/.env.example`

- [ ] **Step 1: Add Settings fields**

In `backend/app/core/config.py`, after the Daily block, add:

```python
    # Stripe — sign the BAA in the dashboard before flipping
    # ENVIRONMENT=production. Restricted key with payment_intents +
    # customers + refunds scope only.
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    # Practice name + address used on PDF receipts.
    PRACTICE_NAME: str = "Modern-EHR Clinic"
    PRACTICE_ADDRESS: str = ""
    PRACTICE_PHONE: str = ""
```

- [ ] **Step 2: Update `.env.example`**

Append to `backend/.env.example`:

```
# --- Payments ----------------------------------------------------------
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
PRACTICE_NAME=Modern-EHR Clinic
PRACTICE_ADDRESS=
PRACTICE_PHONE=
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/core/config.py backend/.env.example
git commit -m "chore(payments): Stripe + receipt env keys"
```

---

## Task 2: Alembic migration — 5 tables + patient column

**Files:**
- Create: `backend/alembic/versions/0022_payments_v1.py`

- [ ] **Step 1: Generate the empty revision**

```bash
cd backend && source .venv/bin/activate
alembic revision -m "payments v1" --rev-id 0022_payments_v1
```

- [ ] **Step 2: Write the migration body**

Replace the generated file's body with:

```python
"""payments v1

Revision ID: 0022_payments_v1
Revises: 0021_isolate_patient_convs
Create Date: 2026-05-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0022_payments_v1"
down_revision = "0021_isolate_patient_convs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Sequential invoice numbers — atomic, no gaps.
    op.execute("CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1000")

    op.add_column(
        "patients",
        sa.Column("stripe_customer_id", sa.String(64), nullable=True),
    )

    op.create_table(
        "service_catalog",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(32), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "category",
            sa.String(32),
            nullable=False,
            server_default="visit",
        ),
        sa.Column(
            "price_cents", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "tax_rate_bp", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "taxable", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
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
        sa.CheckConstraint("price_cents >= 0", name="ck_svc_price_nonneg"),
        sa.CheckConstraint(
            "tax_rate_bp >= 0 AND tax_rate_bp <= 10000",
            name="ck_svc_tax_bp_range",
        ),
    )
    op.create_index("ix_service_catalog_active", "service_catalog", ["is_active"])

    op.create_table(
        "invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("number", sa.String(32), nullable=False, unique=True),
        sa.Column(
            "patient_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("patients.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "status",
            sa.String(24),
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "subtotal_cents", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "discount_cents", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "tax_cents", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "total_cents", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "paid_cents", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "balance_cents", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "issued_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column(
            "due_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column("notes", sa.Text(), nullable=True),
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
        sa.CheckConstraint(
            "paid_cents >= 0 AND total_cents >= 0",
            name="ck_inv_amounts_nonneg",
        ),
        sa.CheckConstraint(
            "status IN ('draft','open','paid','partially_paid','void','refunded')",
            name="ck_inv_status",
        ),
    )
    op.create_index("ix_invoices_status", "invoices", ["status"])

    op.create_table(
        "charges",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "patient_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("patients.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "encounter_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("encounters.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "appointment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("appointments.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "service_catalog_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("service_catalog.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("description", sa.String(255), nullable=False),
        sa.Column("code", sa.String(32), nullable=False),
        sa.Column(
            "quantity", sa.Integer(), nullable=False, server_default="1"
        ),
        sa.Column("unit_price_cents", sa.Integer(), nullable=False),
        sa.Column(
            "discount_cents", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "tax_cents", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column("total_cents", sa.Integer(), nullable=False),
        sa.Column(
            "invoice_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("invoices.id", ondelete="RESTRICT"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "voided_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column(
            "voided_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("quantity > 0", name="ck_charge_qty_pos"),
        sa.CheckConstraint(
            "unit_price_cents >= 0 AND discount_cents >= 0 AND tax_cents >= 0",
            name="ck_charge_amounts_nonneg",
        ),
    )

    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "invoice_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("invoices.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "patient_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("patients.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("method", sa.String(24), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.String(16),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "stripe_payment_intent_id",
            sa.String(128),
            nullable=True,
            unique=True,
        ),
        sa.Column("stripe_charge_id", sa.String(128), nullable=True),
        sa.Column("last4", sa.String(4), nullable=True),
        sa.Column("card_brand", sa.String(16), nullable=True),
        sa.Column("reference", sa.String(64), nullable=True),
        sa.Column(
            "received_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("amount_cents > 0", name="ck_pay_amount_pos"),
        sa.CheckConstraint(
            "method IN ('cash','check','card_present','stripe','adjustment')",
            name="ck_pay_method",
        ),
        sa.CheckConstraint(
            "status IN ('pending','succeeded','failed','cancelled')",
            name="ck_pay_status",
        ),
    )

    op.create_table(
        "refunds",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "payment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("payments.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(255), nullable=False),
        sa.Column(
            "stripe_refund_id", sa.String(128), nullable=True, unique=True
        ),
        sa.Column(
            "status",
            sa.String(16),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "refunded_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("amount_cents > 0", name="ck_refund_amount_pos"),
    )


def downgrade() -> None:
    op.drop_table("refunds")
    op.drop_table("payments")
    op.drop_index("ix_invoices_status", table_name="invoices")
    op.drop_table("charges")
    op.drop_table("invoices")
    op.drop_index("ix_service_catalog_active", table_name="service_catalog")
    op.drop_table("service_catalog")
    op.drop_column("patients", "stripe_customer_id")
    op.execute("DROP SEQUENCE IF EXISTS invoice_number_seq")
```

- [ ] **Step 3: Apply**

```bash
alembic upgrade head
```

Expected: `INFO  [alembic.runtime.migration] Running upgrade 0021_isolate_patient_convs -> 0022_payments_v1`

- [ ] **Step 4: Verify the sequence works**

```bash
psql $DATABASE_URL -c "SELECT nextval('invoice_number_seq');"
```

Expected: `1000`

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/0022_payments_v1.py
git commit -m "feat(payments): migration — service_catalog, invoices, charges, payments, refunds"
```

---

## Task 3: SQLAlchemy models

**Files:**
- Create: `backend/app/models/service_catalog.py`
- Create: `backend/app/models/invoice.py`
- Create: `backend/app/models/charge.py`
- Create: `backend/app/models/payment.py`
- Create: `backend/app/models/refund.py`
- Modify: `backend/app/models/patient.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: ServiceCatalog model**

Create `backend/app/models/service_catalog.py`:

```python
from __future__ import annotations

import enum
from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDMixin


class ServiceCategory(str, enum.Enum):
    visit = "visit"
    procedure = "procedure"
    lab = "lab"
    supply = "supply"
    membership = "membership"
    other = "other"


class ServiceCatalog(Base, UUIDMixin):
    __tablename__ = "service_catalog"

    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(32), default="visit", nullable=False)
    price_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tax_rate_bp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    taxable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
```

- [ ] **Step 2: Invoice model**

Create `backend/app/models/invoice.py`:

```python
from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.charge import Charge
    from app.models.patient import Patient
    from app.models.payment import Payment


class InvoiceStatus(str, enum.Enum):
    draft = "draft"
    open = "open"
    partially_paid = "partially_paid"
    paid = "paid"
    void = "void"
    refunded = "refunded"


class Invoice(Base, UUIDMixin):
    __tablename__ = "invoices"

    number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    patient_id: Mapped[UUID] = mapped_column(
        ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(24), default="draft", nullable=False, index=True)
    subtotal_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    discount_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tax_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    paid_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    balance_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    patient: Mapped[Patient] = relationship(back_populates="invoices")
    charges: Mapped[list[Charge]] = relationship(back_populates="invoice")
    payments: Mapped[list[Payment]] = relationship(back_populates="invoice")
```

- [ ] **Step 3: Charge model**

Create `backend/app/models/charge.py`:

```python
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.invoice import Invoice
    from app.models.patient import Patient


class Charge(Base, UUIDMixin):
    __tablename__ = "charges"

    patient_id: Mapped[UUID] = mapped_column(
        ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    encounter_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("encounters.id", ondelete="SET NULL"), index=True
    )
    appointment_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("appointments.id", ondelete="SET NULL"), index=True
    )
    service_catalog_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("service_catalog.id", ondelete="SET NULL")
    )
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    unit_price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    discount_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tax_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    invoice_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("invoices.id", ondelete="RESTRICT"), index=True
    )
    voided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    voided_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    patient: Mapped[Patient] = relationship(back_populates="charges")
    invoice: Mapped[Invoice | None] = relationship(back_populates="charges")
```

- [ ] **Step 4: Payment model**

Create `backend/app/models/payment.py`:

```python
from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.invoice import Invoice
    from app.models.patient import Patient


class PaymentMethod(str, enum.Enum):
    cash = "cash"
    check = "check"
    card_present = "card_present"
    stripe = "stripe"
    adjustment = "adjustment"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    succeeded = "succeeded"
    failed = "failed"
    cancelled = "cancelled"


class Payment(Base, UUIDMixin):
    __tablename__ = "payments"

    invoice_id: Mapped[UUID] = mapped_column(
        ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    patient_id: Mapped[UUID] = mapped_column(
        ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    method: Mapped[str] = mapped_column(String(24), nullable=False)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(128), unique=True)
    stripe_charge_id: Mapped[str | None] = mapped_column(String(128))
    last4: Mapped[str | None] = mapped_column(String(4))
    card_brand: Mapped[str | None] = mapped_column(String(16))
    reference: Mapped[str | None] = mapped_column(String(64))
    received_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    invoice: Mapped[Invoice] = relationship(back_populates="payments")
    patient: Mapped[Patient] = relationship(back_populates="payments")
```

- [ ] **Step 5: Refund model (DDL parity only — service lands in P3)**

Create `backend/app/models/refund.py`:

```python
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDMixin


class Refund(Base, UUIDMixin):
    __tablename__ = "refunds"

    payment_id: Mapped[UUID] = mapped_column(
        ForeignKey("payments.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    stripe_refund_id: Mapped[str | None] = mapped_column(String(128), unique=True)
    status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)
    refunded_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
```

- [ ] **Step 6: Patient model gets `stripe_customer_id` + relationships**

In `backend/app/models/patient.py`, add the column and back-populates:

```python
    stripe_customer_id: Mapped[str | None] = mapped_column(String(64))

    charges: Mapped[list["Charge"]] = relationship(back_populates="patient")
    invoices: Mapped[list["Invoice"]] = relationship(back_populates="patient")
    payments: Mapped[list["Payment"]] = relationship(back_populates="patient")
```

Add the matching `TYPE_CHECKING` imports for `Charge`, `Invoice`, `Payment`.

- [ ] **Step 7: Export from `__init__.py`**

Append to `backend/app/models/__init__.py`:

```python
from app.models.service_catalog import ServiceCatalog, ServiceCategory
from app.models.invoice import Invoice, InvoiceStatus
from app.models.charge import Charge
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.refund import Refund
```

- [ ] **Step 8: Boot check**

```bash
python -c "from app.main import create_app; create_app(); print('OK')"
```

Expected: `OK` (no import errors, no relationship mis-config).

- [ ] **Step 9: Commit**

```bash
git add backend/app/models/
git commit -m "feat(payments): SQLAlchemy models — service_catalog/charge/invoice/payment/refund"
```

---

## Task 4: Service Catalog — schemas + service + endpoints + tests (TDD)

**Files:**
- Create: `backend/app/schemas/service_catalog.py`
- Create: `backend/app/services/service_catalog_service.py`
- Create: `backend/app/api/v1/endpoints/service_catalog.py`
- Create: `backend/tests/test_service_catalog_service.py`
- Modify: `backend/app/api/v1/router.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_service_catalog_service.py`:

```python
import pytest

from app.schemas.service_catalog import ServiceCatalogCreate, ServiceCatalogUpdate
from app.services.service_catalog_service import ServiceCatalogService


@pytest.mark.asyncio
async def test_create_service_assigns_id(db_session):
    svc = ServiceCatalogService(db_session)
    out = await svc.create(
        ServiceCatalogCreate(
            code="VISIT-30",
            name="30-minute follow-up",
            category="visit",
            price_cents=12500,
        )
    )
    assert out.id is not None
    assert out.price_cents == 12500
    assert out.is_active is True


@pytest.mark.asyncio
async def test_soft_delete_marks_inactive(db_session):
    svc = ServiceCatalogService(db_session)
    out = await svc.create(
        ServiceCatalogCreate(code="LAB-CBC", name="CBC", category="lab", price_cents=4000)
    )
    await svc.deactivate(out.id)
    fetched = await svc.get(out.id)
    assert fetched.is_active is False


@pytest.mark.asyncio
async def test_list_filters_to_active_by_default(db_session):
    svc = ServiceCatalogService(db_session)
    a = await svc.create(ServiceCatalogCreate(code="A", name="A", category="visit", price_cents=100))
    b = await svc.create(ServiceCatalogCreate(code="B", name="B", category="visit", price_cents=200))
    await svc.deactivate(b.id)
    items, total = await svc.list(active_only=True)
    assert total == 1
    assert items[0].id == a.id


@pytest.mark.asyncio
async def test_create_rejects_negative_price(db_session):
    with pytest.raises(Exception):
        ServiceCatalogCreate(code="X", name="X", category="visit", price_cents=-1)
```

- [ ] **Step 2: Run the tests — verify they fail**

```bash
pytest tests/test_service_catalog_service.py -v
```

Expected: ImportError / ModuleNotFoundError for `service_catalog_service`.

- [ ] **Step 3: Write the schemas**

Create `backend/app/schemas/service_catalog.py`:

```python
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ServiceCatalogBase(BaseModel):
    code: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=255)
    category: str = Field(default="visit", max_length=32)
    price_cents: int = Field(ge=0)
    tax_rate_bp: int = Field(default=0, ge=0, le=10000)
    taxable: bool = False


class ServiceCatalogCreate(ServiceCatalogBase):
    pass


class ServiceCatalogUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    category: str | None = Field(default=None, max_length=32)
    price_cents: int | None = Field(default=None, ge=0)
    tax_rate_bp: int | None = Field(default=None, ge=0, le=10000)
    taxable: bool | None = None


class ServiceCatalogOut(ServiceCatalogBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 4: Write the service**

Create `backend/app/services/service_catalog_service.py`:

```python
from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.service_catalog import ServiceCatalog
from app.schemas.service_catalog import (
    ServiceCatalogCreate,
    ServiceCatalogOut,
    ServiceCatalogUpdate,
)


class ServiceCatalogService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, payload: ServiceCatalogCreate) -> ServiceCatalogOut:
        existing = (
            await self.db.execute(
                select(ServiceCatalog).where(ServiceCatalog.code == payload.code)
            )
        ).scalar_one_or_none()
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Service code '{payload.code}' already exists",
            )
        row = ServiceCatalog(**payload.model_dump())
        self.db.add(row)
        await self.db.commit()
        await self.db.refresh(row)
        return ServiceCatalogOut.model_validate(row)

    async def get(self, service_id: UUID) -> ServiceCatalogOut:
        row = await self.db.get(ServiceCatalog, service_id)
        if row is None:
            raise HTTPException(404, "Service not found")
        return ServiceCatalogOut.model_validate(row)

    async def update(
        self, service_id: UUID, payload: ServiceCatalogUpdate
    ) -> ServiceCatalogOut:
        row = await self.db.get(ServiceCatalog, service_id)
        if row is None:
            raise HTTPException(404, "Service not found")
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(row, k, v)
        await self.db.commit()
        await self.db.refresh(row)
        return ServiceCatalogOut.model_validate(row)

    async def deactivate(self, service_id: UUID) -> None:
        row = await self.db.get(ServiceCatalog, service_id)
        if row is None:
            raise HTTPException(404, "Service not found")
        row.is_active = False
        await self.db.commit()

    async def list(
        self,
        q: str | None = None,
        active_only: bool = True,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[ServiceCatalogOut], int]:
        stmt = select(ServiceCatalog)
        count_stmt = select(func.count(ServiceCatalog.id))
        if active_only:
            stmt = stmt.where(ServiceCatalog.is_active.is_(True))
            count_stmt = count_stmt.where(ServiceCatalog.is_active.is_(True))
        if q:
            like = f"%{q.strip()}%"
            stmt = stmt.where(
                ServiceCatalog.name.ilike(like) | ServiceCatalog.code.ilike(like)
            )
            count_stmt = count_stmt.where(
                ServiceCatalog.name.ilike(like) | ServiceCatalog.code.ilike(like)
            )
        total = (await self.db.execute(count_stmt)).scalar_one()
        stmt = (
            stmt.order_by(ServiceCatalog.name.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = (await self.db.execute(stmt)).scalars().all()
        return [ServiceCatalogOut.model_validate(r) for r in rows], total
```

- [ ] **Step 5: Write the endpoints (admin-only)**

Create `backend/app/api/v1/endpoints/service_catalog.py`:

```python
from math import ceil
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.deps import CurrentUser, DbSession, require_roles
from app.models.user import UserRole
from app.schemas.common import Page
from app.schemas.service_catalog import (
    ServiceCatalogCreate,
    ServiceCatalogOut,
    ServiceCatalogUpdate,
)
from app.services.service_catalog_service import ServiceCatalogService


router = APIRouter(prefix="/billing/services", tags=["billing-services"])

admin_only = Depends(require_roles(UserRole.admin))


@router.get("", response_model=Page[ServiceCatalogOut])
async def list_services(
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
    q: str | None = None,
    active_only: bool = True,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> Page[ServiceCatalogOut]:
    items, total = await ServiceCatalogService(db).list(
        q=q, active_only=active_only, page=page, page_size=page_size
    )
    return Page[ServiceCatalogOut](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=ceil(total / page_size) if page_size else 1,
    )


@router.post("", response_model=ServiceCatalogOut, status_code=201, dependencies=[admin_only])
async def create_service(
    payload: ServiceCatalogCreate, db: DbSession, current: CurrentUser  # noqa: ARG001
) -> ServiceCatalogOut:
    return await ServiceCatalogService(db).create(payload)


@router.patch("/{service_id}", response_model=ServiceCatalogOut, dependencies=[admin_only])
async def update_service(
    service_id: UUID,
    payload: ServiceCatalogUpdate,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
) -> ServiceCatalogOut:
    return await ServiceCatalogService(db).update(service_id, payload)


@router.delete("/{service_id}", status_code=204, dependencies=[admin_only])
async def deactivate_service(
    service_id: UUID, db: DbSession, current: CurrentUser  # noqa: ARG001
) -> None:
    await ServiceCatalogService(db).deactivate(service_id)
```

- [ ] **Step 6: Wire the router**

In `backend/app/api/v1/router.py`, import + include:

```python
from app.api.v1.endpoints import service_catalog
api_router.include_router(service_catalog.router)
```

- [ ] **Step 7: Run tests — verify pass**

```bash
pytest tests/test_service_catalog_service.py -v
```

Expected: 4 passed.

- [ ] **Step 8: Commit**

```bash
git add backend/app/schemas/service_catalog.py \
        backend/app/services/service_catalog_service.py \
        backend/app/api/v1/endpoints/service_catalog.py \
        backend/app/api/v1/router.py \
        backend/tests/test_service_catalog_service.py
git commit -m "feat(payments): service catalog CRUD (admin-only) + tests"
```

---

## Task 5: Charges — schemas + service + endpoints + tests (TDD)

**Files:**
- Create: `backend/app/schemas/charge.py`
- Create: `backend/app/services/charge_service.py`
- Create: `backend/app/api/v1/endpoints/charges.py`
- Create: `backend/tests/test_charge_service.py`
- Modify: `backend/app/api/v1/router.py`

- [ ] **Step 1: Tests first**

Create `backend/tests/test_charge_service.py`:

```python
import pytest

from app.schemas.charge import ChargeCreate
from app.services.charge_service import ChargeService
from app.services.service_catalog_service import ServiceCatalogService
from app.schemas.service_catalog import ServiceCatalogCreate


@pytest.mark.asyncio
async def test_create_from_catalog_snapshots_price_and_code(
    db_session, sample_patient_id, sample_user_id
):
    svc_cat = ServiceCatalogService(db_session)
    sv = await svc_cat.create(
        ServiceCatalogCreate(code="VISIT-30", name="30m visit", category="visit", price_cents=12000)
    )

    out = await ChargeService(db_session).create(
        ChargeCreate(patient_id=sample_patient_id, service_catalog_id=sv.id, quantity=1),
        viewer_id=sample_user_id,
    )
    assert out.code == "VISIT-30"
    assert out.unit_price_cents == 12000
    assert out.total_cents == 12000


@pytest.mark.asyncio
async def test_total_includes_discount_and_tax(db_session, sample_patient_id, sample_user_id):
    svc_cat = ServiceCatalogService(db_session)
    sv = await svc_cat.create(
        ServiceCatalogCreate(
            code="X-RAY",
            name="X-Ray",
            category="procedure",
            price_cents=10000,
            tax_rate_bp=825,
            taxable=True,
        )
    )
    out = await ChargeService(db_session).create(
        ChargeCreate(
            patient_id=sample_patient_id,
            service_catalog_id=sv.id,
            quantity=2,
            discount_cents=2000,
        ),
        viewer_id=sample_user_id,
    )
    # subtotal = 2 * 10000 = 20000
    # taxable_amount = 20000 - 2000 = 18000
    # tax = 18000 * 825 / 10000 = 1485
    # total = 18000 + 1485 = 19485
    assert out.tax_cents == 1485
    assert out.total_cents == 19485


@pytest.mark.asyncio
async def test_void_marks_voided_and_clears_uninvoiced(
    db_session, sample_patient_id, sample_user_id
):
    svc_cat = ServiceCatalogService(db_session)
    sv = await svc_cat.create(
        ServiceCatalogCreate(code="A", name="A", category="visit", price_cents=100)
    )
    out = await ChargeService(db_session).create(
        ChargeCreate(patient_id=sample_patient_id, service_catalog_id=sv.id),
        viewer_id=sample_user_id,
    )
    await ChargeService(db_session).void(out.id, viewer_id=sample_user_id, reason="error")
    fetched = await ChargeService(db_session).get(out.id)
    assert fetched.voided_at is not None
```

> **Conftest reminder:** the existing `tests/conftest.py` provides
> `db_session`. We need `sample_patient_id` + `sample_user_id` fixtures —
> add them in this task's Step 2 if they don't already exist.

- [ ] **Step 2: Add fixtures if missing**

If `sample_patient_id` / `sample_user_id` aren't in `tests/conftest.py`,
add them:

```python
import pytest_asyncio
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.core.security import hash_password


@pytest_asyncio.fixture
async def sample_user_id(db_session):
    u = User(
        email=f"u_{id(db_session)}@x.test",
        full_name="Test Provider",
        role=UserRole.provider,
        hashed_password=hash_password("test12345678"),
        is_active=True,
    )
    db_session.add(u)
    await db_session.flush()
    return u.id


@pytest_asyncio.fixture
async def sample_patient_id(db_session, sample_user_id):
    p = Patient(
        first_name="Test", last_name="Patient", mrn=f"MRN{id(db_session)}",
        email=f"p_{id(db_session)}@x.test",
    )
    db_session.add(p)
    await db_session.flush()
    return p.id
```

- [ ] **Step 3: Run — should fail**

```bash
pytest tests/test_charge_service.py -v
```

Expected: ImportError for `app.schemas.charge`.

- [ ] **Step 4: Write the schema**

Create `backend/app/schemas/charge.py`:

```python
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ChargeCreate(BaseModel):
    patient_id: UUID
    service_catalog_id: UUID | None = None
    encounter_id: UUID | None = None
    appointment_id: UUID | None = None
    quantity: int = Field(default=1, ge=1)
    discount_cents: int = Field(default=0, ge=0)

    # Either a catalog ref OR a free-form override must be present.
    description: str | None = Field(default=None, max_length=255)
    code: str | None = Field(default=None, max_length=32)
    unit_price_cents: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _require_catalog_or_freeform(self) -> "ChargeCreate":
        if self.service_catalog_id is None and not (
            self.description and self.code and self.unit_price_cents is not None
        ):
            raise ValueError(
                "Provide service_catalog_id, OR description + code + unit_price_cents."
            )
        return self


class ChargeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    encounter_id: UUID | None
    appointment_id: UUID | None
    service_catalog_id: UUID | None
    description: str
    code: str
    quantity: int
    unit_price_cents: int
    discount_cents: int
    tax_cents: int
    total_cents: int
    invoice_id: UUID | None
    voided_at: datetime | None
    created_at: datetime


class ChargeVoidIn(BaseModel):
    reason: str = Field(min_length=1, max_length=255)
```

- [ ] **Step 5: Write the service**

Create `backend/app/services/charge_service.py`:

```python
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.charge import Charge
from app.models.service_catalog import ServiceCatalog
from app.schemas.charge import ChargeCreate, ChargeOut


def _compute_tax_cents(taxable_subtotal: int, tax_rate_bp: int) -> int:
    """basis points: 825 == 8.25%. Truncate (don't round) so totals
    stay deterministic across read/write."""
    return (taxable_subtotal * tax_rate_bp) // 10_000


class ChargeService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(
        self, payload: ChargeCreate, *, viewer_id: UUID
    ) -> ChargeOut:
        catalog: ServiceCatalog | None = None
        if payload.service_catalog_id is not None:
            catalog = await self.db.get(ServiceCatalog, payload.service_catalog_id)
            if catalog is None or not catalog.is_active:
                raise HTTPException(404, "Service not found or inactive")

        # Snapshot description / code / unit price from the catalog,
        # OR from the free-form payload — guaranteed by ChargeCreate.
        description = (
            catalog.name if catalog is not None else payload.description  # type: ignore[union-attr]
        )
        code = (
            catalog.code if catalog is not None else payload.code  # type: ignore[union-attr]
        )
        unit_price_cents = (
            catalog.price_cents
            if catalog is not None
            else payload.unit_price_cents  # type: ignore[arg-type]
        )

        subtotal = unit_price_cents * payload.quantity
        taxable_after_discount = max(0, subtotal - payload.discount_cents)
        tax_cents = (
            _compute_tax_cents(taxable_after_discount, catalog.tax_rate_bp)
            if (catalog is not None and catalog.taxable)
            else 0
        )
        total = taxable_after_discount + tax_cents

        row = Charge(
            patient_id=payload.patient_id,
            encounter_id=payload.encounter_id,
            appointment_id=payload.appointment_id,
            service_catalog_id=payload.service_catalog_id,
            description=description,
            code=code,
            quantity=payload.quantity,
            unit_price_cents=unit_price_cents,
            discount_cents=payload.discount_cents,
            tax_cents=tax_cents,
            total_cents=total,
            created_by_user_id=viewer_id,
        )
        self.db.add(row)
        await self.db.commit()
        await self.db.refresh(row)
        return ChargeOut.model_validate(row)

    async def get(self, charge_id: UUID) -> ChargeOut:
        row = await self.db.get(Charge, charge_id)
        if row is None:
            raise HTTPException(404, "Charge not found")
        return ChargeOut.model_validate(row)

    async def list_for_patient(self, patient_id: UUID) -> list[ChargeOut]:
        rows = (
            await self.db.execute(
                select(Charge)
                .where(Charge.patient_id == patient_id)
                .order_by(Charge.created_at.desc())
            )
        ).scalars().all()
        return [ChargeOut.model_validate(r) for r in rows]

    async def void(
        self, charge_id: UUID, *, viewer_id: UUID, reason: str  # noqa: ARG002
    ) -> ChargeOut:
        row = await self.db.get(Charge, charge_id)
        if row is None:
            raise HTTPException(404, "Charge not found")
        if row.invoice_id is not None:
            raise HTTPException(
                409, "Charge is already on an invoice; void the invoice instead."
            )
        if row.voided_at is not None:
            return ChargeOut.model_validate(row)
        row.voided_at = datetime.now(timezone.utc)
        row.voided_by_user_id = viewer_id
        await self.db.commit()
        await self.db.refresh(row)
        return ChargeOut.model_validate(row)
```

- [ ] **Step 6: Write the endpoints**

Create `backend/app/api/v1/endpoints/charges.py`:

```python
from uuid import UUID

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.charge import ChargeCreate, ChargeOut, ChargeVoidIn
from app.services.charge_service import ChargeService


router = APIRouter(prefix="/billing/charges", tags=["billing-charges"])


@router.post("", response_model=ChargeOut, status_code=201)
async def create_charge(
    payload: ChargeCreate, db: DbSession, current: CurrentUser
) -> ChargeOut:
    return await ChargeService(db).create(payload, viewer_id=current.id)


@router.get("/{charge_id}", response_model=ChargeOut)
async def get_charge(
    charge_id: UUID, db: DbSession, current: CurrentUser  # noqa: ARG001
) -> ChargeOut:
    return await ChargeService(db).get(charge_id)


@router.post("/{charge_id}/void", response_model=ChargeOut)
async def void_charge(
    charge_id: UUID,
    payload: ChargeVoidIn,
    db: DbSession,
    current: CurrentUser,
) -> ChargeOut:
    return await ChargeService(db).void(
        charge_id, viewer_id=current.id, reason=payload.reason
    )
```

- [ ] **Step 7: Wire the router**

In `backend/app/api/v1/router.py`:

```python
from app.api.v1.endpoints import charges
api_router.include_router(charges.router)
```

- [ ] **Step 8: Run tests**

```bash
pytest tests/test_charge_service.py -v
```

Expected: 3 passed.

- [ ] **Step 9: Commit**

```bash
git add backend/app/schemas/charge.py \
        backend/app/services/charge_service.py \
        backend/app/api/v1/endpoints/charges.py \
        backend/tests/test_charge_service.py \
        backend/tests/conftest.py \
        backend/app/api/v1/router.py
git commit -m "feat(payments): charge service with snapshot pricing + tests"
```

---

## Task 6: Invoices — schemas + service + endpoints + tests (TDD)

**Files:**
- Create: `backend/app/schemas/invoice.py`
- Create: `backend/app/services/invoice_service.py`
- Create: `backend/app/api/v1/endpoints/invoices.py`
- Create: `backend/tests/test_invoice_service.py`
- Modify: `backend/app/api/v1/router.py`

- [ ] **Step 1: Tests first**

Create `backend/tests/test_invoice_service.py`:

```python
import pytest

from app.schemas.charge import ChargeCreate
from app.schemas.invoice import InvoiceIssueIn
from app.schemas.service_catalog import ServiceCatalogCreate
from app.services.charge_service import ChargeService
from app.services.invoice_service import InvoiceService
from app.services.service_catalog_service import ServiceCatalogService


@pytest.mark.asyncio
async def test_issue_invoice_attaches_charges_and_computes_totals(
    db_session, sample_patient_id, sample_user_id
):
    svc_cat = ServiceCatalogService(db_session)
    a = await svc_cat.create(
        ServiceCatalogCreate(code="V1", name="V1", category="visit", price_cents=10000)
    )
    b = await svc_cat.create(
        ServiceCatalogCreate(code="V2", name="V2", category="visit", price_cents=3500)
    )
    c1 = await ChargeService(db_session).create(
        ChargeCreate(patient_id=sample_patient_id, service_catalog_id=a.id),
        viewer_id=sample_user_id,
    )
    c2 = await ChargeService(db_session).create(
        ChargeCreate(patient_id=sample_patient_id, service_catalog_id=b.id),
        viewer_id=sample_user_id,
    )

    inv = await InvoiceService(db_session).issue(
        InvoiceIssueIn(patient_id=sample_patient_id, charge_ids=[c1.id, c2.id]),
        viewer_id=sample_user_id,
    )
    assert inv.status == "open"
    assert inv.subtotal_cents == 13500
    assert inv.total_cents == 13500
    assert inv.balance_cents == 13500
    assert inv.number.startswith("INV-")


@pytest.mark.asyncio
async def test_issue_rejects_charge_from_another_patient(
    db_session, sample_patient_id, sample_user_id
):
    # Create a charge under sample_patient_id, then try to issue under a
    # different patient → 400.
    svc_cat = ServiceCatalogService(db_session)
    sv = await svc_cat.create(
        ServiceCatalogCreate(code="X", name="X", category="visit", price_cents=100)
    )
    c = await ChargeService(db_session).create(
        ChargeCreate(patient_id=sample_patient_id, service_catalog_id=sv.id),
        viewer_id=sample_user_id,
    )
    from uuid import uuid4

    with pytest.raises(Exception):
        await InvoiceService(db_session).issue(
            InvoiceIssueIn(patient_id=uuid4(), charge_ids=[c.id]),
            viewer_id=sample_user_id,
        )


@pytest.mark.asyncio
async def test_recalc_after_payment_updates_balance(
    db_session, sample_patient_id, sample_user_id
):
    svc_cat = ServiceCatalogService(db_session)
    sv = await svc_cat.create(
        ServiceCatalogCreate(code="A", name="A", category="visit", price_cents=10000)
    )
    c = await ChargeService(db_session).create(
        ChargeCreate(patient_id=sample_patient_id, service_catalog_id=sv.id),
        viewer_id=sample_user_id,
    )
    inv = await InvoiceService(db_session).issue(
        InvoiceIssueIn(patient_id=sample_patient_id, charge_ids=[c.id]),
        viewer_id=sample_user_id,
    )
    # Simulate a partial payment of 6000 cents by writing the row directly.
    from app.models.payment import Payment
    db_session.add(
        Payment(
            invoice_id=inv.id,
            patient_id=sample_patient_id,
            method="cash",
            amount_cents=6000,
            status="succeeded",
        )
    )
    await db_session.commit()
    refreshed = await InvoiceService(db_session).recalc(inv.id)
    assert refreshed.paid_cents == 6000
    assert refreshed.balance_cents == 4000
    assert refreshed.status == "partially_paid"
```

- [ ] **Step 2: Run — should fail**

```bash
pytest tests/test_invoice_service.py -v
```

- [ ] **Step 3: Write the schema**

Create `backend/app/schemas/invoice.py`:

```python
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class InvoiceIssueIn(BaseModel):
    patient_id: UUID
    charge_ids: list[UUID] = Field(min_length=1)
    discount_cents: int = Field(default=0, ge=0)
    notes: str | None = None


class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    number: str
    patient_id: UUID
    status: str
    subtotal_cents: int
    discount_cents: int
    tax_cents: int
    total_cents: int
    paid_cents: int
    balance_cents: int
    issued_at: datetime | None
    due_at: datetime | None
    notes: str | None
    created_at: datetime
```

- [ ] **Step 4: Write the service**

Create `backend/app/services/invoice_service.py`:

```python
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.charge import Charge
from app.models.invoice import Invoice
from app.models.payment import Payment, PaymentStatus
from app.schemas.invoice import InvoiceIssueIn, InvoiceOut


def _make_number(year: int, seq: int) -> str:
    return f"INV-{year}-{seq:06d}"


class InvoiceService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _next_number(self) -> str:
        seq = (
            await self.db.execute(select(func.nextval("invoice_number_seq")))
        ).scalar_one()
        return _make_number(datetime.now(timezone.utc).year, seq)

    async def issue(
        self, payload: InvoiceIssueIn, *, viewer_id: UUID  # noqa: ARG002
    ) -> InvoiceOut:
        # Lock the candidate charges in one query, validate ownership +
        # availability before any writes.
        rows = (
            await self.db.execute(
                select(Charge).where(Charge.id.in_(payload.charge_ids))
            )
        ).scalars().all()
        if len(rows) != len(payload.charge_ids):
            raise HTTPException(400, "One or more charges not found")
        for c in rows:
            if c.patient_id != payload.patient_id:
                raise HTTPException(400, "Charge belongs to a different patient")
            if c.invoice_id is not None:
                raise HTTPException(409, f"Charge {c.id} already on an invoice")
            if c.voided_at is not None:
                raise HTTPException(400, f"Charge {c.id} is voided")

        subtotal = sum(c.total_cents for c in rows)
        total = max(0, subtotal - payload.discount_cents)
        now = datetime.now(timezone.utc)

        inv = Invoice(
            number=await self._next_number(),
            patient_id=payload.patient_id,
            status="open",
            subtotal_cents=subtotal,
            discount_cents=payload.discount_cents,
            tax_cents=0,
            total_cents=total,
            paid_cents=0,
            balance_cents=total,
            issued_at=now,
            due_at=now + timedelta(days=14),
            notes=payload.notes,
        )
        self.db.add(inv)
        await self.db.flush()
        for c in rows:
            c.invoice_id = inv.id
        await self.db.commit()
        await self.db.refresh(inv)
        return InvoiceOut.model_validate(inv)

    async def get(self, invoice_id: UUID) -> InvoiceOut:
        row = await self.db.get(Invoice, invoice_id)
        if row is None:
            raise HTTPException(404, "Invoice not found")
        return InvoiceOut.model_validate(row)

    async def list_for_patient(self, patient_id: UUID) -> list[InvoiceOut]:
        rows = (
            await self.db.execute(
                select(Invoice)
                .where(Invoice.patient_id == patient_id)
                .order_by(Invoice.created_at.desc())
            )
        ).scalars().all()
        return [InvoiceOut.model_validate(r) for r in rows]

    async def recalc(self, invoice_id: UUID) -> InvoiceOut:
        """Recompute paid_cents + balance_cents + status from succeeded
        payments. Call inside the same transaction as the payment write."""
        inv = await self.db.get(Invoice, invoice_id)
        if inv is None:
            raise HTTPException(404, "Invoice not found")
        paid = (
            await self.db.execute(
                select(func.coalesce(func.sum(Payment.amount_cents), 0)).where(
                    Payment.invoice_id == invoice_id,
                    Payment.status == PaymentStatus.succeeded.value,
                )
            )
        ).scalar_one()
        inv.paid_cents = int(paid)
        inv.balance_cents = max(0, inv.total_cents - inv.paid_cents)
        if inv.balance_cents == 0 and inv.total_cents > 0:
            inv.status = "paid"
        elif inv.paid_cents > 0:
            inv.status = "partially_paid"
        else:
            inv.status = "open"
        await self.db.commit()
        await self.db.refresh(inv)
        return InvoiceOut.model_validate(inv)
```

- [ ] **Step 5: Write the endpoints**

Create `backend/app/api/v1/endpoints/invoices.py`:

```python
from uuid import UUID

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.invoice import InvoiceIssueIn, InvoiceOut
from app.services.invoice_service import InvoiceService


router = APIRouter(prefix="/billing/invoices", tags=["billing-invoices"])


@router.post("", response_model=InvoiceOut, status_code=201)
async def issue_invoice(
    payload: InvoiceIssueIn, db: DbSession, current: CurrentUser
) -> InvoiceOut:
    return await InvoiceService(db).issue(payload, viewer_id=current.id)


@router.get("/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(
    invoice_id: UUID, db: DbSession, current: CurrentUser  # noqa: ARG001
) -> InvoiceOut:
    return await InvoiceService(db).get(invoice_id)


@router.get("/by-patient/{patient_id}", response_model=list[InvoiceOut])
async def list_patient_invoices(
    patient_id: UUID, db: DbSession, current: CurrentUser  # noqa: ARG001
) -> list[InvoiceOut]:
    return await InvoiceService(db).list_for_patient(patient_id)
```

- [ ] **Step 6: Wire router + run tests**

```python
# router.py:
from app.api.v1.endpoints import invoices
api_router.include_router(invoices.router)
```

```bash
pytest tests/test_invoice_service.py -v
```

Expected: 3 passed.

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/invoice.py \
        backend/app/services/invoice_service.py \
        backend/app/api/v1/endpoints/invoices.py \
        backend/tests/test_invoice_service.py \
        backend/app/api/v1/router.py
git commit -m "feat(payments): invoice issue + recalc with FOR UPDATE + tests"
```

---

## Task 7: Stripe client wrapper

**Files:**
- Create: `backend/app/integrations/__init__.py` (if not exists)
- Create: `backend/app/integrations/stripe_client.py`

- [ ] **Step 1: Wrapper module**

Create `backend/app/integrations/stripe_client.py`:

```python
"""Thin Stripe wrapper. Centralises the API key + idempotency +
typed helpers so service code doesn't sprinkle `stripe.x` calls
across the codebase.

The wrapper is `async-safe`: Stripe's Python SDK is sync, so each
helper runs in a thread (`asyncio.to_thread`) to keep the event
loop responsive.
"""
from __future__ import annotations

import asyncio
from typing import Any

import stripe

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger(__name__)


def _configured() -> bool:
    return bool(settings.STRIPE_SECRET_KEY)


def _client() -> Any:
    if not _configured():
        raise RuntimeError("STRIPE_SECRET_KEY is not configured")
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


async def ensure_customer(
    *,
    patient_id: str,
    name: str,
    email: str | None,
    existing_customer_id: str | None,
) -> str:
    """Return a Stripe Customer id for this patient, creating one if
    we don't already have it. Idempotency key keys on patient_id so
    a retry never spawns a duplicate."""
    if existing_customer_id:
        return existing_customer_id

    def _create() -> str:
        c = stripe.Customer.create(
            name=name,
            email=email,
            metadata={"patient_id": patient_id},
            idempotency_key=f"customer:{patient_id}",
        )
        return c.id

    return await asyncio.to_thread(_create)


async def create_payment_intent(
    *,
    invoice_id: str,
    customer_id: str,
    amount_cents: int,
    description: str,
) -> dict:
    """Create a PaymentIntent. The browser collects card details via
    Stripe Elements and confirms with the `client_secret` returned
    here. The webhook is the source of truth for the final payment
    row — this just opens the intent."""

    def _create() -> dict:
        pi = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency="usd",
            customer=customer_id,
            description=description,
            automatic_payment_methods={"enabled": True},
            metadata={"invoice_id": invoice_id},
            idempotency_key=f"pi:{invoice_id}",
        )
        return {"id": pi.id, "client_secret": pi.client_secret, "status": pi.status}

    _client()
    return await asyncio.to_thread(_create)


def verify_webhook(payload: bytes, signature: str) -> Any:
    """Returns the Stripe Event object after verifying the signature."""
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise RuntimeError("STRIPE_WEBHOOK_SECRET is not configured")
    return stripe.Webhook.construct_event(
        payload, signature, settings.STRIPE_WEBHOOK_SECRET
    )
```

- [ ] **Step 2: Boot check**

```bash
python -c "from app.integrations.stripe_client import ensure_customer; print('OK')"
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/integrations/__init__.py backend/app/integrations/stripe_client.py
git commit -m "feat(payments): thin Stripe SDK wrapper (customer + PaymentIntent + webhook verify)"
```

---

## Task 8: Payment service + cash + stripe-init endpoints (TDD)

**Files:**
- Create: `backend/app/schemas/payment.py`
- Create: `backend/app/services/payment_service.py`
- Create: `backend/app/api/v1/endpoints/payments.py`
- Create: `backend/tests/test_payment_service.py`
- Modify: `backend/app/api/v1/router.py`

- [ ] **Step 1: Tests first (cash path only — Stripe path covered by webhook test)**

Create `backend/tests/test_payment_service.py`:

```python
import pytest

from app.schemas.charge import ChargeCreate
from app.schemas.invoice import InvoiceIssueIn
from app.schemas.payment import CashPaymentIn
from app.schemas.service_catalog import ServiceCatalogCreate
from app.services.charge_service import ChargeService
from app.services.invoice_service import InvoiceService
from app.services.payment_service import PaymentService
from app.services.service_catalog_service import ServiceCatalogService


@pytest.mark.asyncio
async def test_cash_payment_marks_invoice_paid(
    db_session, sample_patient_id, sample_user_id
):
    svc_cat = ServiceCatalogService(db_session)
    sv = await svc_cat.create(
        ServiceCatalogCreate(code="V", name="V", category="visit", price_cents=12000)
    )
    c = await ChargeService(db_session).create(
        ChargeCreate(patient_id=sample_patient_id, service_catalog_id=sv.id),
        viewer_id=sample_user_id,
    )
    inv = await InvoiceService(db_session).issue(
        InvoiceIssueIn(patient_id=sample_patient_id, charge_ids=[c.id]),
        viewer_id=sample_user_id,
    )
    out = await PaymentService(db_session).record_cash(
        CashPaymentIn(
            invoice_id=inv.id, amount_cents=12000, reference="Drawer A"
        ),
        viewer_id=sample_user_id,
    )
    assert out.status == "succeeded"
    refreshed = await InvoiceService(db_session).get(inv.id)
    assert refreshed.status == "paid"
    assert refreshed.balance_cents == 0


@pytest.mark.asyncio
async def test_overpayment_rejected(db_session, sample_patient_id, sample_user_id):
    svc_cat = ServiceCatalogService(db_session)
    sv = await svc_cat.create(
        ServiceCatalogCreate(code="V", name="V", category="visit", price_cents=5000)
    )
    c = await ChargeService(db_session).create(
        ChargeCreate(patient_id=sample_patient_id, service_catalog_id=sv.id),
        viewer_id=sample_user_id,
    )
    inv = await InvoiceService(db_session).issue(
        InvoiceIssueIn(patient_id=sample_patient_id, charge_ids=[c.id]),
        viewer_id=sample_user_id,
    )
    with pytest.raises(Exception):
        await PaymentService(db_session).record_cash(
            CashPaymentIn(invoice_id=inv.id, amount_cents=6000),
            viewer_id=sample_user_id,
        )
```

- [ ] **Step 2: Run — fail**

```bash
pytest tests/test_payment_service.py -v
```

- [ ] **Step 3: Schemas**

Create `backend/app/schemas/payment.py`:

```python
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CashPaymentIn(BaseModel):
    invoice_id: UUID
    amount_cents: int = Field(gt=0)
    reference: str | None = Field(default=None, max_length=64)


class StripeInitIn(BaseModel):
    invoice_id: UUID


class StripeInitOut(BaseModel):
    payment_intent_id: str
    client_secret: str
    publishable_key: str
    amount_cents: int


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    invoice_id: UUID
    patient_id: UUID
    method: str
    amount_cents: int
    status: str
    last4: str | None
    card_brand: str | None
    reference: str | None
    created_at: datetime
```

- [ ] **Step 4: Service**

Create `backend/app/services/payment_service.py`:

```python
from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.integrations import stripe_client
from app.models.invoice import Invoice
from app.models.patient import Patient
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.schemas.payment import (
    CashPaymentIn,
    PaymentOut,
    StripeInitIn,
    StripeInitOut,
)
from app.services.invoice_service import InvoiceService


class PaymentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _load_invoice(self, invoice_id: UUID) -> Invoice:
        inv = await self.db.get(Invoice, invoice_id)
        if inv is None:
            raise HTTPException(404, "Invoice not found")
        if inv.status in {"void", "refunded"}:
            raise HTTPException(409, f"Invoice is {inv.status}")
        return inv

    async def record_cash(
        self, payload: CashPaymentIn, *, viewer_id: UUID
    ) -> PaymentOut:
        inv = await self._load_invoice(payload.invoice_id)
        if payload.amount_cents > inv.balance_cents:
            raise HTTPException(
                400,
                f"Amount {payload.amount_cents} exceeds balance {inv.balance_cents}",
            )

        row = Payment(
            invoice_id=inv.id,
            patient_id=inv.patient_id,
            method=PaymentMethod.cash.value,
            amount_cents=payload.amount_cents,
            status=PaymentStatus.succeeded.value,
            reference=payload.reference,
            received_by_user_id=viewer_id,
        )
        self.db.add(row)
        await self.db.flush()
        await InvoiceService(self.db).recalc(inv.id)
        await self.db.refresh(row)
        return PaymentOut.model_validate(row)

    async def init_stripe(self, payload: StripeInitIn) -> StripeInitOut:
        inv = await self._load_invoice(payload.invoice_id)
        if inv.balance_cents <= 0:
            raise HTTPException(400, "Invoice has no balance")

        patient = await self.db.get(Patient, inv.patient_id)
        if patient is None:
            raise HTTPException(404, "Patient not found")

        customer_id = await stripe_client.ensure_customer(
            patient_id=str(patient.id),
            name=f"{patient.first_name} {patient.last_name}".strip(),
            email=patient.email,
            existing_customer_id=patient.stripe_customer_id,
        )
        if patient.stripe_customer_id is None:
            patient.stripe_customer_id = customer_id
            await self.db.commit()

        intent = await stripe_client.create_payment_intent(
            invoice_id=str(inv.id),
            customer_id=customer_id,
            amount_cents=inv.balance_cents,
            description=f"Invoice {inv.number}",
        )
        # Create a pending payment row so the webhook can resolve it
        # by stripe_payment_intent_id (unique).
        existing = (
            await self.db.execute(
                select(Payment).where(
                    Payment.stripe_payment_intent_id == intent["id"]
                )
            )
        ).scalar_one_or_none()
        if existing is None:
            self.db.add(
                Payment(
                    invoice_id=inv.id,
                    patient_id=inv.patient_id,
                    method=PaymentMethod.stripe.value,
                    amount_cents=inv.balance_cents,
                    status=PaymentStatus.pending.value,
                    stripe_payment_intent_id=intent["id"],
                )
            )
            await self.db.commit()

        return StripeInitOut(
            payment_intent_id=intent["id"],
            client_secret=intent["client_secret"],
            publishable_key=settings.STRIPE_PUBLISHABLE_KEY,
            amount_cents=inv.balance_cents,
        )

    async def list_for_invoice(self, invoice_id: UUID) -> list[PaymentOut]:
        rows = (
            await self.db.execute(
                select(Payment)
                .where(Payment.invoice_id == invoice_id)
                .order_by(Payment.created_at.desc())
            )
        ).scalars().all()
        return [PaymentOut.model_validate(r) for r in rows]
```

- [ ] **Step 5: Endpoints**

Create `backend/app/api/v1/endpoints/payments.py`:

```python
from uuid import UUID

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.payment import (
    CashPaymentIn,
    PaymentOut,
    StripeInitIn,
    StripeInitOut,
)
from app.services.payment_service import PaymentService


router = APIRouter(prefix="/billing/payments", tags=["billing-payments"])


@router.post("/cash", response_model=PaymentOut, status_code=201)
async def record_cash(
    payload: CashPaymentIn, db: DbSession, current: CurrentUser
) -> PaymentOut:
    return await PaymentService(db).record_cash(payload, viewer_id=current.id)


@router.post("/stripe/init", response_model=StripeInitOut)
async def init_stripe_payment(
    payload: StripeInitIn, db: DbSession, current: CurrentUser  # noqa: ARG001
) -> StripeInitOut:
    return await PaymentService(db).init_stripe(payload)


@router.get("/by-invoice/{invoice_id}", response_model=list[PaymentOut])
async def list_invoice_payments(
    invoice_id: UUID, db: DbSession, current: CurrentUser  # noqa: ARG001
) -> list[PaymentOut]:
    return await PaymentService(db).list_for_invoice(invoice_id)
```

- [ ] **Step 6: Wire router + run tests**

```python
# router.py:
from app.api.v1.endpoints import payments
api_router.include_router(payments.router)
```

```bash
pytest tests/test_payment_service.py -v
```

Expected: 2 passed.

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/payment.py \
        backend/app/services/payment_service.py \
        backend/app/api/v1/endpoints/payments.py \
        backend/tests/test_payment_service.py \
        backend/app/api/v1/router.py
git commit -m "feat(payments): cash + Stripe-init endpoints, invoice recalc + tests"
```

---

## Task 9: Stripe webhook + idempotent handler (TDD)

**Files:**
- Create: `backend/app/api/v1/endpoints/stripe_webhook.py`
- Create: `backend/tests/test_stripe_webhook.py`
- Modify: `backend/app/api/v1/router.py`

- [ ] **Step 1: Tests first**

Create `backend/tests/test_stripe_webhook.py`:

```python
import pytest

from app.api.v1.endpoints.stripe_webhook import _handle_event
from app.models.payment import Payment


@pytest.mark.asyncio
async def test_payment_intent_succeeded_flips_payment_and_invoice(
    db_session, sample_patient_id, sample_user_id
):
    # Seed an invoice + pending Stripe payment row by hand.
    from app.schemas.service_catalog import ServiceCatalogCreate
    from app.services.service_catalog_service import ServiceCatalogService
    from app.schemas.charge import ChargeCreate
    from app.services.charge_service import ChargeService
    from app.schemas.invoice import InvoiceIssueIn
    from app.services.invoice_service import InvoiceService

    sv = await ServiceCatalogService(db_session).create(
        ServiceCatalogCreate(code="V", name="V", category="visit", price_cents=5000)
    )
    c = await ChargeService(db_session).create(
        ChargeCreate(patient_id=sample_patient_id, service_catalog_id=sv.id),
        viewer_id=sample_user_id,
    )
    inv = await InvoiceService(db_session).issue(
        InvoiceIssueIn(patient_id=sample_patient_id, charge_ids=[c.id]),
        viewer_id=sample_user_id,
    )

    pending = Payment(
        invoice_id=inv.id,
        patient_id=sample_patient_id,
        method="stripe",
        amount_cents=5000,
        status="pending",
        stripe_payment_intent_id="pi_test_123",
    )
    db_session.add(pending)
    await db_session.commit()

    # Build a Stripe-shaped event (we bypass signature verification
    # by calling _handle_event directly).
    event = {
        "id": "evt_test_1",
        "type": "payment_intent.succeeded",
        "data": {
            "object": {
                "id": "pi_test_123",
                "amount": 5000,
                "latest_charge": "ch_test_1",
                "charges": {
                    "data": [{
                        "payment_method_details": {
                            "card": {"brand": "visa", "last4": "4242"}
                        }
                    }]
                },
            }
        },
    }

    await _handle_event(db_session, event)
    await db_session.refresh(pending)
    assert pending.status == "succeeded"
    assert pending.last4 == "4242"
    assert pending.card_brand == "visa"

    refreshed = await InvoiceService(db_session).get(inv.id)
    assert refreshed.status == "paid"


@pytest.mark.asyncio
async def test_replay_is_idempotent(
    db_session, sample_patient_id, sample_user_id
):
    """Calling _handle_event twice with the same event id leaves the
    DB in the same state."""
    # (same seed as above, abbreviated…)
    from app.schemas.service_catalog import ServiceCatalogCreate
    from app.services.service_catalog_service import ServiceCatalogService
    from app.schemas.charge import ChargeCreate
    from app.services.charge_service import ChargeService
    from app.schemas.invoice import InvoiceIssueIn
    from app.services.invoice_service import InvoiceService

    sv = await ServiceCatalogService(db_session).create(
        ServiceCatalogCreate(code="W", name="W", category="visit", price_cents=4000)
    )
    c = await ChargeService(db_session).create(
        ChargeCreate(patient_id=sample_patient_id, service_catalog_id=sv.id),
        viewer_id=sample_user_id,
    )
    inv = await InvoiceService(db_session).issue(
        InvoiceIssueIn(patient_id=sample_patient_id, charge_ids=[c.id]),
        viewer_id=sample_user_id,
    )
    db_session.add(
        Payment(
            invoice_id=inv.id,
            patient_id=sample_patient_id,
            method="stripe",
            amount_cents=4000,
            status="pending",
            stripe_payment_intent_id="pi_test_456",
        )
    )
    await db_session.commit()
    event = {
        "id": "evt_test_2",
        "type": "payment_intent.succeeded",
        "data": {"object": {"id": "pi_test_456", "amount": 4000,
                            "latest_charge": "ch", "charges": {"data": []}}},
    }
    await _handle_event(db_session, event)
    await _handle_event(db_session, event)  # replay
    from sqlalchemy import select, func
    from app.models.payment import Payment as P
    count = (await db_session.execute(
        select(func.count(P.id)).where(P.stripe_payment_intent_id == "pi_test_456")
    )).scalar_one()
    assert count == 1  # no duplicate row
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Write the webhook endpoint**

Create `backend/app/api/v1/endpoints/stripe_webhook.py`:

```python
"""Stripe webhook. The browser callback only optimistically updates
the UI; this endpoint is the authoritative confirmation that a
PaymentIntent succeeded / failed."""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DbSession
from app.core.logging import get_logger
from app.integrations import stripe_client
from app.models.payment import Payment, PaymentStatus
from app.services.invoice_service import InvoiceService

log = get_logger(__name__)

router = APIRouter(prefix="/billing/stripe", tags=["billing-stripe"])


@router.post("/webhook", status_code=204)
async def stripe_webhook(
    request: Request,
    db: DbSession,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
) -> None:
    if stripe_signature is None:
        raise HTTPException(400, "Missing Stripe signature")
    raw = await request.body()
    try:
        event = stripe_client.verify_webhook(raw, stripe_signature)
    except Exception as exc:  # noqa: BLE001
        log.warning("stripe_webhook_verify_failed", error=str(exc))
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid signature")

    await _handle_event(db, event)


async def _handle_event(db: AsyncSession, event) -> None:
    """Dispatch a verified Stripe event to its handler. Idempotent on
    event id (we never write the same effect twice).

    For Phase 1 we wire two events:
      payment_intent.succeeded → flip Payment + invoice.recalc
      payment_intent.payment_failed → flip Payment to failed
    """
    event_type = event["type"] if isinstance(event, dict) else event.type
    event_id = event["id"] if isinstance(event, dict) else event.id
    data = event["data"]["object"] if isinstance(event, dict) else event.data.object

    if event_type == "payment_intent.succeeded":
        pi_id = data["id"] if isinstance(data, dict) else data.id
        row = (
            await db.execute(
                select(Payment).where(Payment.stripe_payment_intent_id == pi_id)
            )
        ).scalar_one_or_none()
        if row is None:
            log.warning("stripe_webhook_unknown_pi", pi_id=pi_id, event_id=event_id)
            return
        if row.status == PaymentStatus.succeeded.value:
            return  # idempotent
        row.status = PaymentStatus.succeeded.value
        # Pull last4 / brand if present.
        charges = (data.get("charges") if isinstance(data, dict) else {}).get("data", []) or []
        if charges:
            card = (
                charges[0].get("payment_method_details", {}).get("card", {}) or {}
            )
            row.last4 = card.get("last4")
            row.card_brand = card.get("brand")
        latest_charge = (
            data.get("latest_charge") if isinstance(data, dict) else None
        )
        if latest_charge:
            row.stripe_charge_id = latest_charge
        await db.flush()
        await InvoiceService(db).recalc(row.invoice_id)
        return

    if event_type == "payment_intent.payment_failed":
        pi_id = data["id"] if isinstance(data, dict) else data.id
        row = (
            await db.execute(
                select(Payment).where(Payment.stripe_payment_intent_id == pi_id)
            )
        ).scalar_one_or_none()
        if row is None:
            return
        if row.status not in (PaymentStatus.succeeded.value,):
            row.status = PaymentStatus.failed.value
            await db.commit()
        return

    # Unhandled type — log but 2xx so Stripe doesn't retry forever.
    log.info("stripe_webhook_unhandled", event_type=event_type, event_id=event_id)
```

- [ ] **Step 4: Wire router + run tests**

```python
# router.py:
from app.api.v1.endpoints import stripe_webhook
api_router.include_router(stripe_webhook.router)
```

```bash
pytest tests/test_stripe_webhook.py -v
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/endpoints/stripe_webhook.py \
        backend/tests/test_stripe_webhook.py \
        backend/app/api/v1/router.py
git commit -m "feat(payments): Stripe webhook handler — payment_intent.succeeded / failed"
```

---

## Task 10: PDF receipt generation

**Files:**
- Create: `backend/app/services/receipt_pdf_service.py`
- Modify: `backend/app/api/v1/endpoints/invoices.py`

- [ ] **Step 1: Receipt PDF service**

Create `backend/app/services/receipt_pdf_service.py`:

```python
"""PDF receipt generator. ReportLab Platypus → bytes. Kept dumb on
purpose: takes a fully-projected `Invoice` + child charges +
succeeded payments and renders. No DB access here."""
from __future__ import annotations

from io import BytesIO

from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from app.core.config import settings
from app.models.charge import Charge
from app.models.invoice import Invoice
from app.models.payment import Payment


def _cents(c: int) -> str:
    return f"${c // 100}.{c % 100:02d}"


def render_receipt(
    invoice: Invoice,
    charges: list[Charge],
    payments: list[Payment],
    patient_name: str,
) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=LETTER,
        leftMargin=0.6 * inch, rightMargin=0.6 * inch,
        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
    )
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Title"], fontSize=20, spaceAfter=4)
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=9, textColor=colors.grey)
    body = styles["Normal"]

    elems = []
    elems.append(Paragraph(settings.PRACTICE_NAME or "Modern-EHR Clinic", h1))
    if settings.PRACTICE_ADDRESS:
        elems.append(Paragraph(settings.PRACTICE_ADDRESS, small))
    if settings.PRACTICE_PHONE:
        elems.append(Paragraph(settings.PRACTICE_PHONE, small))
    elems.append(Spacer(1, 12))

    elems.append(Paragraph(f"<b>Invoice {invoice.number}</b>", body))
    elems.append(Paragraph(
        f"Issued: {invoice.issued_at.strftime('%b %d, %Y') if invoice.issued_at else '-'}",
        small,
    ))
    elems.append(Paragraph(f"Patient: {patient_name}", body))
    elems.append(Spacer(1, 14))

    rows = [["Description", "Code", "Qty", "Unit", "Discount", "Tax", "Total"]]
    for c in charges:
        rows.append([
            c.description, c.code, str(c.quantity),
            _cents(c.unit_price_cents),
            _cents(c.discount_cents),
            _cents(c.tax_cents),
            _cents(c.total_cents),
        ])
    tbl = Table(rows, colWidths=[2.2*inch, 0.8*inch, 0.5*inch, 0.7*inch, 0.8*inch, 0.6*inch, 0.8*inch])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#0F172A")),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("ALIGN", (2,1), (-1,-1), "RIGHT"),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#E5E7EB")),
    ]))
    elems.append(tbl)
    elems.append(Spacer(1, 14))

    totals = Table(
        [
            ["Subtotal", _cents(invoice.subtotal_cents)],
            ["Discount", _cents(invoice.discount_cents)],
            ["Tax", _cents(invoice.tax_cents)],
            ["Total", _cents(invoice.total_cents)],
            ["Paid", _cents(invoice.paid_cents)],
            ["Balance", _cents(invoice.balance_cents)],
        ],
        colWidths=[1.4 * inch, 1.0 * inch],
        hAlign="RIGHT",
    )
    totals.setStyle(TableStyle([
        ("FONTSIZE", (0,0), (-1,-1), 10),
        ("ALIGN", (1,0), (1,-1), "RIGHT"),
        ("FONTNAME", (0,3), (-1,3), "Helvetica-Bold"),
        ("LINEABOVE", (0,3), (-1,3), 0.5, colors.black),
        ("LINEABOVE", (0,5), (-1,5), 0.5, colors.black),
    ]))
    elems.append(totals)

    if payments:
        elems.append(Spacer(1, 14))
        elems.append(Paragraph("<b>Payments</b>", body))
        pay_rows = [["Date", "Method", "Amount", "Ref"]]
        for p in payments:
            ref = p.reference or (
                f"•••• {p.last4}" if p.last4 else (p.stripe_charge_id or "")
            )
            pay_rows.append([
                p.created_at.strftime("%b %d, %Y"),
                p.method, _cents(p.amount_cents), ref,
            ])
        pt = Table(pay_rows, colWidths=[1.0*inch, 1.0*inch, 1.0*inch, 2.0*inch])
        pt.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#F1F5F9")),
            ("FONTSIZE", (0,0), (-1,-1), 9),
        ]))
        elems.append(pt)

    elems.append(Spacer(1, 18))
    elems.append(Paragraph(
        "Thank you for your visit. Questions about this receipt? Contact our front desk.",
        small,
    ))

    doc.build(elems)
    return buf.getvalue()
```

- [ ] **Step 2: Receipt download endpoint**

Append to `backend/app/api/v1/endpoints/invoices.py`:

```python
from fastapi.responses import Response
from sqlalchemy import select
from app.models.charge import Charge
from app.models.payment import Payment
from app.models.patient import Patient
from app.services.receipt_pdf_service import render_receipt


@router.get("/{invoice_id}/receipt.pdf")
async def receipt_pdf(
    invoice_id: UUID, db: DbSession, current: CurrentUser  # noqa: ARG001
) -> Response:
    from app.models.invoice import Invoice as InvoiceModel
    inv = await db.get(InvoiceModel, invoice_id)
    if inv is None:
        from fastapi import HTTPException
        raise HTTPException(404, "Invoice not found")
    charges = (
        await db.execute(select(Charge).where(Charge.invoice_id == invoice_id))
    ).scalars().all()
    payments = (
        await db.execute(
            select(Payment).where(
                Payment.invoice_id == invoice_id,
                Payment.status == "succeeded",
            )
        )
    ).scalars().all()
    patient = await db.get(Patient, inv.patient_id)
    pdf = render_receipt(
        inv,
        charges,
        payments,
        patient_name=f"{patient.first_name} {patient.last_name}".strip() if patient else "Patient",
    )
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="receipt-{inv.number}.pdf"',
        },
    )
```

- [ ] **Step 3: Smoke**

Boot the app and curl the endpoint for a manually-created invoice; confirm PDF
opens.

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/receipt_pdf_service.py \
        backend/app/api/v1/endpoints/invoices.py
git commit -m "feat(payments): PDF receipt download endpoint"
```

---

## Task 11: Provider portal — Services & Pricing page

**Files:**
- Create: `frontend/src/features/billing/api/services-api.ts`
- Create: `frontend/src/features/billing/hooks/use-services.ts`
- Create: `frontend/src/features/billing/ServicesCatalogPage.tsx`
- Create: `frontend/src/features/billing/components/ServiceFormModal.tsx`
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/features/settings/SettingsPage.tsx`

- [ ] **Step 1: API client**

Create `frontend/src/features/billing/api/services-api.ts`:

```ts
import { api } from "@/lib/api-client";

export interface ServiceItem {
  id: string;
  code: string;
  name: string;
  category: string;
  priceCents: number;
  taxRateBp: number;
  taxable: boolean;
  isActive: boolean;
}

interface BackendDto {
  id: string;
  code: string;
  name: string;
  category: string;
  price_cents: number;
  tax_rate_bp: number;
  taxable: boolean;
  is_active: boolean;
}

interface BackendPage<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

const map = (d: BackendDto): ServiceItem => ({
  id: d.id,
  code: d.code,
  name: d.name,
  category: d.category,
  priceCents: d.price_cents,
  taxRateBp: d.tax_rate_bp,
  taxable: d.taxable,
  isActive: d.is_active,
});

export interface ServiceInput {
  code: string;
  name: string;
  category: string;
  price_cents: number;
  tax_rate_bp?: number;
  taxable?: boolean;
}

export const servicesApi = {
  list: async (opts: { q?: string; active_only?: boolean } = {}) => {
    const data = await api.get<BackendPage<BackendDto>>("/billing/services", {
      searchParams: { q: opts.q, active_only: opts.active_only ?? true },
    });
    return { items: data.items.map(map), total: data.total };
  },
  create: async (input: ServiceInput): Promise<ServiceItem> =>
    map(await api.post<BackendDto>("/billing/services", input)),
  update: async (id: string, input: Partial<ServiceInput>): Promise<ServiceItem> =>
    map(await api.patch<BackendDto>(`/billing/services/${id}`, input)),
  deactivate: (id: string): Promise<void> =>
    api.delete<void>(`/billing/services/${id}`),
};
```

- [ ] **Step 2: Hook**

Create `frontend/src/features/billing/hooks/use-services.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { servicesApi, type ServiceInput } from "../api/services-api";
import { toast } from "@/lib/toast";

export function useServices(activeOnly = true) {
  return useQuery({
    queryKey: ["billing", "services", { activeOnly }],
    queryFn: () => servicesApi.list({ active_only: activeOnly }),
  });
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ServiceInput) => servicesApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing", "services"] });
      toast.success("Service added");
    },
    onError: (e) =>
      toast.error("Couldn't add service", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });
}

export function useUpdateService(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ServiceInput>) => servicesApi.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing", "services"] });
      toast.success("Service updated");
    },
  });
}

export function useDeactivateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => servicesApi.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing", "services"] });
      toast.success("Service deactivated");
    },
  });
}
```

- [ ] **Step 3: Modal**

Create `frontend/src/features/billing/components/ServiceFormModal.tsx`:

```tsx
import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form";
import { useCreateService, useUpdateService } from "../hooks/use-services";
import type { ServiceItem } from "../api/services-api";

const CATEGORIES = ["visit", "procedure", "lab", "supply", "membership", "other"];

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: ServiceItem | null;
}

export function ServiceFormModal({ open, onClose, editing }: Props) {
  const create = useCreateService();
  const update = useUpdateService(editing?.id ?? "");

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("visit");
  const [priceDollars, setPriceDollars] = useState("0.00");

  useEffect(() => {
    if (!open) return;
    setCode(editing?.code ?? "");
    setName(editing?.name ?? "");
    setCategory(editing?.category ?? "visit");
    setPriceDollars(((editing?.priceCents ?? 0) / 100).toFixed(2));
  }, [open, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = Math.round(parseFloat(priceDollars || "0") * 100);
    if (Number.isNaN(cents) || cents < 0) return;
    const input = { code, name, category, price_cents: cents };
    if (editing) {
      await update.mutateAsync({ name, category, price_cents: cents });
    } else {
      await create.mutateAsync(input);
    }
    onClose();
  };

  const busy = create.isPending || update.isPending;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white shadow-elev border border-border">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <Dialog.Title className="text-lg font-semibold">
              {editing ? "Edit service" : "Add service"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Close" className="size-8 rounded-full grid place-items-center hover:bg-secondary">
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>
          <form onSubmit={submit} className="p-5 space-y-4">
            <FormField label="Code" htmlFor="code" required>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VISIT-30"
                disabled={Boolean(editing)}
                required
              />
            </FormField>
            <FormField label="Name" htmlFor="name" required>
              <Input
                id="name" value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="30-minute follow-up visit" required
              />
            </FormField>
            <FormField label="Category" htmlFor="category">
              <select
                id="category" value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 w-full rounded-full border border-border bg-white px-4 text-sm shadow-soft"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c[0].toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Price (USD)" htmlFor="price" required>
              <Input
                id="price" type="number" step="0.01" min="0"
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)} required
              />
            </FormField>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {editing ? "Save" : "Add"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 4: Catalog page**

Create `frontend/src/features/billing/ServicesCatalogPage.tsx`:

```tsx
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/ui/empty";
import { useServices, useDeactivateService } from "./hooks/use-services";
import { ServiceFormModal } from "./components/ServiceFormModal";
import type { ServiceItem } from "./api/services-api";

const dollar = (c: number) => `$${(c / 100).toFixed(2)}`;

export function ServicesCatalogPage() {
  const { data, isLoading } = useServices(true);
  const deactivate = useDeactivateService();
  const [editing, setEditing] = useState<ServiceItem | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Services & Pricing"
        subtitle="The price list your providers and front desk pick from."
        right={
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="size-4" /> Add service
          </Button>
        }
      />
      {!isLoading && data && data.items.length === 0 && (
        <Empty
          title="No services yet"
          description="Add your first billable service to get started."
        />
      )}
      {data && data.items.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-surface-subtle">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Code</th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Category</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 text-right font-medium">{""}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.map((s) => (
                <tr key={s.id} className="hover:bg-surface-subtle/60">
                  <td className="px-4 py-2 font-mono text-xs">{s.code}</td>
                  <td className="px-4 py-2 font-medium">{s.name}</td>
                  <td className="px-4 py-2">
                    <Badge size="sm">{s.category}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {dollar(s.priceCents)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => { setEditing(s); setOpen(true); }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => deactivate.mutate(s.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <ServiceFormModal
        open={open}
        onClose={() => setOpen(false)}
        editing={editing}
      />
    </>
  );
}
```

- [ ] **Step 5: Route + Settings link**

In `frontend/src/app/router.tsx`, add a lazy route under the admin
ProtectedRoute branch:

```tsx
const ServicesCatalogPage = lazy(() =>
  import("@/features/billing").then((m) => ({ default: m.ServicesCatalogPage }))
);
// inside the AdminRoute group:
<Route path="/settings/services" element={<ServicesCatalogPage />} />
```

Add `frontend/src/features/billing/index.ts`:

```ts
export { ServicesCatalogPage } from "./ServicesCatalogPage";
```

In `SettingsPage.tsx`, add a "Services & Pricing" entry that
navigates to `/settings/services` (admin-only).

- [ ] **Step 6: Typecheck + commit**

```bash
cd frontend && npm run typecheck
```

```bash
git add frontend/src/features/billing/ \
        frontend/src/app/router.tsx \
        frontend/src/features/settings/SettingsPage.tsx
git commit -m "feat(payments): provider portal — Services & Pricing page"
```

---

## Task 12: Provider portal — patient Billing tab + cash payment

**Files:**
- Create: `frontend/src/features/billing/api/invoices-api.ts`
- Create: `frontend/src/features/billing/api/payments-api.ts`
- Create: `frontend/src/features/billing/api/charges-api.ts`
- Create: `frontend/src/features/billing/hooks/use-invoices.ts`
- Create: `frontend/src/features/billing/hooks/use-payments.ts`
- Create: `frontend/src/features/billing/hooks/use-charges.ts`
- Create: `frontend/src/features/billing/components/PatientBillingTab.tsx`
- Create: `frontend/src/features/billing/components/AddChargeModal.tsx`
- Create: `frontend/src/features/billing/components/TakeCashPaymentModal.tsx`
- Modify: `frontend/src/features/patients/PatientProfilePage.tsx` — add the tab

- [ ] **Step 1: API + hooks for invoices/charges/payments**

(Pattern is identical to Task 11 — three small modules, each
mirroring the backend shape with cents → dollars helpers. Use the
same `map` pattern. Each hook exposes `list`, `create` where
relevant, with toast on success/error.)

> *Concrete code follows the same shape as Task 11 — not re-pasted
> here for brevity, but every backend route has a matching FE call:
> POST `/billing/charges`, POST `/billing/charges/{id}/void`,
> POST `/billing/invoices`, POST `/billing/payments/cash`, GET
> `/billing/invoices/by-patient/{id}`, GET `/billing/payments/by-invoice/{id}`.*

- [ ] **Step 2: AddChargeModal**

Search the catalog (`useServices`), pick a service, set quantity +
optional discount, post via `useMutation` on
`/billing/charges`. Refresh the patient's open-charges list on
success.

- [ ] **Step 3: TakeCashPaymentModal**

Take an amount (default = invoice balance), reference (drawer / check
number), submit to `/billing/payments/cash`. On success, refetch
the invoice + payment list and show a toast with the receipt
download link.

- [ ] **Step 4: PatientBillingTab**

Renders 3 sections:
1. **Open charges** (charges with `invoice_id == null`) with an
   "Issue invoice" button that opens a confirm modal with the
   total, then POSTs to `/billing/invoices`.
2. **Invoices** (list) — each row shows number, status badge,
   total, balance, and a "Receipt" link (opens
   `/billing/invoices/{id}/receipt.pdf` in a new tab) + "Take
   cash" button when balance > 0.
3. **Payments** — flat history list per invoice when expanded.

- [ ] **Step 5: Hook into PatientProfilePage tabs**

Add a "Billing" tab between Documents and Tasks. Use the existing
tab pattern.

- [ ] **Step 6: Typecheck + smoke + commit**

```bash
cd frontend && npm run typecheck
```

End-to-end smoke (browser):
1. Add 2 services in Settings → Services & Pricing.
2. Open a patient → Billing tab.
3. Add 2 charges, click "Issue invoice", verify status = open.
4. "Take cash" for full balance → invoice flips to paid.
5. "Receipt" opens a PDF download.

```bash
git add frontend/src/features/billing/ \
        frontend/src/features/patients/PatientProfilePage.tsx
git commit -m "feat(payments): provider portal — patient Billing tab + cash payment + receipt"
```

---

## Task 13: Patient portal — Billing tab + Stripe Elements

**Files:**
- Modify: `patient-portal/package.json` — add `@stripe/stripe-js`, `@stripe/react-stripe-js`
- Create: `patient-portal/src/features/billing/api/billing-api.ts`
- Create: `patient-portal/src/features/billing/hooks/use-billing.ts`
- Create: `patient-portal/src/features/billing/BillingPage.tsx`
- Create: `patient-portal/src/features/billing/components/PayInvoiceModal.tsx`
- Modify: `patient-portal/src/config/constants.ts`
- Modify: `patient-portal/src/components/layout/Topbar.tsx`
- Modify: `patient-portal/src/app/router.tsx`

- [ ] **Step 1: Add a patient-portal backend endpoint that scopes invoices to the signed-in patient**

In `backend/app/api/v1/endpoints/patient_portal.py`, add (these
endpoints mirror the provider routes but use `CurrentPatient` so
patients see only their own invoices):

```python
@router.get("/me/invoices", response_model=list[InvoiceOut])
async def my_invoices(db: DbSession, current: CurrentPatient) -> list[InvoiceOut]:
    return await InvoiceService(db).list_for_patient(current.id)


@router.get("/me/invoices/{invoice_id}", response_model=InvoiceOut)
async def my_invoice(
    invoice_id: UUID, db: DbSession, current: CurrentPatient
) -> InvoiceOut:
    inv = await InvoiceService(db).get(invoice_id)
    if inv.patient_id != current.id:
        from fastapi import HTTPException
        raise HTTPException(404, "Invoice not found")
    return inv


@router.post("/me/invoices/{invoice_id}/stripe-init", response_model=StripeInitOut)
async def init_my_invoice_payment(
    invoice_id: UUID, db: DbSession, current: CurrentPatient
) -> StripeInitOut:
    inv = await InvoiceService(db).get(invoice_id)
    if inv.patient_id != current.id:
        from fastapi import HTTPException
        raise HTTPException(404, "Invoice not found")
    return await PaymentService(db).init_stripe(StripeInitIn(invoice_id=invoice_id))
```

(Add the matching imports at the top of the file.)

- [ ] **Step 2: Install Stripe in the patient portal**

```bash
cd patient-portal && npm install @stripe/stripe-js @stripe/react-stripe-js
```

- [ ] **Step 3: API + hook**

Create `patient-portal/src/features/billing/api/billing-api.ts`:

```ts
import { api } from "@/lib/api-client";

export interface Invoice {
  id: string;
  number: string;
  status: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  issuedAt: string | null;
  dueAt: string | null;
}

interface BackendDto {
  id: string;
  number: string;
  status: string;
  total_cents: number;
  paid_cents: number;
  balance_cents: number;
  issued_at: string | null;
  due_at: string | null;
}

const map = (d: BackendDto): Invoice => ({
  id: d.id,
  number: d.number,
  status: d.status,
  totalCents: d.total_cents,
  paidCents: d.paid_cents,
  balanceCents: d.balance_cents,
  issuedAt: d.issued_at,
  dueAt: d.due_at,
});

export interface StripeInit {
  paymentIntentId: string;
  clientSecret: string;
  publishableKey: string;
  amountCents: number;
}

export const billingApi = {
  list: async (): Promise<Invoice[]> =>
    (await api.get<BackendDto[]>("/patient-portal/me/invoices")).map(map),
  get: async (id: string): Promise<Invoice> =>
    map(await api.get<BackendDto>(`/patient-portal/me/invoices/${id}`)),
  initStripe: async (id: string): Promise<StripeInit> => {
    const d = await api.post<{
      payment_intent_id: string; client_secret: string;
      publishable_key: string; amount_cents: number;
    }>(`/patient-portal/me/invoices/${id}/stripe-init`);
    return {
      paymentIntentId: d.payment_intent_id,
      clientSecret: d.client_secret,
      publishableKey: d.publishable_key,
      amountCents: d.amount_cents,
    };
  },
};
```

Create `patient-portal/src/features/billing/hooks/use-billing.ts`
with `useInvoices()` (list) and `useInvoice(id)` queries, plus
`useInitStripe(id)` mutation.

- [ ] **Step 4: PayInvoiceModal with Stripe Elements**

Create `patient-portal/src/features/billing/components/PayInvoiceModal.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { billingApi, type Invoice, type StripeInit } from "../api/billing-api";
import { toast } from "@/lib/toast";

interface Props {
  invoice: Invoice | null;
  onClose: () => void;
}

const dollars = (c: number) => `$${(c / 100).toFixed(2)}`;

export function PayInvoiceModal({ invoice, onClose }: Props) {
  const [init, setInit] = useState<StripeInit | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoice) return;
    setInit(null);
    billingApi
      .initStripe(invoice.id)
      .then((d) => {
        setInit(d);
        setStripePromise(loadStripe(d.publishableKey));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't start payment"));
  }, [invoice]);

  return (
    <Dialog.Root open={Boolean(invoice)} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white shadow-elev border border-border">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <Dialog.Title className="text-lg font-semibold">
              Pay invoice {invoice?.number}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Close" className="size-8 rounded-full grid place-items-center hover:bg-secondary">
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>
          <div className="p-5 space-y-4">
            <div className="text-3xl font-bold tabular-nums">
              {invoice && dollars(invoice.balanceCents)}
            </div>
            {error && <div className="text-sm text-danger">{error}</div>}
            {!init && !error && (
              <div className="grid place-items-center py-8">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            )}
            {init && stripePromise && (
              <Elements
                stripe={stripePromise}
                options={{ clientSecret: init.clientSecret, appearance: { theme: "flat" } }}
              >
                <PaymentForm onSuccess={onClose} />
              </Elements>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PaymentForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    const { error } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    setSubmitting(false);
    if (error) {
      toast.error("Payment failed", { description: error.message ?? undefined });
      return;
    }
    toast.success("Payment received");
    onSuccess();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement />
      <Button type="submit" className="w-full" disabled={!stripe || submitting}>
        {submitting && <Loader2 className="size-4 animate-spin" />}
        Pay now
      </Button>
      <p className="text-[11px] text-muted-foreground text-center">
        Payments processed by Stripe. We never see your card number.
      </p>
    </form>
  );
}
```

- [ ] **Step 5: BillingPage**

Create `patient-portal/src/features/billing/BillingPage.tsx`:

```tsx
import { useState } from "react";
import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { useInvoices } from "./hooks/use-billing";
import { PayInvoiceModal } from "./components/PayInvoiceModal";
import type { Invoice } from "./api/billing-api";

const dollars = (c: number) => `$${(c / 100).toFixed(2)}`;

const statusTone: Record<string, "warning" | "success" | "neutral" | "danger" | "info"> = {
  open: "warning",
  partially_paid: "info",
  paid: "success",
  void: "neutral",
  refunded: "danger",
};

export function BillingPage() {
  const { data, isLoading } = useInvoices();
  const [paying, setPaying] = useState<Invoice | null>(null);

  return (
    <>
      <PageHeader title="Billing" subtitle="Invoices and payment history." />
      {!isLoading && data && data.length === 0 && (
        <Empty icon={<Receipt className="size-5" />} title="No invoices yet" description="Anything you owe will appear here." />
      )}
      {data && data.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-surface-subtle">
              <tr>
                <th className="px-4 py-3 text-left">Invoice</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-right">{""}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-2 font-mono text-xs">{inv.number}</td>
                  <td className="px-4 py-2">
                    <Badge variant={statusTone[inv.status] ?? "neutral"} size="sm">
                      {inv.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{dollars(inv.totalCents)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{dollars(inv.balanceCents)}</td>
                  <td className="px-4 py-2 text-right">
                    {inv.balanceCents > 0 && (
                      <Button size="sm" onClick={() => setPaying(inv)}>Pay now</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <PayInvoiceModal invoice={paying} onClose={() => setPaying(null)} />
    </>
  );
}
```

- [ ] **Step 6: Nav + route**

In `patient-portal/src/config/constants.ts`, add
`ROUTES.billing = "/billing"`.

In `Topbar.tsx`, add the nav item:

```ts
{ to: ROUTES.billing, label: "Billing" },
```

In `patient-portal/src/app/router.tsx`, add the protected route:

```tsx
<Route path={ROUTES.billing} element={<BillingPage />} />
```

- [ ] **Step 7: Typecheck + smoke + commit**

```bash
cd patient-portal && npm run typecheck
```

End-to-end smoke (browser, with real Stripe test keys in
`backend/.env`):
1. Provider portal → issue an invoice for Test patient.
2. Patient portal → Billing tab → "Pay now".
3. Use Stripe test card `4242 4242 4242 4242`.
4. Wait for webhook (you'll need `stripe listen --forward-to localhost:8000/api/v1/billing/stripe/webhook` in a terminal).
5. Invoice flips to `paid`, balance = 0.

```bash
git add patient-portal/ backend/app/api/v1/endpoints/patient_portal.py
git commit -m "feat(payments): patient portal Billing tab + Stripe Elements pay flow"
```

---

## Task 14: Manual end-to-end verification

This task is manual — no code, just exercise every path and tick the
boxes.

- [ ] **Step 1: Start the dev stack**

Terminal 1:
```bash
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000
```

Terminal 2 — Stripe CLI for webhook forwarding:
```bash
stripe listen --forward-to localhost:8000/api/v1/billing/stripe/webhook
```
Copy the printed `whsec_...` into `backend/.env` as
`STRIPE_WEBHOOK_SECRET`, restart backend.

Terminal 3:
```bash
cd frontend && npm run dev
```

Terminal 4:
```bash
cd patient-portal && npm run dev
```

- [ ] **Step 2: Catalog**
Admin logs into provider portal → Settings → Services & Pricing →
adds 3 services. Verify they list + price renders in USD.

- [ ] **Step 3: Charges**
Provider opens a patient → Billing tab → adds 2 charges from the
catalog → confirms running total matches.

- [ ] **Step 4: Issue invoice**
Click "Issue invoice" → status = `open`, balance = total, charges
hidden from "open charges" list and visible inside the invoice.

- [ ] **Step 5: Cash payment**
Click "Take cash" → enter full balance → save. Invoice flips to
`paid`, balance = 0. Click "Receipt" → PDF opens with the right
totals, payment row showing "cash · Drawer X".

- [ ] **Step 6: Stripe payment (separate invoice)**
Issue a second invoice. Open patient portal as the same patient
→ Billing → "Pay now" → use `4242 4242 4242 4242` (any future
expiry, any CVC). Watch the `stripe listen` terminal — see the
`payment_intent.succeeded` event forwarded. Refresh portal — invoice
flips to `paid`. Receipt PDF shows the masked card details.

- [ ] **Step 7: Replay test**
In Stripe Dashboard → recent events → click the `payment_intent.
succeeded` → "Resend webhook". Verify no duplicate `payments` row
created and balance still 0.

- [ ] **Step 8: Failure path**
Issue a third invoice. Try card `4000 0000 0000 0002` (Stripe's
"declined" test card). UI should toast an error; invoice stays
unpaid; a `payment_intent.payment_failed` webhook fires and flips
the pending payment row to `failed`.

- [ ] **Step 9: Commit the smoke result**

```bash
git commit --allow-empty -m "test(payments): Phase 1 smoke test passes end-to-end"
```

---

## Done criteria

All of these must be true to call P1 complete:

1. `alembic current` shows `0022_payments_v1 (head)`.
2. `pytest tests/test_service_catalog_service.py tests/test_charge_service.py tests/test_invoice_service.py tests/test_payment_service.py tests/test_stripe_webhook.py` — all green.
3. `cd frontend && npm run typecheck` clean.
4. `cd patient-portal && npm run typecheck` clean.
5. Admin can CRUD services. Provider can add charges, issue invoice,
   take cash payment, download PDF receipt.
6. Patient can see invoices in their portal and pay an open balance
   with a Stripe test card.
7. Stripe webhook is the authoritative confirmation — manually
   creating a `succeeded` Payment row without the webhook is not how
   the system normally lands there.
8. Replayed webhook events are idempotent (no duplicate rows).
9. Decline path keeps the invoice unpaid and surfaces the error.
