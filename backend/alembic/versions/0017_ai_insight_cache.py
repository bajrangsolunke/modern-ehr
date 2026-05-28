"""add content_hash to ai_insights for cache lookup

Revision ID: 0017_ai_insight_cache
Revises: 0016_alert_source
Create Date: 2026-05-28

Adds a `content_hash` column to ai_insights so summary/risk services
can cache LLM outputs and skip re-computation when the chart hasn't
changed. The composite index (patient_id, category, content_hash) is
the cache lookup hot path.
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017_ai_insight_cache"
down_revision: Union[str, None] = "0016_alert_source"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "ai_insights",
        sa.Column("content_hash", sa.String(length=64), nullable=True),
    )
    op.create_index(
        "ix_ai_insights_lookup",
        "ai_insights",
        ["patient_id", "category", "content_hash"],
    )


def downgrade() -> None:
    op.drop_index("ix_ai_insights_lookup", table_name="ai_insights")
    op.drop_column("ai_insights", "content_hash")
