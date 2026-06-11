"""constrain user roles

Revision ID: 20260611_02
Revises: 20260611_01
Create Date: 2026-06-11
"""
from typing import Sequence, Union

from alembic import op


revision: str = "20260611_02"
down_revision: Union[str, Sequence[str], None] = "20260611_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.create_check_constraint(
            "ck_users_role",
            "role IN ('user', 'staff', 'admin')",
        )


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_constraint("ck_users_role", type_="check")
