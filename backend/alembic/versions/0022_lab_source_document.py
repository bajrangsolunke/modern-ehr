"""link lab_results to source document for AI-extracted values

Revision ID: 0022_lab_source_document
Revises: 0021_isolate_patient_convs
Create Date: 2026-05-28

When the AI lab-extractor parses values out of an uploaded PDF, we
persist the resulting lab_results rows alongside a FK to the source
Document. That gives the UI a "extracted from {filename}" affordance
and lets a future regen overwrite the previous extraction cleanly.

Manual entries leave source_document_id NULL — same shape as before
the migration.
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0022_lab_source_document"
down_revision: Union[str, None] = "0021_isolate_patient_convs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "lab_results",
        sa.Column(
            "source_document_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_lab_results_source_document",
        "lab_results",
        ["source_document_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_lab_results_source_document", table_name="lab_results"
    )
    op.drop_column("lab_results", "source_document_id")
