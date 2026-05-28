"""Unit tests for compute_chart_hash — the cache key for AI insights.

The hash must be:
1. Stable across runs for identical input (deterministic)
2. Stable across insertion order (sorted internally)
3. Sensitive to every field we care about (mutating any tracked field
   must change the hash, or the cache will serve stale data silently)
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import uuid4

import pytest

from app.ai.chart_hash import compute_chart_hash


def _patient(**overrides):
    """Minimal patient-like object — uses a SimpleNamespace so we don't
    need a real SQLAlchemy session to test the hash function."""
    from types import SimpleNamespace

    base = dict(
        id=uuid4(),
        first_name="Jane",
        last_name="Doe",
        dob=date(1960, 1, 1),
        sex="F",
        procedure="hip replacement",
        procedure_date=date(2026, 6, 1),
        asa="II",
        icu_needed=False,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def _row(id_=None, updated_at=None, **rest):
    from types import SimpleNamespace

    return SimpleNamespace(
        id=id_ or uuid4(),
        updated_at=updated_at or datetime(2026, 5, 1, tzinfo=timezone.utc),
        **rest,
    )


def test_hash_is_deterministic():
    p = _patient()
    h1 = compute_chart_hash(patient=p, allergies=[], conditions=[], medications=[], labs=[])
    h2 = compute_chart_hash(patient=p, allergies=[], conditions=[], medications=[], labs=[])
    assert h1 == h2
    assert len(h1) == 64  # SHA-256 hex


def test_hash_ignores_input_ordering():
    p = _patient()
    a1, a2 = _row(), _row()
    h_a = compute_chart_hash(
        patient=p, allergies=[a1, a2], conditions=[], medications=[], labs=[]
    )
    h_b = compute_chart_hash(
        patient=p, allergies=[a2, a1], conditions=[], medications=[], labs=[]
    )
    assert h_a == h_b


def test_hash_changes_when_patient_field_changes():
    base = _patient()
    h_base = compute_chart_hash(patient=base, allergies=[], conditions=[], medications=[], labs=[])

    for field, mutated in [
        ("first_name", "Jenna"),
        ("dob", date(1961, 1, 1)),
        ("asa", "IV"),
        ("icu_needed", True),
        ("procedure", "knee replacement"),
        ("procedure_date", date(2026, 7, 1)),
    ]:
        p = _patient(**{field: mutated})
        h = compute_chart_hash(patient=p, allergies=[], conditions=[], medications=[], labs=[])
        assert h != h_base, f"hash did not change when {field} changed"


def test_hash_changes_when_allergy_updated_at_changes():
    p = _patient()
    a = _row()
    h1 = compute_chart_hash(patient=p, allergies=[a], conditions=[], medications=[], labs=[])
    a.updated_at = datetime(2026, 5, 2, tzinfo=timezone.utc)
    h2 = compute_chart_hash(patient=p, allergies=[a], conditions=[], medications=[], labs=[])
    assert h1 != h2


def test_hash_changes_when_medication_added():
    p = _patient()
    h_empty = compute_chart_hash(patient=p, allergies=[], conditions=[], medications=[], labs=[])
    h_one = compute_chart_hash(patient=p, allergies=[], conditions=[], medications=[_row()], labs=[])
    assert h_empty != h_one
