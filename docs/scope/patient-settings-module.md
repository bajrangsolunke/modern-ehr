# Patient Portal — Settings Module User Stories

Scope for making the Settings page fully functional. Insurance card is
intentionally read-only (display-only) per current product decision.

> **Status:** Epics 1–5 shipped. Migration `0029_patient_extended_profile`
> adds the demographic, address, emergency-contact, and preferences
> columns. Run `alembic upgrade head` after pulling.

---

## Epic 1 — Profile

### US-1.1 — Edit profile
**As** a patient
**I want to** update my name, email, phone, date of birth, demographics,
mailing + physical address, and emergency contact from the Settings page
**So that** my record stays current without calling the office

- Form sections: Personal, Contact, Mailing address, Physical address, Emergency contact
- "Same as mailing" checkbox skips the physical-address form when on
- Save updates the auth store + invalidates `/patient-portal/me` query
- Errors: surface validation messages inline; toast on network failure
- Empty email/phone allowed (nullable in DB)
- Email change does NOT change the login email until the next sign-in
  cycle (durable identifier)

**Endpoint:** `PATCH /patient-portal/me`
**Schema columns added (migration 0029):**
`blood_group`, `gender_identity`, `preferred_pronouns`,
`mailing_*` (6 cols), `physical_same_as_mailing`, `physical_*` (6 cols),
`emergency_contact_name`, `emergency_contact_phone`, `emergency_contact_relationship`.
**Acceptance:** values render immediately after save; refresh persists; toast confirms; profile-details rows show real values when present, italic "Not on file" otherwise.

### US-1.2 — Upload profile photo
**As** a patient
**I want to** upload a photo of myself
**So that** my care team can recognize me at a glance

- File picker, accepts `image/png, image/jpeg, image/webp`
- Max upload size 2 MB; oversize → inline error
- Stored as a data URL in `patients.avatar_url` (simplest path; matches
  existing pattern on User model)
- Preview rendered immediately on success; old avatar replaced
- Removing the photo clears `avatar_url`

**Endpoint:** `POST /patient-portal/me/avatar`
**Acceptance:** new photo shows in Settings, Topbar, and every provider-visible avatar within one re-fetch.

### US-1.3 — Download medical summary
**As** a patient
**I want to** download a summary of my medical record
**So that** I can share it with a specialist or keep an offline copy

- Triggers server-side text generation; downloads as `medical-summary-<MRN>.txt`
- Includes: demographics, allergies, active conditions, medications,
  5 most recent vitals, 5 next upcoming appointments
- Plain text avoids a PDF dependency (HTML/PDF can be a follow-up)
- Browser handles the Save dialog natively via `Content-Disposition: attachment`

**Endpoint:** `GET /patient-portal/me/medical-summary`
**Acceptance:** click "Medical summary" → file downloads with the patient's MRN in the filename; the content lists every section even when empty (`(none on file)`).

---

## Epic 2 — Session & Security

### US-2.1 — Change password
**As** a patient
**I want to** change my password
**So that** I can rotate it on a schedule or after suspecting a leak

- Inputs: current password, new password (min 8), confirm new password
- Validates new ≠ current; new == confirm
- Wrong current → 401 inline error, no other tokens revoked yet
- On success: success toast, modal closes, existing tokens stay valid
  (deferred: token revocation across devices)

**Endpoint:** `POST /patient-portal/me/password`
**Acceptance:** wrong current password is rejected with a clear message; correct flow succeeds with a green toast.

### US-2.2 — Enable two-factor authentication
**As** a patient
**I want to** enable 2FA on my account
**So that** a stolen password isn't enough to sign in

- v1: stubbed toast "Two-factor authentication coming soon"
- Future: TOTP enrollment QR + recovery codes

**Endpoint (future):** `POST /patient-portal/me/2fa/enroll`, `POST /patient-portal/me/2fa/verify`
**Acceptance for v1:** Enable button → "coming soon" toast.

### US-2.3 — Manage active sessions
**As** a patient
**I want to** see what devices are signed into my account and revoke any I don't recognize
**So that** I can lock out a stolen device

- v1: stubbed toast
- Future: list of `(device, last_seen, ip)`, "Revoke" per row

