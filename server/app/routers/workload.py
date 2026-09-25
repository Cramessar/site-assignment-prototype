from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_supervisor
from ..db import get_db
from ..models import SiteWorkloadMetric, WorkloadSnapshot
from ..schemas import CurrentUser
from ..services.assignment_advisor import AssignmentAdvisorError, build_balanced_plan, review_plan_with_ai
from ..services.jira_workload import JiraWorkloadError, create_monthly_snapshot
from ..services.model_selector import select_assignment_model

router = APIRouter(prefix="/api/v1/workload", tags=["workload"])


class EngineerInput(BaseModel):
    id: str = Field(min_length=1, max_length=200)
    name: str = Field(min_length=1, max_length=200)
    capacity: float = Field(default=1.0, gt=0, le=10)


class AssignmentLockInput(BaseModel):
    person_id: str = Field(min_length=1, max_length=200)
    site_id: str = Field(min_length=1, max_length=200)


class AssignmentRecommendationRequest(BaseModel):
    engineers: list[EngineerInput] = Field(min_length=1)
    locks: list[AssignmentLockInput] = Field(default_factory=list)
    notes: str = Field(default="", max_length=4000)
    use_ai: bool = True


def _snapshot_metrics(db: Session, snapshot_id: int) -> list[SiteWorkloadMetric]:
    return db.scalars(
        select(SiteWorkloadMetric)
        .where(SiteWorkloadMetric.snapshot_id == snapshot_id)
        .order_by(desc(SiteWorkloadMetric.assignment_weight), SiteWorkloadMetric.site_id)
    ).all()


def _snapshot_payload(db: Session, snapshot: WorkloadSnapshot) -> dict[str, Any]:
    rows = _snapshot_metrics(db, snapshot.id)
    return {
        "id": snapshot.id,
        "period_start": snapshot.period_start,
        "period_end": snapshot.period_end,
        "source": snapshot.source,
        "total_issues": snapshot.total_issues,
        "mapped_issues": snapshot.mapped_issues,
        "unmapped_issues": snapshot.unmapped_issues,
        "unmapped_values": snapshot.unmapped_values,
        "generated_by": snapshot.generated_by,
        "generated_at": snapshot.generated_at,
        "sites": [
            {
                "site_id": row.site_id,
                "ticket_count": row.ticket_count,
                "assignment_weight": row.assignment_weight,
                "open_count": row.open_count,
                "monthly_counts": row.monthly_counts,
                "priority_counts": row.priority_counts,
            }
            for row in rows
        ],
    }


def _latest_snapshot(db: Session) -> WorkloadSnapshot | None:
    return db.scalar(
        select(WorkloadSnapshot)
        .order_by(desc(WorkloadSnapshot.period_end), desc(WorkloadSnapshot.id))
        .limit(1)
    )


@router.get("/snapshots")
def snapshots(
    limit: int = Query(default=12, ge=1, le=36),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(WorkloadSnapshot)
        .order_by(desc(WorkloadSnapshot.period_end), desc(WorkloadSnapshot.id))
        .limit(limit)
    ).all()
    return [_snapshot_payload(db, row) for row in rows]


@router.get("/current")
def current(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    row = _latest_snapshot(db)
    if not row:
        raise HTTPException(status_code=404, detail="No workload snapshot exists yet")
    return _snapshot_payload(db, row)


@router.post("/refresh")
async def refresh(
    as_of: date | None = None,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_supervisor),
) -> dict[str, Any]:
    try:
        row = await create_monthly_snapshot(db, as_of=as_of, generated_by=user.email)
        return _snapshot_payload(db, row)
    except JiraWorkloadError as exc:
        db.rollback()
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/assignment-model")
async def assignment_model(
    _: CurrentUser = Depends(require_supervisor),
) -> dict[str, str]:
    return {"model": await select_assignment_model()}


@router.post("/current/recommend-assignments")
async def recommend_assignments(
    body: AssignmentRecommendationRequest,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_supervisor),
) -> dict[str, Any]:
    snapshot = _latest_snapshot(db)
    if not snapshot:
        raise HTTPException(status_code=404, detail="No workload snapshot exists yet")

    metrics = _snapshot_metrics(db, snapshot.id)
    weights = {row.site_id: row.assignment_weight for row in metrics}
    site_details = {
        row.site_id: {
            "assignment_weight": row.assignment_weight,
            "ticket_count": row.ticket_count,
            "open_count": row.open_count,
            "monthly_counts": row.monthly_counts,
            "priority_counts": row.priority_counts,
        }
        for row in metrics
    }
    engineers = [row.model_dump() for row in body.engineers]
    locks = [row.model_dump() for row in body.locks]

    try:
        plan = build_balanced_plan(site_weights=weights, engineers=engineers, locks=locks)
    except AssignmentAdvisorError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    response: dict[str, Any] = {
        "snapshot": {
            "id": snapshot.id,
            "period_start": snapshot.period_start,
            "period_end": snapshot.period_end,
        },
        "plan": plan,
        "ai_review": None,
    }

    if body.use_ai:
        try:
            response["ai_review"] = await review_plan_with_ai(
                plan=plan,
                site_details=site_details,
                locks=locks,
                notes=body.notes,
            )
        except Exception as exc:
            response["ai_review"] = {
                "error": f"AI review unavailable: {exc}",
                "model": await select_assignment_model(),
            }

    return response
