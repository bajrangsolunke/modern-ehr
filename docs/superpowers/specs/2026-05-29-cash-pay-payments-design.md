# Cash-Pay Payment Flow — Design Spec

**Status:** Draft for approval · 2026-05-29
**Scope:** Self-pay / cash-pay only (no insurance, no clearinghouse, no X12).
**Provider models this fits:** Direct Primary Care (DPC), concierge,
behavioral health, urgent care, aesthetics, dental, cash-only practices.

---

## 1. North-star principle

> Every clinical event that *might* generate money produces a **Charge**.
> Charges roll up into an **Invoice**. Invoices are paid by one or more
> **Payments** (cash at desk, card-present, online via Stripe, or
> patient-portal self-serve).

That single sentence is the entire model. Everything else is plumbing.

---

## 2. Personas

| Persona | Who | Cares about |
|---|---|---|
| **Front-desk staff** | Receptionist / MA | Quick check-out, take cash or card, print receipt, send statement. |
| **Provider** | Physician / NP / behavioral therapist | Picks the right service code on the encounter, doesn't want to chase money. |
| **Practice admin** | Office manager / owner | Daily close-out, AR aging, refunds, fee-schedule changes, end-of-month report. |
| **Patient** | Self-pay patient | See what they owe, pay online from the portal, get a receipt by email, set up a payment plan. |

---

## 3. Data model

Five new tables. Names match what's already in the codebase style.

```
┌──────────────────┐        ┌─────────────────┐       ┌────────────────┐
│ service_catalog  │◀──┬──▶│ charges          │──┬──▶│ invoices        │
│   (price list)   │   │    │   (line items)   │  │    │  (groupings)   │
└──────────────────┘   │    └─────────────────┘  │    └────────┬───────┘
                       │                          │             │
                       │                          │             │
                       │             ┌───────────────────────────┘
                       │             ▼
                       │    ┌─────────────────┐       ┌────────────────┐
                       │    │ payments         │──────▶│ refunds        │
                       │    │ (cash/card/Stripe)      │  (negative pay)│
                       │    └─────────────────┘       └────────────────┘
                       │
                       ▼  (denormalised CPT/description snapshot —
                          charges survive catalog edits)
```

### 3.1 `service_catalog`

The practice's price list. Editable by admins. Each row is one
billable service.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `code` | str(32) | Internal code (`VISIT-30`, `INJECTION-B12`). CPT-compatible but free-form. |
| `name` | str(255) | "30-minute follow-up visit" |
| `category` | enum | `visit / procedure / lab / supply / membership / other` |
| `price_cents` | int | All money is **cents**, never floats. |
| `tax_rate_bp` | int | Basis points (0 for medical, 825 for 8.25% sales-taxable supplies). |
| `is_active` | bool | Soft-delete via flag — never hard-delete (history). |
| `taxable` | bool | Convenience flag. |
| `created_at` / `updated_at` | timestamptz | |

### 3.2 `charges`

A single line item attached to a patient (and usually an encounter).
Charges are immutable once invoiced — edits become void+new lines.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `patient_id` | UUID FK | |
| `encounter_id` | UUID FK NULL | Linked when generated from a visit; NULL for ad-hoc. |
| `appointment_id` | UUID FK NULL | Same idea for slot-based fees. |
| `service_catalog_id` | UUID FK NULL | NULL allowed for free-form charges. |
| `description` | str(255) | Snapshot at time of charge — survives catalog edits. |
| `code` | str(32) | Same snapshot pattern. |
| `quantity` | int | Default 1. |
| `unit_price_cents` | int | Snapshot of `service_catalog.price_cents`. |
| `discount_cents` | int | Negative on the visible total. |
| `tax_cents` | int | Computed at charge time. |
| `total_cents` | int | Stored — `qty * unit - discount + tax`. |
| `invoice_id` | UUID FK NULL | NULL = "uninvoiced / WIP". |
| `voided_at` | timestamptz NULL | Soft-void instead of delete (audit). |
| `voided_by_user_id` | UUID FK NULL | |
| `created_by_user_id` | UUID FK | Who added it. |
| `created_at` | timestamptz | |

