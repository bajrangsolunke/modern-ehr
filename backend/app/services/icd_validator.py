"""Validate LLM-suggested ICD-10 codes against the local CMS catalog.

Unknown codes are KEPT (not dropped) — we surface them with
is_validated=false so the UI can show a warning. The trust story is
"we show you what the AI proposed AND which codes passed catalog
validation."
"""
from __future__ import annotations

from collections.abc import Iterable, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.icd_catalog import IcdCatalog
from app.schemas.scribe import LlmIcdSuggestion


class ValidatedIcd:
    """Plain-old container — the persistence layer reads these fields
    when writing ScribeIcdSuggestion rows."""

    __slots__ = ("code", "description", "confidence", "reasoning", "is_validated")

    def __init__(
        self,
        *,
        code: str,
        description: str,
        confidence: float,
        reasoning: str | None,
        is_validated: bool,
    ) -> None:
        self.code = code
        self.description = description
        self.confidence = confidence
        self.reasoning = reasoning
        self.is_validated = is_validated


async def validate_codes(
    db: AsyncSession, suggestions: Iterable[LlmIcdSuggestion]
) -> list[ValidatedIcd]:
    """For each LLM suggestion, look up the code in icd_catalog. If
    found, mark validated and replace the description with the canonical
    short_description from the catalog (the LLM occasionally invents
    descriptions even for real codes). If not found, keep the LLM's
    description and mark is_validated=False."""
    items = list(suggestions)
    if not items:
        return []

    # Normalise the codes for lookup (strip whitespace, upper-case the
    # letter portion). ICD-10-CM codes are case-sensitive in spec but
    # we tolerate the LLM lower-casing them.
    codes_lookup: list[str] = [s.code.strip().upper() for s in items]
    rows = (
        await db.execute(
            select(IcdCatalog).where(IcdCatalog.code.in_(codes_lookup))
        )
    ).scalars().all()
    by_code = {r.code: r for r in rows}

    out: list[ValidatedIcd] = []
    for original, normalised in zip(items, codes_lookup):
        cat = by_code.get(normalised)
        if cat is not None:
            out.append(
                ValidatedIcd(
                    code=normalised,
                    description=cat.short_description,
                    confidence=original.confidence,
                    reasoning=original.reasoning,
                    is_validated=True,
                )
            )
        else:
            out.append(
                ValidatedIcd(
                    code=normalised,
                    description=original.description,
                    confidence=original.confidence,
                    reasoning=original.reasoning,
                    is_validated=False,
                )
            )
    return out
