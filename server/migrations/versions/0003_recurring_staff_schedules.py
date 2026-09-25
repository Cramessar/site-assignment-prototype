"""add recurring staff schedules

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-25
"""
from alembic import op
import sqlalchemy as sa


revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "shift_schedule_defaults",
        sa.Column("shift_id", sa.String(length=80), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("default_start", sa.String(length=5), nullable=True),
        sa.Column("default_end", sa.String(length=5), nullable=True),
        sa.Column("active_iso_weekdays", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "staff_schedule_profiles",
        sa.Column("person_id", sa.String(length=120), primary_key=True),
        sa.Column("full_name", sa.String(length=200), nullable=False),
        sa.Column("shift_id", sa.String(length=80), nullable=False),
        sa.Column("replaces_shift_default", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("source", sa.String(length=80), nullable=False, server_default="manual"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "staff_schedule_segments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "person_id",
            sa.String(length=120),
            sa.ForeignKey("staff_schedule_profiles.person_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("iso_weekday", sa.Integer(), nullable=False),
        sa.Column("segment_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("start_time", sa.String(length=5), nullable=False),
        sa.Column("end_time", sa.String(length=5), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.UniqueConstraint(
            "person_id",
            "iso_weekday",
            "segment_order",
            name="uq_staff_schedule_segment_person_day_order",
        ),
    )
    op.create_index(
        "ix_staff_schedule_segments_person_id",
        "staff_schedule_segments",
        ["person_id"],
    )
    op.create_table(
        "staff_schedule_exceptions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("person_id", sa.String(length=120), nullable=False),
        sa.Column("exception_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("start_time", sa.String(length=5), nullable=True),
        sa.Column("end_time", sa.String(length=5), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("source", sa.String(length=80), nullable=False, server_default="manual"),
        sa.Column("created_by", sa.String(length=320), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint(
            "person_id",
            "exception_date",
            name="uq_staff_schedule_exception_person_date",
        ),
    )
    op.create_index(
        "ix_staff_schedule_exceptions_person_id",
        "staff_schedule_exceptions",
        ["person_id"],
    )
    op.create_index(
        "ix_staff_schedule_exceptions_exception_date",
        "staff_schedule_exceptions",
        ["exception_date"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_staff_schedule_exceptions_exception_date",
        table_name="staff_schedule_exceptions",
    )
    op.drop_index(
        "ix_staff_schedule_exceptions_person_id",
        table_name="staff_schedule_exceptions",
    )
    op.drop_table("staff_schedule_exceptions")
    op.drop_index(
        "ix_staff_schedule_segments_person_id",
        table_name="staff_schedule_segments",
    )
    op.drop_table("staff_schedule_segments")
    op.drop_table("staff_schedule_profiles")
    op.drop_table("shift_schedule_defaults")