### 3.3 `invoices`

A bundle of charges presented to the patient as one bill.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `number` | str(32) | Human-friendly: `INV-2026-001234`. Generated server-side. |
| `patient_id` | UUID FK | |
| `status` | enum | `draft / open / paid / partially_paid / void / refunded` |
| `subtotal_cents` | int | Sum of charge subtotals. |
| `discount_cents` | int | Invoice-level discount (membership, promo). |
| `tax_cents` | int | Sum of charge taxes. |
| `total_cents` | int | Final due. |
| `paid_cents` | int | Sum of completed payments (net of refunds). |
| `balance_cents` | int | `total - paid`. Updated on every payment write. |
| `issued_at` | timestamptz NULL | Set when status leaves `draft`. |
| `due_at` | timestamptz NULL | Default = issued_at + 14d. |
| `created_at` / `updated_at` | timestamptz | |
| `notes` | text NULL | Patient-visible note ("Thanks for visiting…"). |

### 3.4 `payments`

One row per money movement. `cash`, `card_present`, `stripe_online` and
`adjustment` (write-off, courtesy discount) all live here.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `invoice_id` | UUID FK | |
| `patient_id` | UUID FK | Denormalised for fast patient-AR queries. |
| `method` | enum | `cash / check / card_present / stripe / adjustment` |
| `amount_cents` | int | **Positive**. Refunds are a separate row in `refunds`. |
| `status` | enum | `pending / succeeded / failed / cancelled` |
| `stripe_payment_intent_id` | str NULL | Idempotency + reconciliation. |
| `stripe_charge_id` | str NULL | For receipts. |
| `last4` | str(4) NULL | Card brand + last 4, for the receipt only. |
| `card_brand` | str(16) NULL | |
| `reference` | str(64) NULL | Check number, Zelle confirmation, etc. |
| `received_by_user_id` | UUID FK NULL | Front desk who took the cash. |
| `created_at` | timestamptz | |

### 3.5 `refunds`

Audit-quality refund trail — full + partial.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `payment_id` | UUID FK | Original payment being refunded. |
| `amount_cents` | int | ≤ original payment amount minus prior refunds. |
| `reason` | str(255) | Required for the audit log. |
| `stripe_refund_id` | str NULL | When refunding a Stripe charge. |
| `status` | enum | `pending / succeeded / failed` |
| `refunded_by_user_id` | UUID FK | |
| `created_at` | timestamptz | |

### 3.6 Existing models — what changes

- **`encounter`**: gain a derived `total_charges_cents` (computed) for the
  chart header. No schema change required — query-on-demand.
- **`patient`**: add `stripe_customer_id` (str NULL) so we don't recreate
  customers across visits.
- **`task`**: the existing `Collect Payment` task auto-resolves when its
  linked invoice flips to `paid`.
- **`appointment`**: optional `pre_visit_fee_charge_id` so a deposit at
  booking is traceable.

---

## 4. User stories

### Epic A — Catalog & pricing

**A1. Admin builds the price list.**
*As an office manager, I want to add/edit services with prices so providers see consistent pricing.*

Acceptance:
- Admin-only `/settings/services` page.
- Required: code, name, category, price (USD entered as `12.50`, stored
  as `1250` cents).
- Soft-delete only. Past charges reference the snapshot, not the live row.

**A2. Provider picks a service in seconds during check-out.**
*As a provider, I want a fast picker to attach charges to an encounter.*

Acceptance:
- Fuzzy search over `code` + `name`.
- Recent / favourites pinned to the top.
- One click adds at quantity 1 with default price.

---

### Epic B — Charge capture

**B1. Auto-charge from appointment type.**
*As a front-desk user, I want the booked appointment type to pre-load a charge so I don't have to remember.*

