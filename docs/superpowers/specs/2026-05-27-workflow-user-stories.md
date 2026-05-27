# Padmavat EHR — Workflow user stories

A reference for the major workflows shipping in the platform. Each
story lists the actor, intent, acceptance criteria, and the modules
that implement it. Use this as the source of truth when changing
behavior — if the spec and the code diverge, this doc wins.

Roles in scope:
- **Provider** — clinicians (write clinical records, see assigned
  patients, manage own availability)
- **Staff** — schedulers (read patients, schedule + manage
  appointments)
- **Admin** — everything, plus user management

---

## 1. Authentication

### US-AUTH-1 — Sign in
**Actor**: any user.
**Intent**: get into the application with email + password.

Acceptance:
1. `POST /auth/login/json` issues access + refresh tokens (24-hour
   access, 30-day refresh).
2. Token + user are persisted to localStorage and the auth store.
3. Successful login routes to `/` (Dashboard) and gates `/login` so a
   signed-in user can't re-enter the login route.
4. Failed login returns 401 with `"Incorrect email or password"`;
   form surfaces the message inline.
5. Disabled (`is_active=false`) accounts get 403 with a clear copy.

Implementation: `features/auth/components/LoginForm.tsx`,
`AuthService.authenticate`.

### US-AUTH-2 — Silent refresh
**Actor**: signed-in user with a stale access token.
**Intent**: stay signed in across the access-token lifetime without
re-typing the password.

Acceptance:
1. Any 401 in `api-client.ts` triggers one `POST /auth/refresh`
   attempt before propagating the error.
2. On success, the new tokens replace the old in localStorage and the
   original request is retried once.
3. On failure, the user is logged out and routed to `/login`.

Implementation: `lib/api-client.ts:attemptRefresh`.

### US-AUTH-3 — Sign out
Acceptance: clears tokens, resets auth store, clears query cache,
navigates to `/login`. Implementation: `useLogout`.

---

## 2. Patient management

### US-PAT-1 — Browse patients
**Actor**: any signed-in user.

Acceptance:
1. `/patients` lists patients with a paginated, sortable table.
2. Table view ↔ card grid view toggle, persisted to the app store.
3. Free-text search on name, MRN, or procedure (debounced 300 ms).
4. Filter chips: status, risk, ASA, ICU, assigned provider.
5. Sort by mrn, first_name, procedure_date, risk_score, created_at.
6. Provider names render inline (no per-row lookup) — backend embeds
   `assigned_physician_name`.

Implementation: `features/patients/PatientsPage.tsx`,
`PatientRepository.search`, `PatientOut.assigned_physician_name`.

### US-PAT-2 — Create a patient (US clinical onboarding)
**Actor**: provider or admin.

Acceptance:
1. New-patient drawer opens from the listing page header.
2. Identity row: portrait uploader (vertical 3:4 frame, resized
   client-side to 360×480 JPEG before send) + MRN + Sex + DOB on row
   one; First/Last name + City on row two.
3. Contact section: email (EmailStr validated), phone.
4. Clinical: planned procedure, procedure date, ASA class, ICU bed
   toggle.
5. Care plan: assigned provider (`useUsers({role:"provider"})`),
   status, risk, free-text tags (comma-separated).
6. Server rejects future DOB and duplicate MRN (409).
7. On success the listing query invalidates and the drawer closes.

Implementation: `PatientDrawer` + `PatientForm`.

### US-PAT-3 — Edit a patient
**Actor**: provider or admin.

Acceptance:
1. Pencil on each table row opens the same drawer prefilled.
2. MRN is now editable (uniqueness re-checked on PATCH).
3. Sex + DOB stay locked — clinically immutable; will need a separate
   audited flow.
4. All writes are audited (`patient.update`, payload sanitized via
   `jsonable_encoder` so JSONB stores it cleanly).

### US-PAT-4 — Soft-delete a patient
**Actor**: admin (others: deactivate via status).
Acceptance: confirm dialog → DELETE → optimistic row removal →
audit row.

### US-PAT-5 — Patient profile (tabbed)
**Actor**: any signed-in user.