**Endpoint (future):** `GET /patient-portal/me/sessions`, `DELETE /patient-portal/me/sessions/{id}`
**Acceptance for v1:** Manage button → "coming soon" toast.

### US-2.4 — Sign out
**As** a patient
**I want to** sign out from any device
**So that** the session ends and nobody else can see my data

- Already wired through `useAuthStore.logout()`
- Clears tokens, redirects to /login

**Acceptance:** clicking Sign out lands on the login screen.

---

## Epic 3 — Notification Preferences

### US-3.1 — Toggle reminder & alert channels
**As** a patient
**I want to** choose which notifications I receive and on which channel
**So that** I'm not over-notified

- Four toggles:
  - Appointment reminders (default: on)
  - SMS alerts (default: on)
  - Email notifications (default: on)
  - Lab result alerts (default: on)
- Persisted server-side in `patients.preferences->'notifications'` JSON
- Optimistic UI via React Query: toast on success, error toast + revert on failure
- Future: notification engine reads these flags before queuing an SMS / email

**Endpoints:** `GET /patient-portal/me/preferences`, `PUT /patient-portal/me/preferences`
**Acceptance:** toggles persist across refresh and across devices; toast confirms each change.

---

## Epic 4 — Healthcare Preferences

### US-4.1 — Set preferred pharmacy
**As** a patient
**I want to** set my preferred pharmacy
**So that** my provider sends prescriptions to the right place

- v1: prompt-style input, persisted in `patients.preferences->'healthcare'->>'pharmacy'`
- Future: pharmacy directory autocomplete with NCPDP lookup

**Endpoint:** `PUT /patient-portal/me/preferences { healthcare: { pharmacy } }`
**Acceptance:** value persists across refresh and devices; toast confirms.

### US-4.2 — Set preferred language
**As** a patient
**I want to** select the language my care team should use
**So that** I understand instructions correctly

- Cycle-through select (English, Spanish, French, Hindi, Mandarin, Other)
- Stored in `patients.preferences->'healthcare'->>'language'`

**Acceptance:** selection persists across refresh and devices; toast confirms.

### US-4.3 — Set communication channel
**As** a patient
**I want to** choose how the office should contact me
**So that** important updates reach me

- Cycle-through select (Email, SMS, Phone, Email + SMS)
- Stored in `patients.preferences->'healthcare'->>'comm_channel'`

**Acceptance:** selection persists across refresh and devices; toast confirms.

### US-4.4 — Accessibility settings
**As** a patient
**I want to** adjust contrast and font size
**So that** the interface is comfortable to use

- v1: stubbed "coming soon" toast
- Future: high-contrast mode + font-scale toggle stored client-side

**Acceptance for v1:** Edit button → "coming soon" toast.

---

## Epic 5 — AI Health Summary

### US-5.1 — Personalised health summary card
**As** a patient
**I want to** see a short, AI-generated overview of my current health on Settings
**So that** I get a quick read on what's stable, what's drifting, and what's next

- Server generates a deterministic summary from:
  recent vitals count, active conditions, and the next upcoming visit
- Returns: `summary` (1 paragraph), `bullets` (2–3 supporting facts),
  `confidence` (0–100), `generated_at`
- FE shows the paragraph + confidence pill; "View full report" toggles the bullets
- Network errors render an inline Retry link
- v2: swap the deterministic builder for an LLM call against the patient's chart (RagService already exists)

**Endpoint:** `GET /patient-portal/me/ai-summary`
**Acceptance:** card renders summary on load; confidence badge visible; expanding shows bullets; retry recovers from a transient failure.

---

## Epic 6 — Connected Devices (deferred — see analysis below)

### US-6.1 — Connect / Manage Apple Watch
- v1: Connect + Manage → "coming soon" toast
- Future: see "Connected devices — Apple Watch integration analysis"
  section at the bottom of this doc

**Acceptance for v1:** both buttons → "coming soon" toast.

---

## Out of scope (v1)

- Insurance card editing (display-only)
- Email change validation flow
- Multi-device session listing
- Wearable OAuth flows
- Backend-synced notification/healthcare prefs (localStorage only)

## Definition of done