Acceptance:
- `appointment.type` → mapped via `service_catalog.code`.
- Charge is created in `draft` state when the appointment is checked-in.
- Provider can add/remove/adjust before invoicing.

**B2. Provider adds procedures during the visit.**
*As a provider finishing my SOAP note, I want to add procedure charges from the same screen.*

Acceptance:
- "Charges" tab on the encounter sidebar (next to Diagnoses).
- Add / edit qty / apply discount / remove (soft-void with reason).
- Real-time running total at the top.

**B3. Discount or write-off with a reason.**
*As an admin, I want to discount a line or write off a balance with a recorded reason.*

Acceptance:
- Two discount levers: line-level (on a charge) and invoice-level.
- Free-text reason required.
- Audit-log row written.

---

### Epic C — Invoicing

**C1. One-click invoice from an encounter.**
*As front desk, I want to bundle the open charges into an invoice on check-out.*

Acceptance:
- "Invoice & charge" button on the encounter.
- Confirms total, applies any membership-tier discount, flips status to
  `open`.
- Invoice number generated atomically (no gaps, sequential per practice).
- Triggers a "Collect Payment" task if the patient elects to pay later.

**C2. Patient sees the invoice in the portal.**
*As a patient, I want to see what I owe and pay online.*

Acceptance:
- New "Billing" tab in the patient portal.
- Lists open + paid invoices, each with line items + a "Pay now" button.
- PDF download of a clean, itemised receipt for paid invoices.

**C3. Send invoice by email + SMS.**
*As front desk, I want a single button to send the invoice + a hosted
payment link to the patient.*

Acceptance:
- Sends to patient.email (if present) and patient.phone (if SMS provider
  configured).
- Link goes to a tokenised public page (no portal login required).
- Token: 7-day expiry, single-resource scope (this invoice only).

---

### Epic D — Payments

**D1. Cash payment at the desk.**
*As front desk, I want to record cash received and print a receipt.*

Acceptance:
- "Take payment" → method=cash → amount → confirmation.
- Receipt prints / emails / both.
- Drawer log line created (open question §8.1 — drawer model optional).

**D2. Card-present at terminal.**
*As front desk, I want to charge a physical card via the Stripe Terminal.*

Acceptance:
- Stripe Terminal integration (WisePOS reader).
- Reader is paired in `/settings/devices`.
- Reads chip/tap, success → payment row + receipt.

**D3. Patient pays online from the portal.**
*As a patient, I want to pay my invoice with a credit/debit card.*

Acceptance:
- Stripe Payment Intents flow with Stripe Elements (PCI scope minimised).
- Saves the card to `stripe_customer_id` only if the patient ticks "save
  for future visits".
- On success, invoice flips to `paid` immediately; webhook is the
  authoritative confirmation.

**D4. Hosted payment page (no login).**
*As a patient who clicked the SMS link, I want to pay without logging in.*

Acceptance:
- Tokenised URL (`/p/pay/<token>`) shows the invoice line items + a
  Stripe Element.
- After success, simple confirmation page. No PHI beyond the patient's
  first name + invoice number is rendered (minimum necessary).

**D5. Card on file for repeat visits / DPC subscription.**
*As a DPC patient, I want the monthly membership to auto-bill my saved card.*

Acceptance:
- Stripe Customer per patient (`patient.stripe_customer_id`).
- Subscription created for `category=membership` services with
  `interval=month`.
- Webhook on invoice.payment_succeeded creates a payment row.
- Failed retry → notification + portal banner asking the patient to
  update the card.

---

### Epic E — Refunds & adjustments

**E1. Refund a Stripe payment.**
*As an admin, I want to refund all or part of a Stripe payment.*

Acceptance:
- Provider-or-admin-only.
- Required reason field.
- Calls `stripe.Refunds.create()`, persists `refunds` row.
- Invoice `paid_cents` decrements; status may flip back to
  `partially_paid` or `refunded`.

**E2. Refund a cash payment.**
*As an admin, I want to record a cash refund.*

