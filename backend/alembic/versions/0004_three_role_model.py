"""collapse user roles into provider/staff/admin

Revision ID: 0004_three_role_model
Revises: 0003_avatar_url_text
Create Date: 2026-05-26

Old roles (surgeon, physician, nurse, coordinator, admin) map down to
(provider, staff, admin):

  surgeon, physician, nurse  -> provider
  coordinator                -> staff
  admin                      -> admin

Postgres enums need rebuilding to add/remove values, so we:
  1. Rename the existing type aside.
  2. Create the new type with the new values.
  3. Alter the column with a USING clause that maps old → new.
  4. Drop the old type and tidy up.
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

from alembic import op

revision: str = "0004_three_role_model"
down_revision: Union[str, None] = "0003_avatar_url_text"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


OLD_VALUES = ("surgeon", "physician", "nurse", "coordinator", "admin")
NEW_VALUES = ("provider", "staff", "admin")


def upgrade() -> None:
    op.execute("ALTER TYPE user_role RENAME TO user_role_old")
    op.execute(
        "CREATE TYPE user_role AS ENUM ('provider', 'staff', 'admin')"
    )
    op.execute(
        """
        ALTER TABLE users
        ALTER COLUMN role DROP DEFAULT,
        ALTER COLUMN role TYPE user_role USING (
            CASE role::text
                WHEN 'surgeon'     THEN 'provider'
                WHEN 'physician'   THEN 'provider'
                WHEN 'nurse'       THEN 'provider'
                WHEN 'coordinator' THEN 'staff'
                WHEN 'admin'       THEN 'admin'
                ELSE 'provider'
            END
        )::user_role,
        ALTER COLUMN role SET DEFAULT 'provider'::user_role
        """
    )
    op.execute("DROP TYPE user_role_old")


def downgrade() -> None:
    # Lossy by design — we don't know which provider was a surgeon vs.
    # nurse, so we collapse downgrades to (physician, coordinator, admin).
    op.execute("ALTER TYPE user_role RENAME TO user_role_new")
    op.execute(
        "CREATE TYPE user_role AS ENUM "
        "('surgeon', 'physician', 'nurse', 'coordinator', 'admin')"
    )
    op.execute(
        """
        ALTER TABLE users
        ALTER COLUMN role DROP DEFAULT,
        ALTER COLUMN role TYPE user_role USING (
            CASE role::text
                WHEN 'provider' THEN 'physician'
                WHEN 'staff'    THEN 'coordinator'
                WHEN 'admin'    THEN 'admin'
                ELSE 'physician'
            END
        )::user_role,
        ALTER COLUMN role SET DEFAULT 'physician'::user_role
        """
    )
    op.execute("DROP TYPE user_role_new")
