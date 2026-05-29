"""Thin Stripe wrapper.

The Stripe Python SDK is synchronous; we run each call inside
`asyncio.to_thread` so the event loop stays responsive. The wrapper
centralises:

  - API key configuration (single source of truth)
  - Idempotency keys (so retries can never spawn duplicates)
  - Webhook signature verification

Service code never imports `stripe` directly — that way swapping
providers later is one file, and tests can monkeypatch THIS module
instead of the SDK."""
from __future__ import annotations

import asyncio
from typing import Any

import stripe

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger(__name__)


def _configured() -> bool:
    """True iff a Stripe secret key is set. Used by callers to gate
    Stripe-dependent flows in dev where the key is blank."""
    return bool(settings.STRIPE_SECRET_KEY)


def _client() -> Any:
    """Lazily set the SDK's module-level API key and hand the
    `stripe` module back. The SDK is configured via module globals;
    we still wrap it so the import-and-config concern lives in one
    place."""
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
    """Return a Stripe Customer id for this patient.

    Idempotency key is `customer:{patient_id}`, so a retry never
    spawns a duplicate Customer even if the caller crashed between
    the API call and persisting the id."""
    if existing_customer_id:
        return existing_customer_id

    _client()

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
    """Create a PaymentIntent for an invoice balance.

    The browser collects the card via Stripe Elements and confirms
    with the returned `client_secret`. The webhook is the source of
    truth for the final payment row — this just opens the intent.

    Idempotency key is `pi:{invoice_id}` so a retry on the SAME
    invoice returns the SAME PaymentIntent (Stripe enforces this).
    Once an invoice is paid and the patient pays a new one, the new
    invoice gets its own intent."""
    _client()

    def _create() -> dict:
        pi = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency="usd",
            customer=customer_id,
            description=description,
            payment_method_types=["card"],
            metadata={"invoice_id": invoice_id},
            idempotency_key=f"pi:{invoice_id}",
        )
        return {
            "id": pi.id,
            "client_secret": pi.client_secret,
            "status": pi.status,
        }

    return await asyncio.to_thread(_create)


def verify_webhook(payload: bytes, signature: str) -> Any:
    """Verify the Stripe-Signature header against the raw payload and
    return the parsed Stripe Event object. Raises
    `stripe.error.SignatureVerificationError` on tampering or
    `ValueError` on malformed JSON."""
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise RuntimeError("STRIPE_WEBHOOK_SECRET is not configured")
    return stripe.Webhook.construct_event(
        payload, signature, settings.STRIPE_WEBHOOK_SECRET
    )