Acceptance:
- No Stripe call — just a `refunds` row with method=`cash` reason
  required, audit-logged.

---

### Epic F — Reporting

**F1. Daily close-out.**
*As front desk at end of shift, I want a one-page summary of money taken today.*

Acceptance:
- `/billing/daily` shows: cash count, Stripe count, total, refunds,
  voids, list of payments with patient initials + amount.
- "Mark closed" snapshots the report so a re-open warning fires on
  late-arriving payments.

**F2. AR aging.**
*As an admin, I want to see who owes me and for how long.*

Acceptance:
- `/billing/ar` lists every patient with `balance_cents > 0`.
- Buckets: 0-30, 31-60, 61-90, 90+ days from `due_at`.
- Click → patient billing tab.

**F3. Revenue by service.**
*As an admin, I want to know which services produced revenue this month.*

Acceptance:
- Group by `service_catalog.code`, sum `total_cents` of paid charges in
  the date range.

---

## 5. End-to-end flows

### 5.1 Happy path — in-person visit, cash

```
Booking ──▶ Check-in ──▶ Encounter starts ──▶ SOAP note
                              │
                              ├─▶ Charge auto-created (B1)
                              │
                              ▼
                       Provider adds extras (B2)
                              │
                              ▼
                   Invoice created on check-out (C1)
                              │
                              ▼
                  Front desk takes cash (D1)
                              │
                              ▼
                Receipt printed + emailed
                              │
                              ▼
              Invoice status = paid, balance = 0
                              │
                              ▼
              "Collect Payment" task auto-resolves
```

### 5.2 Happy path — pay later from portal

```
Visit finishes ──▶ Invoice issued, balance > 0
                              │
                              ▼
       Email + SMS sent with link to hosted page (C3)
                              │
                              ▼
   Patient opens portal Billing tab OR clicks SMS link (D3/D4)
                              │
                              ▼
              Stripe Payment Intent created
                              │
                              ▼
            Patient enters card / Apple Pay / Google Pay
                              │
                              ▼
        Webhook `payment_intent.succeeded` → payment row
                              │
                              ▼
                 Invoice paid, receipt emailed
```

### 5.3 Refund flow

```
Admin opens payment row ──▶ "Refund" ──▶ Reason + amount ──▶ Confirm
                                                  │
                                                  ▼
                                      stripe.Refunds.create()
                                                  │
                                                  ▼
                                       Refund row persisted
                                                  │
                                                  ▼
                                Invoice paid_cents recalculated
                                                  │
                                                  ▼
                                      Patient notified by email
```

---

## 6. Stripe integration plan

### 6.1 Account setup

- Use **Stripe Restricted Keys** scoped to `payment_intents`,
  `customers`, `refunds`, `payment_methods`, `webhooks`.
- Sign Stripe's **BAA** (free, self-serve via Stripe Dashboard for
  US healthcare customers).
- Webhook endpoint signed with the rotating webhook secret stored in
  `STRIPE_WEBHOOK_SECRET`.

