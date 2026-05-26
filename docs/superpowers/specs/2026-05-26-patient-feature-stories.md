# Patient feature deepening — user stories

**Date:** 2026-05-26
**Scope:** Make every card on the patient profile fully functional with add/edit, wire all patient-list filters, and reorganize the profile around clinician workflow.

## Story 6 — Profile reorganization *(shipped)*

> **As any user, I want the profile organized by "what I most often need first" so I don't scroll past 13 cards to find labs.**

Acceptance:
- ✅ Patient header (avatar, name, MRN, demographics, status, Edit + Remove) stays at the top across all tabs
- ✅ Alerts strip stays visible across all tabs — critical, warning, info chips in a horizontal row
- ✅ 6 tabs: Overview · Clinical notes · Vitals & Labs · Medications · Documents · Care plan
- ✅ URL syncs via `?tab=<value>` so links are shareable; `overview` is the default and omits the param
- ✅ Each tab is its own grid; ClinicalActions sidebar appears on Overview / Notes / Medications

## Story 1 — Per-card edit pencils

> **As a clinician, when I find something to update on the profile I want to fix it in place without leaving the page.**

Acceptance:
- Every card with a pencil icon opens the appropriate drawer (PatientDrawer for demographics; new drawers for clinical context, medications, alerts, etc.)
- "+" icons open the same drawer in add-new mode
- Drawers carry the current patient id so writes invalidate the right cache key
- Edit always uses optimistic updates with rollback on error

## Story 2 — Alerts CRUD

> **As a clinician, I want to flag time-critical info (DNR, allergies, isolation) so the next person sees it instantly.**

Acceptance:
- New `alerts` table on backend with patient_id FK, severity, title, body, source, dismissed_at
- `GET /patients/:id/alerts`, `POST /patients/:id/alerts`, `PATCH /alerts/:id`, `DELETE /alerts/:id`
- Frontend: AlertDrawer (severity, title, body)
- Alerts strip becomes data-driven; +Add Alert button works; pencil edits; X dismisses (soft-delete)

## Story 3 — Medications CRUD

> **As a prescriber, I want a real medication list with start/stop dates and a paused state for pre-op.**

Acceptance:
- `MedicationsCard` consumes `useMedications(patientId)` (already-exists endpoints)
- "+ Add med" → MedicationDrawer with name, dose, frequency, route, RxNorm (free text for now), start date, prescriber
- Per-row dropdown menu: Edit / Pause / Discontinue / Delete
- Status badge updates on the row immediately (optimistic)
- Future: drug-drug interaction stub (later phase)

## Story 4 — SOAP notes CRUD

> **As a clinician, I want to add a SOAP note that auto-versions and saves to the patient.**

Acceptance:
- "New note" on SOAP card → SoapNoteDrawer with Subjective / Objective / Assessment / Plan tabs
- On save → `POST /notes`, invalidate notes list, drawer closes
- Notes list below the current one (most recent first), expandable
- Each note has author + timestamp + version number

## Story 5 — Vitals CRUD + trend

> **As a nurse, I want to record vitals at the bedside and see a 24h trend.**

Acceptance:
- `VitalsCard` consumes `useVitals(patientId)` (already-exists endpoints)
- "+ Reading" → quick inline form (BP/HR/Temp/SpO2/Resp/BMI all in one save)
- Click a vital tile → modal with sparkline trend (last 24h / 7d / 30d toggle)

## Story 6.5 — Patient list filters + sort

> **As any user, I want to narrow the list to "at-risk patients I'm assigned to" in 2 clicks.**

Acceptance:
- Filter button opens a Popover with multi-select chips: Status / Risk / ASA / ICU / Assigned physician
- Sort by button opens a Popover with column + asc/desc
- Selected filters become removable chips below the search row
- Backend already accepts the query params; just need the UI

## Execution order

| # | Story | Reason for order |
|---|---|---|
| 1 | Story 6 (reorg) ✅ | Land first so subsequent work targets the right layout |
| 2 | Story 6.5 (list filters) | High-traffic page, smallest scope of remaining stories |
| 3 | Story 3 (medications) | Highest clinical value, existing BE endpoints |
| 4 | Story 4 (SOAP) | Versioning + drawer pattern reusable for stories 2 + 5 |
| 5 | Story 5 (vitals) | Time-series + chart work, isolated |
| 6 | Story 2 (alerts) | New BE table; benefits from drawer/CRUD patterns built in 3+4 |
| 7 | Story 1 (per-card edit pencils) | Catches anything not yet wired; pure FE wiring |

## Out of scope (deferred)

- Imaging viewer (Phase C with AI integration)
- Document OCR + RAG (Phase C)
- WebSocket realtime updates on cards (Phase C)
- Multi-tab vitals trend (per-metric sparkline panel) — basic trend modal sufficient for Phase B
- Drug-drug interaction checking
- E-signature on consent forms
