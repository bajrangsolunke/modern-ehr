"""payments v1

Revision ID: 0026_payments_v1
Revises: 0025_appointment_modality
Create Date: 2026-05-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0026_payments_v1"
down_revision = "0025_appointment_modality"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Sequential invoice numbers — atomic, no gaps.
    op.execute("CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1000")

    op.add_column(
        "patients",
        sa.Column("stripe_customer_id", sa.String(64), nullable=True),
    )

    op.create_table(
        "service_catalog",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(32), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "category",
            sa.String(32),
            nullable=False,
            server_default="visit",
        ),
        sa.Column(
            "price_cents", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "tax_rate_bp", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "taxable", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("price_cents >= 0", name="ck_svc_price_nonneg"),
        sa.CheckConstraint(
            "tax_rate_bp >= 0 AND tax_rate_bp <= 10000",
            name="ck_svc_tax_bp_range",
        ),
    )
    op.create_index("ix_service_catalog_active", "service_catalog", ["is_active"])

    op.create_table(
        "invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("number", sa.String(32), nullable=False, unique=True),
        sa.Column(
            "patient_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("patients.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "status",
            sa.String(24),
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "subtotal_cents", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "discount_cents", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "tax_cents", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "total_cents", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "paid_cents", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "balance_cents", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "issued_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column(
            "due_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "paid_cents >= 0 AND total_cents >= 0",
            name="ck_inv_amounts_nonneg",
        ),
        sa.CheckConstraint(
            "status IN ('draft','open','paid','partially_paid','void','refunded')",
            name="ck_inv_status",
        ),
    )
    op.create_index("ix_invoices_status", "invoices", ["status"])

    op.create_table(
        "charges",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "patient_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("patients.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "encounter_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("encounters.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "appointment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("appointments.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "service_catalog_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("service_catalog.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("description", sa.String(255), nullable=False),
        sa.Column("code", sa.String(32), nullable=False),
        sa.Column(
            "quantity", sa.Integer(), nullable=False, server_default="1"
        ),
        sa.Column("unit_price_cents", sa.Integer(), nullable=False),
        sa.Column(
            "discount_cents", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "tax_cents", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column("total_cents", sa.Integer(), nullable=False),
        sa.Column(
            "invoice_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("invoices.id", ondelete="RESTRICT"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "voided_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column(
            "voided_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("quantity > 0", name="ck_charge_qty_pos"),
        sa.CheckConstraint(
            "unit_price_cents >= 0 AND discount_cents >= 0 AND tax_cents >= 0",
            name="ck_charge_amounts_nonneg",
        ),
    )

    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "invoice_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("invoices.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "patient_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("patients.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("method", sa.String(24), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.String(16),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "stripe_payment_intent_id",
            sa.String(128),
            nullable=True,
            unique=True,
        ),
        sa.Column("stripe_charge_id", sa.String(128), nullable=True),
        sa.Column("last4", sa.String(4), nullable=True),
        sa.Column("card_brand", sa.String(16), nullable=True),
        sa.Column("reference", sa.String(64), nullable=True),
        sa.Column(
            "received_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("amount_cents > 0", name="ck_pay_amount_pos"),
        sa.CheckConstraint(
            "method IN ('cash','check','card_present','stripe','adjustment')",
            name="ck_pay_method",
        ),
        sa.CheckConstraint(
            "status IN ('pending','succeeded','failed','cancelled')",
            name="ck_pay_status",
        ),
    )

    op.create_table(
        "refunds",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "payment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("payments.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(255), nullable=False),
        sa.Column(
            "stripe_refund_id", sa.String(128), nullable=True, unique=True
        ),
        sa.Column(
            "status",
            sa.String(16),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "refunded_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("amount_cents > 0", name="ck_refund_amount_pos"),
    )


def downgrade() -> None:
    op.drop_table("refunds")
    op.drop_table("payments")
    op.drop_index("ix_invoices_status", table_name="invoices")
    op.drop_table("charges")
    op.drop_table("invoices")
    op.drop_index("ix_service_catalog_active", table_name="service_catalog")
    op.drop_table("service_catalog")
    op.drop_column("patients", "stripe_customer_id")
    op.execute("DROP SEQUENCE IF EXISTS invoice_number_seq")
