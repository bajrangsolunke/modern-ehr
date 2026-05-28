"""LLM-driven extraction of structured lab values from PDF text."""
from __future__ import annotations

import json

from pydantic import BaseModel, Field

from app.ai.llm import llm_client
from app.ai.prompts.lab_extraction import LAB_EXTRACTION_SYSTEM_PROMPT


class ExtractedLab(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    value: str = Field(min_length=1, max_length=64)
    unit: str | None = Field(default=None, max_length=32)
    reference_range: str | None = Field(default=None, max_length=64)
    flag: str | None = Field(default=None, max_length=4)


class ExtractedLabBatch(BaseModel):
    results: list[ExtractedLab] = Field(default_factory=list)


async def extract_labs_from_text(text: str) -> ExtractedLabBatch:
    """Run the LLM extraction step. Returns empty results on parse
    failure or empty input — the caller decides how to surface that."""
    if not text or not text.strip():
        return ExtractedLabBatch()

    raw = await llm_client.chat(
        messages=[
            {"role": "system", "content": LAB_EXTRACTION_SYSTEM_PROMPT},
            {"role": "user", "content": text[:20_000]},  # cap input
        ],
        json_mode=True,
        max_tokens=1500,
    )
    try:
        return ExtractedLabBatch.model_validate_json(raw)
    except Exception:
        try:
            return ExtractedLabBatch.model_validate(json.loads(raw))
        except Exception:
            return ExtractedLabBatch()