Acceptance:
1. `/patients/:id` lays out a tabbed workspace: Overview, Clinical
   notes, Vitals & Labs, Medications, Documents, Care plan.
2. `?tab=` keeps the URL shareable.
3. Sticky header: portrait (with self-upload), name, demographics,
   action buttons (Call, Schedule visit) + kebab menu (Edit, Remove).
4. AlertsStrip below the header is always visible across tabs.

---

## 3. Clinical writes

### US-CLIN-1 — SOAP notes
**Actor**: provider or admin.

Acceptance:
1. Notes are versioned: every PATCH increments `version`. UI shows
   latest as the open S/O/A/P tabs and previous revisions collapsed
   below.
2. Empty notes refused (schema-level refine: at least one section
   must have text).
3. Quick delete behind a confirm dialog, optimistic.

Implementation: `SoapNotesCard`, `SoapNoteDrawer`, `NotesService`.

### US-CLIN-2 — Medications
**Actor**: provider or admin.

Acceptance:
1. Inline RowMenu actions: Edit, Pause/Resume, Discontinue, Remove.
2. Discontinued rows render muted (opacity 60%).
3. Remove sits behind a confirm + an in-copy nudge toward
   Discontinue (preserves clinical history).

### US-CLIN-3 — Vitals + trend
**Actor**: provider or admin (nurses included in clinical writer
historically; now collapsed into provider).

Acceptance:
1. Each metric has a normal-range, criticals, default unit
   (frontend/src/features/patients/lib/vital-metrics.ts).
2. Tile shows latest value, trend arrow, status colour.
3. Click a tile → trend drawer with Recharts sparkline +
   reference-band for the normal range + per-row delete.

### US-CLIN-4 — Patient alerts strip
Acceptance:
1. Header strip shows critical → warning → info ordered chips.
2. Resolved alerts hidden by default, can be surfaced via
   `?include_resolved=true`.
3. Provider/admin can add (severity + label + optional detail) or
   dismiss with X-confirm.

---

## 4. Appointments

### US-APPT-1 — Browse appointments
**Actor**: staff, provider, admin.

Acceptance:
1. `/appointments` shows stat tiles (today, this week,
   cancellations 7d, no-shows 7d) fed by
   `/appointments/stats?physician_id=…`.
2. Filters: search by patient name/MRN; date preset (Upcoming /
   Today / This week / All time); status chips; for providers,
   Mine vs. All toggle (defaults to Mine).
3. Embedded patient + provider names in every row.
4. Quick status actions per row: Confirm, Complete, No-show, Cancel.
5. Pencil for full edit, admin-only Remove with confirm.

### US-APPT-2 — Round-robin slot booking
**Actor**: staff, provider, admin.

Acceptance:
1. New-appointment modal walks: Patient → Type + Duration → Date →
   optional Provider → **slot grid**.
2. Slots come from `/appointments/slots` which expands each active
   provider's weekly availability into the requested-duration
   windows, minus existing non-cancelled appointments.
3. With no provider selected, slots from every active provider are
   shown round-robin: by start time first, then ascending by each
   provider's day-load.
4. Each tile shows the provider name + a Light/Busy/Heavy load chip.
5. Picking a slot locks `physician_id`, `starts_at`, and `duration`.
6. Modal stays anchored near the top across body changes — no
   shake when state changes.

