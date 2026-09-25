from datetime import date, datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_supervisor
from ..db import get_db
from ..models import PublishedCoveragePlan
from ..schemas import CurrentUser

router = APIRouter(prefix="/api/v1/assignments", tags=["assignments"])


class PublishedPlanBody(BaseModel):
    plan: dict[str, Any] = Field(default_factory=dict)


def _public_payload(row: PublishedCoveragePlan) -> dict[str, Any]:
    payload = dict(row.payload or {})
    payload.pop("publishedBy", None)
    payload["periodKey"] = row.period_key
    payload["periodStart"] = row.period_start.isoformat()
    payload["periodEnd"] = row.period_end.isoformat()
    payload["selectedShiftIds"] = list(row.selected_shift_ids or [])
    payload["publishedAt"] = row.published_at.isoformat() if row.published_at else None
    return payload


@router.get("/published")
def published_plans(
    on_date: date | None = Query(default=None, alias="date"),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    stmt = select(PublishedCoveragePlan)
    if on_date is not None:
        stmt = stmt.where(
            PublishedCoveragePlan.period_start <= on_date,
            PublishedCoveragePlan.period_end >= on_date,
        )
    rows = db.scalars(
        stmt.order_by(
            PublishedCoveragePlan.period_start.desc(),
            PublishedCoveragePlan.published_at.desc(),
        )
    ).all()
    return [_public_payload(row) for row in rows]


@router.put("/published/{period_key}")
def publish_plan(
    period_key: str,
    body: PublishedPlanBody,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_supervisor),
) -> dict[str, Any]:
    plan = dict(body.plan or {})
    if not plan:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="plan is required")

    body_key = str(plan.get("periodKey") or "")
    if not body_key or body_key != period_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="periodKey must match the URL",
        )

    try:
        period_start = date.fromisoformat(str(plan["periodStart"]))
        period_end = date.fromisoformat(str(plan["periodEnd"]))
    except (KeyError, TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="periodStart and periodEnd must be ISO dates",
        )

    if period_end < period_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="periodEnd must be on or after periodStart",
        )

    shift_ids = plan.get("selectedShiftIds") or []
    if not isinstance(shift_ids, list) or not shift_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="selectedShiftIds must be a non-empty list",
        )

    now = datetime.now(timezone.utc)
    plan["publishedAt"] = now.isoformat()
    plan["publishedBy"] = user.email

    row = db.get(PublishedCoveragePlan, period_key)
    if row is None:
        row = PublishedCoveragePlan(
            period_key=period_key,
            period_start=period_start,
            period_end=period_end,
            selected_shift_ids=list(shift_ids),
            payload=plan,
            published_by=user.email,
            published_at=now,
            updated_at=now,
        )
        db.add(row)
    else:
        row.period_start = period_start
        row.period_end = period_end
        row.selected_shift_ids = list(shift_ids)
        row.payload = plan
        row.published_by = user.email
        row.published_at = now
        row.updated_at = now

    db.commit()
    db.refresh(row)
    return _public_payload(row)


@router.delete("/published/{period_key}", status_code=204)
def delete_published_plan(
    period_key: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_supervisor),
):
    row = db.get(PublishedCoveragePlan, period_key)
    if row is not None:
        db.delete(row)
        db.commit()
    return None
