"""Field-level encryption for PII (SSN, tax IDs).

Uses Fernet (AES-128-CBC + HMAC-SHA256) with a key from
`settings.FIELD_ENCRYPTION_KEY`. Stored values are bytes (bytea in
Postgres). Plaintext NEVER hits the database column.

KEY ROTATION (out of scope here): when the time comes, support multi-key
Fernet (MultiFernet) so old ciphertext stays decryptable while new
writes use the rotated key.
"""
from __future__ import annotations

import base64
import sys

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

# Module-level latch so the dev fallback warning is emitted exactly
# once per process, not on every encrypt/decrypt call.
_FALLBACK_WARNED = False


def _fernet() -> Fernet:
    """Resolve the Fernet key. Accepts either a base64-urlsafe 32-byte
    key (Fernet native) or a raw string >=32 chars (derived via
    base64-encoding the SECRET_KEY slice for dev convenience)."""
    global _FALLBACK_WARNED
    raw = settings.FIELD_ENCRYPTION_KEY
    if not raw:
        # Dev fallback: derive from SECRET_KEY so the app boots without
        # an extra env var. PROD must set FIELD_ENCRYPTION_KEY to a
        # Fernet-generated key (see scripts/gen_fernet_key.py-style
        # one-liner: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())").
        if not _FALLBACK_WARNED:
            print(
                "WARNING: FIELD_ENCRYPTION_KEY is unset — deriving a fallback "
                "key from SECRET_KEY. Acceptable for development only. "
                "Generate a real key for production with: python -c "
                "\"from cryptography.fernet import Fernet; "
                "print(Fernet.generate_key().decode())\"",
                file=sys.stderr,
            )
            _FALLBACK_WARNED = True
        raw = base64.urlsafe_b64encode(
            settings.SECRET_KEY.encode("utf-8").ljust(32, b"\0")[:32]
        ).decode("ascii")
    try:
        return Fernet(raw.encode("ascii") if isinstance(raw, str) else raw)
    except (ValueError, TypeError) as exc:
        raise RuntimeError(
            "FIELD_ENCRYPTION_KEY is not a valid Fernet key. "
            "Generate one with: python -c "
            "'from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())'"
        ) from exc


def encrypt_field(plaintext: str | None) -> bytes | None:
    """Encrypt a string for storage. Returns None for None/empty input."""
    if not plaintext:
        return None
    return _fernet().encrypt(plaintext.encode("utf-8"))


def decrypt_field(ciphertext: bytes | None) -> str | None:
    """Decrypt to string. Returns None for None input. Raises if the
    ciphertext was written with a different key (likely key rotation
    bug — fail loud rather than silently mask)."""
    if ciphertext is None:
        return None
    try:
        return _fernet().decrypt(bytes(ciphertext)).decode("utf-8")
    except InvalidToken as exc:
        raise RuntimeError(
            "Could not decrypt field — wrong key or corrupted ciphertext"
        ) from exc


def mask_last4(plaintext: str | None) -> str | None:
    """Return e.g. '***-**-1234' from a 9-digit SSN, or just the last
    four for anything else. None-safe."""
    if not plaintext:
        return None
    digits = "".join(c for c in plaintext if c.isdigit())
    if len(digits) < 4:
        return "****"
    return f"***-**-{digits[-4:]}" if len(digits) == 9 else f"****{digits[-4:]}"