### US-APPT-3 — Reschedule
**Actor**: staff, provider, admin.
Acceptance: edit modal keeps free-form date/time/duration inputs
(reschedules don't have to land on an availability slot). Status
changes are audited.

### US-APPT-4 — Dashboard upcoming list
Acceptance: dashboard's Upcoming Appointments card consumes the
same embedded-names response — no per-row N+1, no "—" placeholders.

---

## 5. User management (admin)

### US-USER-1 — Browse users
Acceptance:
1. `/users` admin-only, gated by `<AdminRoute />` and hidden from
   nav for non-admins.
2. Table + card view toggle.
3. Search by name/email, filter by role (Provider / Staff / Admin),
   filter by status (Active / Deactivated).
4. Pagination prev/next, page-of-N pill.

### US-USER-2 — Invite a user
Acceptance:
1. Drawer with portrait uploader + name + email + role + specialty
   + password (≥8 chars).
2. Email uniqueness checked server-side (409 on clash).
3. Audited on success.

### US-USER-3 — Edit a user
Acceptance:
1. Same drawer, prefilled.
2. Email field disabled (durable identity).
3. Password field optional ("leave blank to keep").
4. Admin cannot demote themselves or deactivate their own account.

### US-USER-4 — Deactivate / reactivate
Acceptance: DELETE soft-deletes (sets `is_active=false`); audit row
preserved. Reactivation via PATCH.

### US-USER-5 — User profile
Acceptance:
1. `/users/:id` shows header card, 4 stat tiles (assigned patients,
   upcoming appts, completed appts, weekly hours), recent
   appointments, assigned patients with deep-link.
2. For providers, AvailabilityEditor inline so admins can manage
   on their behalf.

---

## 6. Settings (self-service)

### US-SET-1 — Profile
**Actor**: any signed-in user.
Acceptance: `PATCH /auth/me` updates own full_name, specialty,
avatar_url. Auth store live-syncs so the topbar greeting updates
without reload. Email + role remain admin-managed.

### US-SET-2 — Change password
**Actor**: any signed-in user.
Acceptance: current password verified before hash rotation. Audit
row written; password value redacted.

### US-SET-3 — Weekly availability
**Actor**: provider or admin.

Acceptance:
1. Quick-start templates: Mon–Fri 9–5, Mon–Fri 8–5, Mon–Sat 8–5.
   Applying a template wipes existing slots on the target days
   and re-creates with the chosen window — atomic, single toast.
2. Each day row: status dot + day name + inline time pills
   (HH:MM-to-HH:MM) + "Add another time block" + per-day
   "Copy hours to…" menu (Other weekdays / Weekend / All other
   days).
3. Off days render as a single line ("Not available · Set hours").
4. Clear-all action behind a confirm dialog.
5. Sum of weekly active hours surfaces in the header chip and on
   the user detail page.

---

## 6.5. Documents library

### US-DOCS-1 — Browse the library
**Actor**: any signed-in user.
Acceptance:
1. `/docs` lists every document with attached patient, category,
   uploaded-by, size, created-at.
2. Card grid; same header layout as Patients/Appointments/Users
   (search · Filters popover · Upload).
3. Summary tiles: total, consent, imaging, lab.

### US-DOCS-2 — Filter and search
Acceptance:
1. Free-text search hits filename and summary.
2. Filter popover groups: category (consent / lab / imaging /
   discharge / referral / insurance / operative / pathology /
   education / advance directive / other), uploaded-by Me/Anyone.
3. `?patient_id=` scopes results to one chart (used by the
   Documents tab on the patient profile).

### US-DOCS-3 — Upload
**Actor**: provider or admin.
Acceptance:
1. Modal: patient picker (live search) → category buttons →
   drag-drop / click file dropzone. Cap 25 MB.
2. Server stores file content inline (BYTEA) for download, extracts
   text for `text/*` previews.
3. Audit row written. Patient FK validated → 404 on typo.

### US-DOCS-4 — Preview & download
Acceptance:
1. Click any card → details modal with metadata, category badge,
   attached patient link.
2. For `text/*`, the modal calls `/documents/:id/preview` and shows
   the body inline (scroll-capped).
3. Other types show a "Download to view" affordance.
4. Download fetches the bytes with `Authorization`, drops them
   through a blob URL so the browser saves with the original
   filename.

### US-DOCS-5 — Delete
**Actor**: provider or admin.
Acceptance: trash action in the details modal, behind a confirm,
audited. Optimistically removed from cached lists; rolled back on
error.

### US-DOCS-6 — Patient profile integration
Acceptance: the patient profile's Documents tab consumes
`useDocuments({ patient_id })` so the same component renders
patient-scoped — single source of truth.

---

## 6.6. Communication (Messages)

The Communication module replaces the top-nav "Insights" slot.
Insights moves into the new Reports section (see 6.7). Messaging
is currently a UI-only scaffold backed by an in-memory store; the
backend contract (`conversations`, `messages` tables, WebSocket
or polled `/messages` endpoints) lands in the next phase.

### US-COMM-1 — Browse conversations
**Actor**: provider, staff, or admin.
Acceptance: `/messages` shows a two-pane layout — a left list of
conversations and a right thread. The list has:
- A "Patients · Clinicians" segmented toggle (audience scope).
- A search field that filters by participant name and last-message
  text.
- A chip filter row with condition tags (Diabetic, Asthma, Cancer,
  BP, Mental, All) that filters the patient list. Chips only
  render in the Patients tab.
- One row per conversation with name, condition badge (if any),
  last-message snippet (truncated to one line), and timestamp
  ("Today, 09:15 AM" / "08/24/2025, 09:45 AM" depending on
  recency). Active conversation has a primary-border highlight.

### US-COMM-2 — Read a thread
Acceptance: opening a conversation renders a header strip with the
participant's clinical context (name + MRN, DOB, age, gender,
phone, email) and a "View patient profile" deep-link
(`/patients/:id`). For clinician threads the header collapses to
name + role + email. Messages render as bubbles — incoming on the
left in `bg-surface-subtle`, outgoing on the right in
`bg-primary-gradient text-white`. Each bubble shows time as a
muted sub-line. The thread scrolls independently of the
left list.

