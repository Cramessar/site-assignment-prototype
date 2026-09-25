"""add rolling workload snapshots

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-25
"""
from alembic import op
import sqlalchemy as sa


revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workload_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("source", sa.String(length=40), nullable=False),
        sa.Column("source_query", sa.Text(), nullable=False),
        sa.Column("total_issues", sa.Integer(), nullable=False),
        sa.Column("mapped_issues", sa.Integer(), nullable=False),
        sa.Column("unmapped_issues", sa.Integer(), nullable=False),
        sa.Column("unmapped_values", sa.JSON(), nullable=False),
        sa.Column("generated_by", sa.String(length=320), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("period_start", "period_end", "source", name="uq_workload_snapshot_period_source"),
    )
    op.create_table(
        "site_workload_metrics",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("snapshot_id", sa.Integer(), sa.ForeignKey("workload_snapshots.id", ondelete="CASCADE"), nullable=False),
        sa.Column("site_id", sa.String(length=120), nullable=False),
        sa.Column("ticket_count", sa.Integer(), nullable=False),
        sa.Column("assignment_weight", sa.Integer(), nullable=False),
        sa.Column("open_count", sa.Integer(), nullable=False),
        sa.Column("monthly_counts", sa.JSON(), nullable=False),
        sa.Column("priority_counts", sa.JSON(), nullable=False),
        sa.UniqueConstraint("snapshot_id", "site_id", name="uq_site_workload_snapshot_site"),
    )
    op.create_index("ix_site_workload_metrics_snapshot_id", "site_workload_metrics", ["snapshot_id"])
    op.create_index("ix_site_workload_metrics_site_id", "site_workload_metrics", ["site_id"])


def downgrade() -> None:
    op.drop_index("ix_site_workload_metrics_site_id", table_name="site_workload_metrics")
    op.drop_index("ix_site_workload_metrics_snapshot_id", table_name="site_workload_metrics")
    op.drop_table("site_workload_metrics")
    op.drop_table("workload_snapshots")
