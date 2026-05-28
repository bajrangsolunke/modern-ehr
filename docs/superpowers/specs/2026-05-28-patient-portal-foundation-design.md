# Patient Portal — Foundation (Phase 1)

> **Status:** approved through brainstorming. Next: implementation plan.

## Goal

Stand up the rails for a patient-facing companion app to the existing
provider EHR. Phase 1 ships **just the foundation**: a separate
frontend bundle, a patient-only authentication system, and a single
minimal dashboard that proves the end-to-end pipe works. Feature
surfaces (appointments, messages, docs, tasks, notifications,
settings) are explicitly out of scope here — each becomes its own
spec + plan once the foundation lands.

## Scope

**In:**
- New columns on `patients` table for credentials + portal activation
- New `/api/v1/patient-auth/*` endpoints for invite-setup / login / refresh / password-reset
- New `CurrentPatient` dep that resolves a Patient from a JWT with `token_type == "patient"`
- New `/api/v1/patient-portal/me` and `/me/dashboard` endpoints
- "Invite to portal" action on the provider's patient profile (provider portal change)
- New `modern-ehr/patient-portal/` Vite app — login, setup, reset, dashboard
- Calm/health-app design system in the new app

**Out (future phases, each its own spec):**
- Appointments / Messages / Docs / Tasks / Notifications / Settings screens
- Automatic email delivery of the invite link (provider copies the URL manually for now)
- 2FA / SSO
- A shared component library across both portals — duplicate small utilities until duplication is measurable

## Architecture

Two frontends, one backend. The provider portal at `modern-ehr/frontend/`
and the new patient portal at `modern-ehr/patient-portal/` share nothing
at the code level — only the backend API contract. Each has its own
package.json, its own bundle, its own deploy.

```
modern-ehr/
├── backend/
│   └── app/
│       ├── models/patient.py             # + hashed_password, portal_active, …
│       ├── schemas/patient_auth.py       # NEW
│       ├── services/patient_auth_service.py  # NEW
│       ├── services/patient_dashboard_service.py  # NEW (composition only)
│       ├── api/v1/endpoints/patient_auth.py     # NEW
│       ├── api/v1/endpoints/patient_portal.py   # NEW
│       └── api/deps.py                  # + CurrentPatient
├── frontend/                              # provider portal (existing)
└── patient-portal/                        # NEW patient app
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── app/                           # router + providers
        ├── features/
        │   ├── auth/                      # login, setup, reset
        │   └── dashboard/                 # only Phase 1 surface
        ├── components/{ui,layout}/
        ├── lib/                           # api-client, form helpers, utils
        ├── stores/auth-store.ts
        ├── config/{constants,env}.ts
        └── styles/globals.css
```

### Token-type discrimination

JWT payload gains a `token_type` claim: `"user"` for tokens issued by
`/auth/login` (existing provider login) and `"patient"` for tokens
from `/patient-auth/login`. Both audiences sign with the same secret;
the deps layer is the single chokepoint that distinguishes them.

This means **a stolen patient token cannot access the provider
portal's endpoints**, and a stolen provider token cannot access
`/patient-portal/*`. The check happens once per request inside the
dep — every endpoint that uses `CurrentPatient` or `CurrentUser` is
covered by construction.

## Data model

One migration adds these columns to `patients`:

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `hashed_password` | `String(255)` | nullable | bcrypt hash; null until activated |
| `portal_active` | `Boolean` | not null, default `false` | login gate |
| `email_verified_at` | `DateTime(tz)` | nullable | flips when setup completes |
| `password_reset_token` | `String(128)` | nullable | one-time invite/reset token |
| `password_reset_expires` | `DateTime(tz)` | nullable | TTL (24h for setup, 1h for reset) |

`email` already exists on the row. The token column is reused for both
invites and password resets — the TTL is shorter for resets.

## Authentication flows

### Invite (provider-side)

1. Provider opens patient profile in the provider portal.
2. Clicks **"Invite to portal"** (new button — gated to provider/admin).
3. Backend `POST /patients/{id}/portal-invite`:
   - Verifies the patient has an `email`.
   - Generates a 32-byte URL-safe token, stores `hashlib.sha256(token)`
     on `password_reset_token` (we hash on disk, like real reset tokens).
   - Sets `password_reset_expires = now() + 24h`.
   - Audits `patient.invite`.
   - Returns the **un-hashed** token + the magic URL
     `{settings.PATIENT_PORTAL_URL}/setup?token={raw}` for the provider
     to copy. The base URL is read from a new `PATIENT_PORTAL_URL`
     setting (defaults to `http://localhost:5174` in development).
4. Provider shares the URL with the patient by whatever channel they
   already use (manual). Email auto-delivery is a follow-up.

### Setup (patient-side, no auth)

