"""Transactional-email service. Sends via aiosmtplib when SMTP_HOST is
configured; otherwise LOGS the email body via structlog so dev + CI work
without any real SMTP setup.

Production-safe: HIPAA-covered providers (AWS SES with BAA, Postmark
transactional, SendGrid Pro, Mailgun HIPAA) all speak the same SMTP
protocol — point at their host:port:user:password and you're done.
Direct SDK integrations are intentionally avoided to keep the deps
small and the deployment story portable."""
from __future__ import annotations

from email.message import EmailMessage
from typing import Sequence

import aiosmtplib

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger(__name__)


def _is_configured() -> bool:
    """SMTP is considered live iff SMTP_HOST is non-empty. SMTP_USER /
    SMTP_PASSWORD may be empty (e.g. mailpit in dev has no auth) — we
    only require the host."""
    return bool((settings.SMTP_HOST or "").strip())


async def send_email(
    *,
    to: str | Sequence[str],
    subject: str,
    html: str,
    text: str,
) -> bool:
    """Send a transactional email. Returns True if sent (or queued via
    SMTP), False if SMTP isn't configured (logged-only path).

    Caller should typically dispatch this as a FastAPI BackgroundTask
    so the HTTP response doesn't wait on SMTP."""
    to_list = [to] if isinstance(to, str) else list(to)
    if not to_list:
        log.warning("email_skipped_no_recipient", subject=subject)
        return False

    if not _is_configured():
        log.info(
            "email_logged_only",
            to=to_list,
            subject=subject,
            text=text[:500],
            note="SMTP_HOST is unset; configure to actually send.",
        )
        return False

    msg = EmailMessage()
    from_name = settings.SMTP_FROM_NAME or "Modern EHR"
    from_email = settings.SMTP_FROM_EMAIL or "no-reply@modern-ehr.health"
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = ", ".join(to_list)
    msg["Subject"] = subject
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER or None,
            password=settings.SMTP_PASSWORD or None,
            start_tls=settings.SMTP_USE_TLS,
        )
        log.info("email_sent", to=to_list, subject=subject)
        return True
    except Exception as exc:  # pragma: no cover — network-bound
        log.error("email_send_failed", to=to_list, subject=subject, error=str(exc))
        return False
