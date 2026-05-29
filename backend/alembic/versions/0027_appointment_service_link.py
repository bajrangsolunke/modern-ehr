"""appointment service catalog link

Revision ID: 0027_appointment_service_link
Revises: 0026_payments_v1
Create Date: 2026-05-29
"""
from alembic import op
import sqlalchemy as sa


revision = "0027_appointment_service_link"
down_revision = "0026_payments_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "appointments",
        sa.Column(
            "service_catalog_id",
            sa.UUID(),
            sa.ForeignKey("service_catalog.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_appointments_service_catalog_id",
        "appointments",
        ["service_catalog_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_appointments_service_catalog_id", table_name="appointments")
    op.drop_column("appointments", "service_catalog_id")