1. Patient opens `/setup?token=…` in the patient portal.
2. FE calls `POST /patient-auth/setup-verify` with the raw token. BE
   hashes it, looks up the patient by hash, checks expiry. Returns
   masked email + first name for confirmation.
3. Patient enters + confirms a password (min 8 chars). Client runs
   zxcvbn for a strength meter.
4. FE calls `POST /patient-auth/setup` with `{token, password}`.
   - BE re-validates the token atomically (single-use — clears it as
     part of the same transaction).
   - Sets `hashed_password` (passlib bcrypt, same work factor as users),
     `portal_active=true`, `email_verified_at=now()`.
   - Issues an access + refresh JWT with `token_type="patient"`.
   - Audits `patient.setup`.
5. FE persists tokens, redirects to dashboard.

### Login

`POST /patient-auth/login` with `{email, password}` →
`{access_token, refresh_token, expires_in}`. Rate-limited to 5
attempts per IP per minute (reuses existing slowapi). Audits
`patient.login` (success) or `patient.login_failed` (with email,
not password, for security investigation).

### Refresh

`POST /patient-auth/refresh` with `{refresh_token}`. Verifies
`token_type=="patient"` and `portal_active==true` before issuing a
new access token. Rotates refresh tokens (issues a new one, kept
14-day TTL).

### Password reset

Identical mechanism to setup but `expires=now()+1h`, and the patient
provides their email to trigger the email/URL generation. Trigger
endpoint always returns 204 regardless of whether the email matches
a row — no account enumeration. Audits `patient.password_reset`.

## API surface (Phase 1)

All routes share the `/api/v1` prefix.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/patient-auth/setup-verify` | none | check invite token, return display info |
| `POST` | `/patient-auth/setup` | none | set initial password, return tokens |
| `POST` | `/patient-auth/login` | none | email + password → tokens |
| `POST` | `/patient-auth/refresh` | refresh token | new access token |
| `POST` | `/patient-auth/request-reset` | none | start password reset |
| `POST` | `/patient-auth/reset` | none | finish password reset |
| `POST` | `/patients/{id}/portal-invite` | provider/admin | create invite token |
| `GET` | `/patient-portal/me` | patient | basic profile |
| `GET` | `/patient-portal/me/dashboard` | patient | composed dashboard payload |

`GET /me/dashboard` returns a single composed payload — keeps the
dashboard render to one round-trip:

```jsonc
{
  "greeting": { "first_name": "Henna" },
  "next_appointment": {
    "id": "...",
    "start_at": "2026-06-03T14:00:00-07:00",
    "provider_name": "Dr. Leslie Alexander",
    "specialty": "Orthopedic Surgeon",
    "location": "In-person · 123 Main St",
    "telehealth": false
  } | null,
  "pending_actions": {
    "forms_count": 1,
    "tasks_count": 0,
    "total": 1
  },
  "recent_message": {
    "conversation_id": "...",
    "sender_name": "Dr. Leslie Alexander",
    "preview": "Lab results are in — let's chat at your next visit.",
    "sent_at": "2026-05-27T14:30:00Z"
  } | null,
  "recent_documents": [
    { "id": "...", "name": "Consent form.pdf", "category": "consent", "created_at": "..." }
  ]
}
```

The service composes by calling existing patient-scoped queries:
`AppointmentService.upcoming_for_patient(id)`, `MessagesService.last_message_for_patient(id)`,
`DocsService.recent_for_patient(id, limit=3)`, etc. No new business
logic — composition only.

## Frontend scaffold

### Stack

React 19 + Vite 6 + TypeScript + Tailwind + React Query + React Router
+ Zustand + Sonner. Matches the provider portal so anyone who's worked
on one can navigate the other.

### Routing

```tsx
<Routes>
  <Route element={<PublicRoute />}>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/setup" element={<SetupPage />} />
    <Route path="/reset" element={<ResetPage />} />
  </Route>
  <Route element={<ProtectedRoute />}>
    <Route element={<Shell />}>
      <Route path="/" element={<DashboardPage />} />
    </Route>
  </Route>
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

`ProtectedRoute` reads the auth store; if no patient is loaded it
triggers `/me` to hydrate (or kicks to `/login`).

### Auth store

Mirrors the provider auth store — access token in memory + localStorage,
refresh token in localStorage, 401 → silent refresh once, then logout.
Storage keys are namespaced:

```ts
export const STORAGE_KEYS = {
  accessToken: "padmavat-portal.access_token",
  refreshToken: "padmavat-portal.refresh_token",
} as const;
```

This lets both portals run side-by-side on localhost without
colliding cookies / localStorage.

### Dev experience

- `cd patient-portal && npm install && npm run dev` → boots on port 5174
- Provider portal still on 5173
- Both proxy `/api` → `:8000`
- Backend CORS regex already accepts any localhost port; no change

## Design system