### 6.2 New env vars

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_TERMINAL_LOCATION_ID=tml_...        # only if in-person card
PAYMENT_TOKEN_SECRET=...                    # for hosted-link signing
```

### 6.3 SDK pieces we'll use

| Stripe primitive | Used for |
|---|---|
| `Customer` | One per patient. Stored on `patient.stripe_customer_id`. |
| `PaymentIntent` | Every online payment. Idempotency keyed by `invoice_id + attempt`. |
| `PaymentMethod` | Saved cards for repeat visits / DPC. |
| `Refund` | Refund flow. |
| `Webhook` events | Authoritative confirmation — `payment_intent.succeeded`, `charge.refunded`, `payment_intent.payment_failed`. |
| `Terminal.Reader` | Card-present (Phase 2). |
| `Subscription` + `Price` | DPC monthly billing (Phase 2). |

### 6.4 Key invariants

- **The webhook is the source of truth.** The browser's success
  callback only optimistically updates UI; the payment row is created
  by the webhook handler.
- **Idempotency.** Webhook handler is keyed by `event.id`; replays
  are no-ops.
- **PCI scope is minimal.** No card numbers ever touch our server.
  Stripe Elements tokenises in the browser.
- **All money in cents.** Pydantic validators reject anything else.

---

## 7. UI touchpoints

| Surface | What lands there |
|---|---|
| **Settings → Services & Pricing** | Admin catalog CRUD (Epic A) |
| **Patient profile → Billing tab** | Invoices, payments, refunds for that patient (provider/admin view) |
| **Encounter → Charges panel** | Add/remove/discount charges; "Invoice & charge" button (Epic B + C) |
| **New nav item: Billing** | AR aging, daily close-out, revenue (Epic F) — admin/staff only |
| **Patient portal → Billing tab** | Patient-facing invoice list + pay button (Epic C2 + D3) |
| **Public `/p/pay/<token>`** | Hosted page for SMS/email payment (D4) |
| **Topbar notification badge** | "1 invoice paid · $120" toasts for staff in real-time (WS) |

---

## 8. Open questions for the team

1. **Cash-drawer model** — do you want a `cash_drawer_sessions` table
   to enforce drawer balancing, or is per-payment cash tracking enough?
   *Recommendation: skip for v1.*
2. **Patient statements** — do we send a monthly statement summarising
   all open invoices, or just per-invoice reminders?
   *Recommendation: per-invoice email + a single weekly digest if balance > 0.*
3. **Multi-location** — single-location v1, or do invoices need a
   `location_id` from day one?
   *Recommendation: single location; add `location_id` later if needed.*
4. **Tax** — most medical is exempt; do we need a tax engine
   (Stripe Tax, Avalara) or is per-service flat rate enough?
   *Recommendation: per-service flat rate. Stripe Tax later if you sell
   taxable supplies.*
5. **Membership / subscription billing** — included in v1 or Phase 2?
   *Recommendation: Phase 2 — adds 2 weeks; ship invoice + one-off
   payments first.*

---

## 9. Implementation phases

| Phase | Scope | Effort |
|---|---|---|
| **P1 — Foundation** | Tables + service catalog CRUD + manual charge add + invoice issue + cash payment + Stripe online payment (logged-in portal) + receipts (PDF) + webhook handler | **5–7 days** |
| **P2 — Hosted link + reports** | SMS/email payment links + AR aging + daily close-out + revenue by service | **2–3 days** |
| **P3 — Refunds + write-offs** | Refund flow (Stripe + cash) + adjustments + audit | **2 days** |
| **P4 — Card-present** | Stripe Terminal reader pairing + tap/chip payment | **3 days** |
| **P5 — Subscriptions** | DPC membership recurring billing + dunning | **4–5 days** |

Phases 1-3 ship in **9–12 working days**.

---

## 10. Non-goals (explicit)

- No insurance billing (837/835/270/271). Not in this spec.
- No prior authorisation.
- No claim scrubbing.
- No statements as USPS mail.
- No payment plan automation (manual partial payments only in v1).
- No multi-currency. USD only.

---

## 11. Why this design

- **Charges-then-invoices** is the AdvancedMD / Athena pattern,
  reduced to the bits a cash-pay practice actually needs.
- **Cents everywhere** avoids the float-rounding bug class entirely.
- **Snapshots on charges** mean editing the catalog never rewrites
  history (audit + financial integrity).
- **Webhook-as-source-of-truth** is the only safe Stripe pattern;
  the browser callback can lie.
- **Hosted public link** is how Square / Cliniko / Spruce do it —
  reduces friction massively (no portal login on a mobile keyboard
  at 8pm).
- **Single "Billing" tab on the portal** stays consistent with the
  other tabs (Documents, Appointments, Tasks) you already shipped.

---

## Sign-off

Approve this spec (or push back on the open questions in §8) and I'll
turn Phase 1 into a TDD-driven implementation plan.
