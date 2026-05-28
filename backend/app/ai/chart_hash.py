"""Deterministic hash over the patient chart snapshot.

The output is the cache key for AI insight rows. Two requirements:

  1. Same input → same output (so cache hits are reliable)
  2. Sensitive to every field that influences AI output (so the cache
     is never stale)

If a column influences the prompt but is missing here, the cache will
silently serve stale data. See `test_chart_hash.py` for the contract.
"""
from __future__ import annotations

import hashlib
from collections.abc import Iterable
from typing import Any


def _row_key(row: Any) -> str:
    """Stable string for a chart row. Uses `id` for identity and
    `updated_at` so in-place edits invalidate the cache."""
    rid = getattr(row, "id", "")
    updated = getattr(row, "updated_at", "")
    if hasattr(updated, "isoformat"):
        updated = updated.isoformat()
    return f"{rid}|{updated}"


def _rows_block(rows: Iterable[Any]) -> str:
    items = sorted(_row_key(r) for r in rows)
    return ",".join(items)


def compute_chart_hash(
    *,
    patient: Any,
    allergies: Iterable[Any],
    conditions: Iterable[Any],
    medications: Iterable[Any],
    labs: Iterable[Any],
) -> str:
    """Return a 64-char hex SHA-256 over a deterministic projection of
    the chart. Caller owns row selection (e.g., limit to 10 recent labs)."""
    parts: list[str] = []

    p_fields = (
        "id",
        "first_name",
        "last_name",
        "dob",
        "sex",
        "procedure",
        "procedure_date",
        "asa",
        "icu_needed",
    )
    for f in p_fields:
        v = getattr(patient, f, None)
        if hasattr(v, "isoformat"):
            v = v.isoformat()
        parts.append(f"{f}={v}")

    parts.append("allergies=" + _rows_block(allergies))
    parts.append("conditions=" + _rows_block(conditions))
    parts.append("medications=" + _rows_block(medications))
    parts.append("labs=" + _rows_block(labs))

    blob = "\n".join(parts).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()
