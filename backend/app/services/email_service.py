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
    """SMTP is considered live iff SMTP_HOST is non-empty AND
    EMAIL_DISABLED is not set. SMTP_USER / SMTP_PASSWORD may be empty
    (e.g. mailpit in dev has no auth) — we only require the host.

    EMAIL_DISABLED is a kill-switch — set it in .env to keep SMTP
    credentials but skip actual sends (tests, demo days where you
    don't want to spam real inboxes, etc.).
    """
    if getattr(settings, "EMAIL_DISABLED", False):
        return False
    return bool((settings.SMTP_HOST or "").strip())


# Domains that are reserved for examples/tests per RFC 2606 + common
# placeholders. Sending to these from a real SMTP guarantees a bounce,
# so we short-circuit to a log + return False.
_BOUNCE_GUARANTEED_DOMAINS = {
    "example.com",
    "example.org",
    "example.net",
    "test.example",
    "invalid",
    "localhost",
    "test",
}


def _is_bounce_guaranteed(addr: str) -> bool:
    """True if `addr`'s domain is reserved for examples — Gmail / SES
    will accept the message and then bounce it back to the FROM address,
    which is how the user ended up with hundreds of NXDOMAIN replies
    in their personal inbox. Catch those at the application layer."""
    try:
        domain = addr.split("@", 1)[1].lower().strip()
    except IndexError:
        return True
    return domain in _BOUNCE_GUARANTEED_DOMAINS or domain.endswith(".test")


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

    # Drop recipients whose domain is RFC-reserved or a known test
    # placeholder. If we don't filter them, real SMTP providers accept
    # the message and then bounce it back to the FROM address — flooding
    # the sender's inbox with NXDOMAIN replies. Better to skip + log.
    bounce_targets = [a for a in to_list if _is_bounce_guaranteed(a)]
    if bounce_targets:
        log.warning(
            "email_skipped_bounce_guaranteed_domain",
            to=bounce_targets,
            subject=subject,
            note="RFC-reserved or test placeholder domain — would bounce.",
        )
        to_list = [a for a in to_list if not _is_bounce_guaranteed(a)]
        if not to_list:
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
