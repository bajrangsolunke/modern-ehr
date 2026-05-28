"""Tests for icd_validator.validate_codes — catalog lookup, unknown
codes kept with is_validated=False, canonical descriptions overwrite
LLM's."""
from __future__ import annotations

import pytest

from app.schemas.scribe import LlmIcdSuggestion
from app.services.icd_validator import validate_codes


@pytest.mark.asyncio
async def test_known_codes_marked_validated(db_session, seeded_icd):
    suggestions = [
        LlmIcdSuggestion(
            code="R07.9",
            description="Some description the LLM made up",
            confidence=0.8,
            reasoning="x",
        ),
    ]
    out = await validate_codes(db_session, suggestions)
    assert len(out) == 1
    assert out[0].code == "R07.9"
    assert out[0].is_validated is True
    # Catalog description overrides LLM-supplied one.
    assert out[0].description == "Chest pain, unspecified"


@pytest.mark.asyncio
async def test_unknown_codes_kept_with_flag(db_session, seeded_icd):
    suggestions = [
        LlmIcdSuggestion(
            code="Z99.99",
            description="Hallucinated code",
            confidence=0.4,
            reasoning="y",
        ),
    ]
    out = await validate_codes(db_session, suggestions)
    assert len(out) == 1
    assert out[0].is_validated is False
    # LLM description preserved when not in catalog.
    assert out[0].description == "Hallucinated code"


@pytest.mark.asyncio
async def test_mixed_validation(db_session, seeded_icd):
    suggestions = [
        LlmIcdSuggestion(code="R07.9", description="x", confidence=0.9, reasoning=None),
        LlmIcdSuggestion(code="ZZZ.ZZZ", description="bogus", confidence=0.2, reasoning=None),
        LlmIcdSuggestion(code="I10", description="x", confidence=0.7, reasoning=None),
    ]
    out = await validate_codes(db_session, suggestions)
    validated = {o.code: o.is_validated for o in out}
    assert validated == {"R07.9": True, "ZZZ.ZZZ": False, "I10": True}


@pytest.mark.asyncio
async def test_empty_input_returns_empty(db_session):
    out = await validate_codes(db_session, [])
    assert out == []


@pytest.mark.asyncio
async def test_lower_case_code_normalised(db_session, seeded_icd):
    """LLMs sometimes lower-case ICDs. We normalise to upper before
    lookup so 'r07.9' still validates."""
    suggestions = [
        LlmIcdSuggestion(code="r07.9", description="x", confidence=0.5, reasoning=None),
    ]
    out = await validate_codes(db_session, suggestions)
    assert out[0].is_validated is True
    assert out[0].code == "R07.9"
