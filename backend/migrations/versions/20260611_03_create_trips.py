"""create trips table

Revision ID: 20260611_03
Revises: 20260611_02
Create Date: 2026-06-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260611_03"
down_revision: Union[str, Sequence[str], None] = "20260611_02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "trips",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=80), nullable=False),
        sa.Column("area_id", sa.String(length=80), nullable=False),
        sa.Column("from_place_id", sa.String(length=100), nullable=False),
        sa.Column("to_place_id", sa.String(length=100), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("latest_arrival_time", sa.Time(), nullable=False),
        sa.Column("recurrence", sa.String(length=16), nullable=False),
        sa.Column("reminder_minutes", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "recurrence IN ('once', 'daily', 'weekly', 'monthly')",
            name="ck_trips_recurrence",
        ),
        sa.CheckConstraint(
            "reminder_minutes BETWEEN 0 AND 120",
            name="ck_trips_reminder_minutes",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_trips_user_id"), "trips", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_trips_user_id"), table_name="trips")
    op.drop_table("trips")
