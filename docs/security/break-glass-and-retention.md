# Break-glass access + audit-log retention

Two policy items the production-readiness report (§7 item #19, #20)
flagged as missing documentation. Both are policy + procedure rather
than code, but they need to live in the repo so the audit reviewer
can find them.

---

## 1. Emergency-access procedure (break-glass)

**Purpose.** HIPAA §164.312(a)(2)(ii) requires that a covered entity
have an emergency-access procedure for retrieving PHI in
exceptional circumstances (e.g. a coding clinician needs a chart
the assigning provider isn't on, or a security incident requires
investigation).

**Principle.** Break-glass should be *enabled, not unrestricted*.
Every break-glass action must be:

  1. Logged with a flag distinguishing it from routine access.
  2. Reviewable by a second admin within 24 hours.
  3. Time-limited — access expires automatically.

### Current technical state

  - **Admin role** has unrestricted read across `/patients`,
    `/tasks`, `/users`. This is the de-facto break-glass channel
    today.
  - Every PHI mutation flows through `AuditService.record_request`
    (78 call sites) which captures `user_id`, `action`,
    `resource_type`, `resource_id`, `ip_address`, `user_agent`,
    `timestamp`.
  - PHI **reads** are not yet audited at request granularity (see
    report item #11).

### Required policy (sign on prod cutover)

  1. **Designated break-glass accounts** are NOT shared. Each admin
     who needs emergency access has their own admin account.
  2. **Use of admin override** must be accompanied by a Slack post in
     `#sec-break-glass` describing the patient ID, the reason, and
     the expected duration. The post is the human-side audit
     companion to the system log.
  3. **Daily review.** A second admin (rotating weekly) reviews the
     prior 24h of admin-role access to PHI charts they don't own.
     Any unexplained access is flagged in `#sec-break-glass` within
     2 business hours.
  4. **Annual training.** Every admin signs a break-glass
     acknowledgement annually. Stored in the HR compliance folder.
  5. **Revocation.** Admin role is revoked immediately on
     termination. Refresh tokens for the user are invalidated as
     part of off-boarding (once revocation list lands — report
     item #3).

### Engineering follow-ups

  - **`access_kind` audit column.** Add an enum field
    (`routine | break_glass`) to `audit_logs` so the daily review
    query can filter cheaply. (~30 min once the schema is open.)
  - **PHI read audit middleware.** Single middleware that records a
    row to `audit_logs` for every GET on `/patients/{id}`,
    `/patients/{id}/...`, `/documents/{id}/download`,
    `/encounters/{id}`, etc. (Report item #11; ~2-3 h.)

---

## 2. Audit-log retention

**Purpose.** HIPAA §164.316(b)(2)(i) requires policies/procedures
related to PHI handling be retained for **6 years**. The audit log
itself is the primary record of who-touched-what; OCR enforcement
actions routinely require multi-year audit history during
investigations.

### Policy

| Record class | Retention | Where |
|---|---|---|
| `audit_logs` table (all rows) | **7 years** rolling | Postgres primary; daily snapshot to immutable storage |
| Immutable archive copy | **7 years** | S3 Object Lock (Governance mode) or equivalent |
| Application logs (structlog JSON) | **90 days** hot · **2 years** archived | CloudWatch / Datadog → S3 |
| `messages.body` (patient ↔ care team) | Lifetime of the patient relationship + 7 years | Postgres |
| `documents.content` (uploaded files) | Same as messages | Postgres / object storage |
| Backup snapshots (Postgres) | **35 days** rolling | Managed-DB snapshots |
| WS session events | **30 days** | Application logs |
| LLM prompt/response pairs (if cached) | **7 days** then purged | Redis with TTL |

### Engineering tasks to enforce

  1. **Snapshot job.** Nightly pg_dump → S3 with Object Lock.
  2. **Pruning.** No automatic deletion of `audit_logs` rows until
     after the 7-year window. A scheduled job verifies retention
     and warns 90 days before any row would expire (so we don't
     accidentally lose data to a misconfigured policy).
  3. **Tamper detection.** Add a daily checksum of the prior day's
     `audit_logs` rows; store the checksum in a separate signed
     table and on the immutable S3 copy. Mismatch alerts the
     security on-call.
  4. **Right to erasure.** When a patient requests data deletion
     (state law where applicable — note HIPAA's TPO carve-out),
     scrub PHI from operational tables but preserve a *hash* of
     the original record in `audit_logs` so the retention
     timeline isn't broken.

### Operational tasks (ops / DevOps)

  1. Enable Postgres logical replication or PITR with a 35-day
     window on the managed DB instance.
  2. S3 Object Lock bucket provisioned with **Governance** retention
     of 7 years on every uploaded snapshot.
  3. Quarterly **restore drill**: pull a random snapshot, restore
     to a temp DB, validate row counts in `audit_logs` match the
     snapshot manifest.

---

## Sign-off

This document is policy + procedure that must be reviewed and
re-signed at each ENVIRONMENT=production cutover and at least
annually thereafter. The signed copy lives in the compliance folder
outside the repo; this markdown is the canonical engineering view.

| Version | Date | Author | Notes |
|---|---|---|---|
| 0.1 | 2026-05-28 | Engineering | Initial draft accompanying production-readiness report |