- All in-scope endpoints exist and return `200/204` on the happy path
- Each in-scope flow has an inline error path AND a success toast
- All "coming soon" stubs show a consistent toast, not silent failure
- Frontend typechecks; backend Python parses
- New endpoints are exercised at least once by manual smoke (or a test)

---

## Connected devices — Apple Watch integration analysis

### Can we integrate Apple Watch? Yes — with caveats.

The Watch itself can't talk to a backend directly; it pipes its readings
into **Apple Health** on the paired iPhone. Two technical paths exist:

| Path | What it is | What we get | Effort |
|------|------------|-------------|--------|
| **A. iOS companion app + HealthKit** | A small iOS app the patient installs; uses HealthKit framework to read selected vitals and POSTs them to our `/patient-portal/me/vitals` endpoint | Real-time-ish push of HR, HRV, BP (via cuff sync), oxygen, sleep, steps, ECG events | High (~6–8 weeks: iOS app, App Store review, BAA for HealthKit, secure background sync) |
| **B. Apple Health Records export (FHIR)** | Patient manually exports a CDA/FHIR bundle from the Health app and uploads via the existing Docs flow | Snapshot only — no live data, no push | Low (~1 week — reuse existing upload + add FHIR parser) |

There's no path that talks to an Apple Watch over the open web — the
Health Sharing API + the in-progress "Health on the Web" features are
phone-to-phone, not server-side.

### Recommended use cases (B2C clinical value)

The features that move the needle for our EHR:

1. **Pre-visit context for providers.** Provider opens an appointment;
   sidebar shows the last 7 days of HR / sleep / activity from the
   patient's Watch. They walk in already knowing whether the patient's
   resting HR climbed. ✅ Distinctive vs. legacy EHRs.

2. **Risk-flag triggers.** Watch fires an irregular-rhythm event →
   our `notifications_service` queues a "review AFib alert" task for
   the provider, and an SMS to the patient if they opted in.

3. **Adherence + recovery monitoring.** Post-surgery patients on the
   `procedure_date` track — surface their step count + sleep score in
   the patient's chart so the care team can see recovery curves
   without scheduling a call.

4. **Auto-populated vitals at check-in.** When a patient checks into a
   visit, the Watch's last reading auto-fills the vitals form. Saves
   the medical assistant ~90 seconds per visit.

5. **AI summary lift.** The Settings AI summary card already exists —
   feed it Watch-derived vitals + sleep + activity, and the bullets
   become qualitatively better ("Your resting HR dropped 6 bpm after
   the meds adjustment 3 weeks ago").

### Suggested rollout (3 phases)

- **Phase 1 (1 sprint)** — Path B: accept manual FHIR export upload.
  Zero device-vendor lock-in, immediate value for tech-savvy patients.
- **Phase 2 (2 sprints)** — Companion iOS app with HealthKit read
  scopes for HR, HRV, BP, SpO₂, sleep. Background-sync to a new
  `wearable_readings` table; map to the existing `vital_signs` schema
  so the dashboard "just works".
- **Phase 3 (1 sprint)** — Risk-flag triggers for AFib + falls,
  routed through the existing tasks / notifications fan-out.

### Compliance / privacy gates (must clear before Phase 2)

- HealthKit data is **PHI**; requires BAA with Apple is *not* needed
  (HealthKit lives client-side until your app uploads), but the upload
  pipe needs end-to-end TLS, at-rest encryption, and patient consent
  recorded in the existing `consents` table.
- Apple requires explicit per-data-type permission UI; we cannot bulk
  request scopes.
- App Review tightens scrutiny for health apps; expect a 2-3 week
  review delay on the iOS app launch.

### Why NOT to integrate (push-back)

- Skews coverage to iOS users — Android patients see a feature gap.
- iOS app is non-trivial maintenance burden vs. our current web-only
  stack; ~1 engineer-month/year of upkeep.
- For most clinical workflows, Watch data is *nice-to-have*, not
  required — the chart's still complete without it.

### Recommendation

Do **Phase 1 first** (FHIR upload — small, dependency-free win), then
gauge usage. Only commit to Phase 2 if ≥10% of patients have uploaded
their Health export at least once in the first 90 days — that's the
signal that the build cost will pay back.
