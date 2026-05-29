"""patient extended profile + preferences

Adds the demographics, addresses, emergency contact, and preferences
JSON column needed for the patient portal Settings page. All columns
are nullable / default JSON {} so existing records keep working.

Revision ID: 0029_patient_extended_profile
Revises: 0028_provider_extended_fields
Create Date: 2026-05-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0029_patient_extended_profile"
down_revision = "0028_provider_extended_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- Demographics ---
    op.add_column("patients", sa.Column("blood_group", sa.String(8), nullable=True))
    op.add_column("patients", sa.Column("gender_identity", sa.String(32), nullable=True))
    op.add_column("patients", sa.Column("preferred_pronouns", sa.String(32), nullable=True))

    # --- Mailing address ---
    op.add_column("patients", sa.Column("mailing_address_line1", sa.String(255), nullable=True))
    op.add_column("patients", sa.Column("mailing_address_line2", sa.String(255), nullable=True))
    op.add_column("patients", sa.Column("mailing_city", sa.String(120), nullable=True))
    op.add_column("patients", sa.Column("mailing_state", sa.String(64), nullable=True))
    op.add_column("patients", sa.Column("mailing_postal_code", sa.String(20), nullable=True))
    op.add_column("patients", sa.Column("mailing_country", sa.String(64), nullable=True))

    # --- Physical address ---
    op.add_column(
        "patients",
        sa.Column(
            "physical_same_as_mailing",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.add_column("patients", sa.Column("physical_address_line1", sa.String(255), nullable=True))
    op.add_column("patients", sa.Column("physical_address_line2", sa.String(255), nullable=True))
    op.add_column("patients", sa.Column("physical_city", sa.String(120), nullable=True))
    op.add_column("patients", sa.Column("physical_state", sa.String(64), nullable=True))
    op.add_column("patients", sa.Column("physical_postal_code", sa.String(20), nullable=True))
    op.add_column("patients", sa.Column("physical_country", sa.String(64), nullable=True))

    # --- Emergency contact ---
    op.add_column("patients", sa.Column("emergency_contact_name", sa.String(255), nullable=True))
    op.add_column("patients", sa.Column("emergency_contact_phone", sa.String(64), nullable=True))
    op.add_column("patients", sa.Column("emergency_contact_relationship", sa.String(64), nullable=True))

    # --- Preferences (notifications, pharmacy, language, comm channel) ---
    # Single JSONB column keeps schema simple; backend layers a strict
    # Pydantic shape on top so callers can't write arbitrary keys.
    op.add_column(
        "patients",
        sa.Column(
            "preferences",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    for col in [
        "preferences",
        "emergency_contact_relationship",
        "emergency_contact_phone",
        "emergency_contact_name",
        "physical_country",
        "physical_postal_code",
        "physical_state",
        "physical_city",
        "physical_address_line2",
        "physical_address_line1",
        "physical_same_as_mailing",
        "mailing_country",
        "mailing_postal_code",
        "mailing_state",
        "mailing_city",
        "mailing_address_line2",
        "mailing_address_line1",
        "preferred_pronouns",
        "gender_identity",
        "blood_group",
    ]:
        op.drop_column("patients", col)
