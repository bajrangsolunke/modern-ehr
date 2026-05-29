"""provider extended fields + education + licensing

Revision ID: 0028_provider_extended_fields
Revises: 0027_appointment_service_link
Create Date: 2026-05-29
"""
from alembic import op
import sqlalchemy as sa


revision = "0028_provider_extended_fields"
down_revision = "0027_appointment_service_link"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- users column additions ---
    op.add_column("users", sa.Column("credential", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("first_name", sa.String(120), nullable=True))
    op.add_column("users", sa.Column("middle_name", sa.String(120), nullable=True))
    op.add_column("users", sa.Column("last_name", sa.String(120), nullable=True))
    op.add_column("users", sa.Column("date_of_birth", sa.Date(), nullable=True))
    op.add_column("users", sa.Column("gender", sa.String(32), nullable=True))
    op.add_column("users", sa.Column("npi", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("taxonomy_code", sa.String(32), nullable=True))
    op.add_column("users", sa.Column("languages_spoken", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("ssn_encrypted", sa.LargeBinary(), nullable=True))

    op.add_column("users", sa.Column("address_line1", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("address_line2", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("city", sa.String(120), nullable=True))
    op.add_column("users", sa.Column("zip_code", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("telephone", sa.String(32), nullable=True))
    op.add_column("users", sa.Column("mobile", sa.String(32), nullable=True))
    op.add_column("users", sa.Column("fax", sa.String(32), nullable=True))
    op.add_column("users", sa.Column("time_zone", sa.String(64), nullable=True))

    op.add_column(
        "users",
        sa.Column("federal_tax_id_encrypted", sa.LargeBinary(), nullable=True),
    )
    op.add_column("users", sa.Column("tax_id_type", sa.String(16), nullable=True))
    op.add_column("users", sa.Column("registration_date", sa.Date(), nullable=True))
    op.add_column(
        "users",
        sa.Column("primary_service_location", sa.String(255), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "supervising_provider_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "is_non_billing",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    op.create_index("ix_users_npi", "users", ["npi"])

    # --- provider_education table ---
    op.create_table(
        "provider_education",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "user_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(16), nullable=False),
        # 'education' or 'work'
        sa.Column("institution", sa.String(255), nullable=False),
        sa.Column("title", sa.String(255), nullable=True),
        # degree (for education) or job title (for work)
        sa.Column("field_or_specialty", sa.String(255), nullable=True),
        sa.Column("start_year", sa.Integer(), nullable=True),
        sa.Column("end_year", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "kind IN ('education', 'work')", name="ck_provider_education_kind"
        ),
    )
    op.create_index(
        "ix_provider_education_user_id", "provider_education", ["user_id"]
    )

    # --- provider_licenses table ---
    op.create_table(
        "provider_licenses",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "user_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("license_type", sa.String(64), nullable=False),
        sa.Column("license_number", sa.String(64), nullable=False),
        sa.Column("issuing_state", sa.String(64), nullable=True),
        sa.Column("issuing_authority", sa.String(255), nullable=True),
        sa.Column("issued_date", sa.Date(), nullable=True),
        sa.Column("expires_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_provider_licenses_user_id", "provider_licenses", ["user_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_provider_licenses_user_id", table_name="provider_licenses")
    op.drop_table("provider_licenses")
    op.drop_index("ix_provider_education_user_id", table_name="provider_education")
    op.drop_table("provider_education")
    op.drop_index("ix_users_npi", table_name="users")
    for col in [
        "is_non_billing",
        "supervising_provider_id",
        "primary_service_location",
        "registration_date",
        "tax_id_type",
        "federal_tax_id_encrypted",
        "time_zone",
        "fax",
        "mobile",
        "telephone",
        "zip_code",
        "city",
        "address_line2",
        "address_line1",
        "ssn_encrypted",
        "languages_spoken",
        "taxonomy_code",
        "npi",
        "gender",
        "date_of_birth",
        "last_name",
        "middle_name",
        "first_name",
        "credential",
    ]:
        op.drop_column("users", col)
