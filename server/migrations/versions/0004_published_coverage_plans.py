"""add published coverage plans

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-25
"""
from alembic import op
import sqlalchemy as sa


revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "published_coverage_plans",
        sa.Column("period_key", sa.String(length=240), primary_key=True),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("selected_shift_ids", sa.JSON(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("published_by", sa.String(length=320), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_published_coverage_plans_period_start",
        "published_coverage_plans",
        ["period_start"],
    )
    op.create_index(
        "ix_published_coverage_plans_period_end",
        "published_coverage_plans",
        ["period_end"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_published_coverage_plans_period_end",
        table_name="published_coverage_plans",
    )
    op.drop_index(
        "ix_published_coverage_plans_period_start",
        table_name="published_coverage_plans",
    )
    op.drop_table("published_coverage_plans")