### US-COMM-3 — Send a reply
Acceptance: a bottom composer with `Type a message…` input and a
Send button appends a new outgoing message to the current thread
and clears the input. Empty input disables Send. Enter sends;
Shift+Enter inserts a newline. The list's last-message snippet
and timestamp update immediately. (UI-only optimistic add today;
will hit a real `POST /messages` once the backend lands.)

### US-COMM-4 — Compose a new message
Acceptance: the "+ Compose" button in the page header opens a
modal with two columns:
- **Recipients**: search field, "Select all" toggle, scrollable
  checkbox list of contacts. The header shows "NN Selected".
  Audience defaults to the active tab (Patients or Clinicians).
- **Message Content**: textarea with a `0 / 160 characters`
  counter (matches SMS length budget), and an "Urgent" checkbox
  that decorates the resulting messages with a priority badge.

"Send Message" is disabled until at least one recipient is
selected AND content is non-empty. On send, the modal closes and
a toast confirms delivery; one conversation per recipient is
created or updated in the local store.

### US-COMM-5 — Empty + zero states
Acceptance: when no conversations exist for the active tab, the
list shows an empty card prompting the user to compose. When the
list has rows but none selected (or before the user has clicked),
the right pane shows a centered "Pick a conversation" hint with a
"Compose new" button.

---

## 6.7. Reports

### US-RPT-1 — Reports section with sidebar
**Actor**: provider, staff, or admin.
Acceptance: `/reports` is a parent route with a left sidebar
listing the available reports (today: Insights · clinical +
operational AI analytics). Hitting `/reports` redirects to
`/reports/insights`. The sidebar item highlights when active.
The existing Insights page renders inside `/reports/insights`
with no changes to its content — only its route moves. Adding
future reports means adding one sidebar entry and one nested
route.

---

## 7. Cross-cutting concerns

### US-XC-1 — Demo mode fallback
On connectivity failure (network down, server unreachable), the
api-client returns `demoFallback()` data when one is configured.
The auth store flips into demo mode so writes short-circuit to
fake responses and toasts append " (demo only)".

### US-XC-2 — Audit log on every write
All write endpoints invoke `AuditService.record_request`. Payloads
JSON-encoded via `jsonable_encoder` so JSONB stores them cleanly.
Passwords + secrets redacted (`"<rotated>"`).

### US-XC-3 — Role-based route gating
Frontend: `<AdminRoute />` for `/users`, `/users/:id`. Nav items
optionally pass `roles: ["admin"]` to hide themselves.
Backend: `require_roles(...)` decorator dependency on every write
endpoint. Admin always passes.

### US-XC-4 — Optimistic mutations
Updates and deletes patch the React Query cache immediately and
roll back on error. Each list query has a stable hash so updates
don't trigger refetch loops.

### US-XC-5 — Production build
Vite manual chunks: react-core, react-query, charts, forms, framer,
radix. Every route is React.lazy. Heaviest libraries (recharts at
~400 KB, radix at ~130 KB) load only when their pages are visited.
