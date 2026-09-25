from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class UserRole(Base):
    __tablename__ = "user_roles"

    email: Mapped[str] = mapped_column(String(320), primary_key=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="viewer")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class WorkspaceState(Base):
    __tablename__ = "workspace_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    updated_by: Mapped[str] = mapped_column(String(320), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class WorkspaceRevision(Base):
    __tablename__ = "workspace_revisions"

    revision: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor: Mapped[str] = mapped_column(String(320), nullable=False)
    action: Mapped[str] = mapped_column(String(80), nullable=False, default="state.update")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WorkloadSnapshot(Base):
    __tablename__ = "workload_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    source: Mapped[str] = mapped_column(String(40), nullable=False, default="jira")
    source_query: Mapped[str] = mapped_column(Text, nullable=False)
    total_issues: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    mapped_issues: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unmapped_issues: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unmapped_values: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    generated_by: Mapped[str] = mapped_column(String(320), nullable=False, default="monthly-worker")
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("period_start", "period_end", "source", name="uq_workload_snapshot_period_source"),
    )


class SiteWorkloadMetric(Base):
    __tablename__ = "site_workload_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    snapshot_id: Mapped[int] = mapped_column(ForeignKey("workload_snapshots.id", ondelete="CASCADE"), nullable=False, index=True)
    site_id: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    ticket_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    assignment_weight: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    open_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    monthly_counts: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    priority_counts: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    __table_args__ = (
        UniqueConstraint("snapshot_id", "site_id", name="uq_site_workload_snapshot_site"),
    )