| Token | Value | Used for |
|-------|-------|----------|
| `--bg` | `#F8FAF7` | page background |
| `--surface` | `#FFFFFF` | cards |
| `--text` | `#0F1F1A` | body |
| `--text-muted` | `#5C6F66` | secondary text |
| `--primary` | `#0E8A6C` | primary CTAs, links |
| `--primary-soft` | `#E8F5EF` | primary backgrounds, badges |
| `--accent` | `#B4D7C7` | decorative |
| `--danger` | `#D04848` | destructive / urgent only |
| `--warning` | `#E0A536` | due dates, "needs your action" |
| `--border` | `#E5EDE8` | hairlines |
| `--radius-card` | `20px` | cards |
| `--radius-pill` | `999px` | pills, buttons |

**Typography.** Inter at base 16px (not 14px). H1 28px, H2 22px,
H3 17px. Tabular-nums for times / numbers.

**Layout.** Card padding 24px, section spacing 32px, max one primary
button per screen. Cards live in a max-720px column centered on
desktop, full-width on mobile. Button height 44px (`h-11`) — slightly
larger than the provider portal — easier on mobile + accessible.

**Voice.** Status reads as words ("Scheduled for Monday"), not enums.
Dates are relative when close ("Tomorrow at 9:30 AM"), absolute when
far. Greeting line is time-aware. Empty states use a soft
illustration + one warm line.

## Dashboard content (Phase 1)

Vertical card stack on the dashboard. Each card is independent — if
the data isn't there, the card doesn't render.

1. **Greeting** — `Good {morning/afternoon/evening}, {first_name}`,
   no CTA, sets tone.
2. **Next appointment** — date/time human, provider + specialty,
   location, primary CTA **View details** (opens an in-page modal
   for Phase 1; deep-links to appointments page in Phase 2).
3. **Action** — "You have N things to do" — sum of `forms_count +
   tasks_count` from the dashboard payload. CTA toasts "Coming soon"
   in Phase 1 (deep-link in Phase 2). Zero state becomes a green
   "You're all caught up" with a checkmark.
4. **Recent message preview** — sender + 1-line preview + relative
   time. CTA "Open message" toasts "Coming soon" in Phase 1.
5. **Recent documents** — last 1–3 documents shared with the patient,
   title + category badge + date. CTA "View" toasts "Coming soon" in
   Phase 1.

Powered by the single `GET /me/dashboard` payload.

## Error handling

- Auth endpoints rate-limit by IP via existing slowapi setup.
- Wrong token type (`token_type != "patient"` for a patient endpoint)
  → `401 Invalid token`.
- Inactive portal account → `401 Inactive portal account`.
- Wrong password / unknown email → generic `401 Invalid credentials`
  (no enumeration).
- Setup/reset token expired or already used → `400 Token expired or
  already used`.
- Network failures on the FE follow the existing api-client pattern
  with the toast + retry pattern from the provider portal.

## Security

- bcrypt password hashing (passlib, work factor matches users)
- Setup/reset tokens are 32-byte URL-safe random, stored as
  `hashlib.sha256(token).hexdigest()` on disk (token leak from a DB
  dump is useless)
- Single-use tokens — cleared atomically as part of consumption
- Rate-limit `/patient-auth/login` to 5/min per IP
- Audit-log every auth event via `AuditService`
  (`patient.invite`, `patient.setup`, `patient.login`,
  `patient.login_failed`, `patient.password_reset`)
- `token_type` claim verified in the dep, not just at JWT decode
- HTTPS-only in production (existing nginx terminates TLS)

## Testing strategy

- Backend: pytest covers each new endpoint — happy path + at least one
  failure mode per endpoint (expired token, wrong password, wrong
  token type, etc.).
- Frontend: minimal component tests for `LoginPage` and `SetupPage`
  (form validation, error toasts). Dashboard tested via API contract
  + manual smoke for Phase 1.
- E2E: a single Playwright happy-path script — provider invites,
  patient sets password, patient logs in and sees the dashboard.

## Open questions deferred to follow-ups

- Email delivery service (SES vs SendGrid vs Mailgun) — out of scope
  this phase, providers copy the URL manually.
- 2FA — defer until we know whether HIPAA requirements push toward it.
- Mobile app (React Native) — defer until web portal usage tells us
  it's needed.
- Shared component library — defer until duplication is measurable.

## Acceptance

Phase 1 is done when:

1. A provider can click "Invite to portal" on a patient profile and
   receive a magic URL.
2. The patient can open that URL, set a password, and land on the
   dashboard in one flow.
3. Returning patients can log in with email + password.
4. The dashboard shows greeting + next appointment + pending actions
   + recent message + recent documents, all from one `/me/dashboard`
   call.
5. The patient portal runs on port 5174 alongside the provider portal
   on 5173.
6. No staff token can access a `/patient-portal/*` endpoint, and no
   patient token can access a `/users/*` or other staff endpoint.

Phase 2 picks up appointments, messages, docs, tasks, notifications,
settings — each as its own spec.
