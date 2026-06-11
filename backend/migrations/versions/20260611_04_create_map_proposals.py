"""create map proposals table

Revision ID: 20260611_04
Revises: 20260611_03
Create Date: 2026-06-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260611_04"
down_revision: Union[str, Sequence[str], None] = "20260611_03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "map_proposals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("submitter_id", sa.Integer(), nullable=False),
        sa.Column("reviewer_id", sa.Integer(), nullable=True),
        sa.Column("area_id", sa.String(length=80), nullable=False),
        sa.Column("title", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("changes_json", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("merge_summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('pending', 'approved', 'rejected')",
            name="ck_map_proposals_status",
        ),
        sa.ForeignKeyConstraint(["reviewer_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["submitter_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_map_proposals_area_id"), "map_proposals", ["area_id"], unique=False)
    op.create_index(op.f("ix_map_proposals_status"), "map_proposals", ["status"], unique=False)
    op.create_index(op.f("ix_map_proposals_submitter_id"), "map_proposals", ["submitter_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_map_proposals_submitter_id"), table_name="map_proposals")
    op.drop_index(op.f("ix_map_proposals_status"), table_name="map_proposals")
    op.drop_index(op.f("ix_map_proposals_area_id"), table_name="map_proposals")
    op.drop_table("map_proposals")
