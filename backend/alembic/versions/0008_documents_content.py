"""store document bytes inline

Revision ID: 0008_documents_content
Revises: 0007_query_indexes
Create Date: 2026-05-27

Adds a `content BYTEA` column so the docs module can download the
uploaded files. The upload endpoint already caps payloads at 25 MB,
which is the practical ceiling for inlining bytes in Postgres. A
production deploy should swap this out for object storage and keep
only the storage_key.
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_documents_content"
down_revision: Union[str, None] = "0007_query_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "documents",
        sa.Column("content", sa.LargeBinary(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("documents", "content")
