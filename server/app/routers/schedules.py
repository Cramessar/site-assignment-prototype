from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from ..auth import require_supervisor
from ..db import get_db
from ..models import (
    ShiftScheduleDefault,
    StaffScheduleException,
    StaffScheduleProfile,
    StaffScheduleSegment,
)
from ..schemas import CurrentUser

router = APIRouter(prefix="/api/v1/schedules", tags=["schedules"])


class ShiftDefaultBody(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    default_start: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    default_end: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    active_iso_weekdays: list[int] = Field(default_factory=list)


class ScheduleExceptionBody(BaseModel):
    status: str = Field(pattern="^(vacation|off|unavailable|training|meeting|working)$")
    start_time: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    end_time: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    note: str | None = Field(default=None, max_length=500)


def _profile_payload(db: Session, profile: StaffScheduleProfile) -> dict[str, Any]:
    segments = db.scalars(
        select(StaffScheduleSegment)
        .where(StaffScheduleSegment.person_id == profile.person_id)
        .order_by(
            StaffScheduleSegment.iso_weekday,
            StaffScheduleSegment.segment_order,
            StaffScheduleSegment.id,
        )
    ).all()
    return {
        "person_id": profile.person_id,
        "full_name": profile.full_name,
        "shift_id": profile.shift_id,
        "replaces_shift_default": profile.replaces_shift_default,
        "source": profile.source,
        "note": profile.note,
        "segments": [
            {
                "iso_weekday": row.iso_weekday,
                "segment_order": row.segment_order,
                "start_time": row.start_time,
                "end_time": row.end_time,
                "note": row.note,
            }
            for row in segments
        ],
    }


@router.get("/config")
def schedule_config(
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    defaults = db.scalars(
        select(ShiftScheduleDefault).order_by(ShiftScheduleDefault.shift_id)
    ).all()
    profiles = db.scalars(
        select(StaffScheduleProfile).order_by(StaffScheduleProfile.full_name)
    ).all()

    return {
        "shift_defaults": [
            {
                "shift_id": row.shift_id,
                "name": row.name,
                "default_start": row.default_start,
                "default_end": row.default_end,
                "active_iso_weekdays": row.active_iso_weekdays,
            }
            for row in defaults
        ],
        "profiles": [_profile_payload(db, row) for row in profiles],
    }


@router.put("/defaults/{shift_id}")
def put_shift_default(
    shift_id: str,
    body: ShiftDefaultBody,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_supervisor),
) -> dict[str, Any]:
    weekdays=sorted({int(day) for day in body.active_iso_weekdays if 1 <= int(day) <= 7})
    row=db.get(ShiftScheduleDefault,shift_id)
    if row is None:
        row=ShiftScheduleDefault(
            shift_id=shift_id,
            name=body.name or shift_id,
            default_start=body.default_start,
            default_end=body.default_end,
            active_iso_weekdays=weekdays,
        )
        db.add(row)
    else:
        if body.name:
            row.name=body.name
        row.default_start=body.default_start
        row.default_end=body.default_end
        row.active_iso_weekdays=weekdays
    db.commit()
    db.refresh(row)
    return {
        "shift_id":row.shift_id,
        "name":row.name,
        "default_start":row.default_start,
        "default_end":row.default_end,
        "active_iso_weekdays":row.active_iso_weekdays,
    }


@router.get("/exceptions")
def schedule_exceptions(
    date_from: date,
    date_to: date,
    person_id: str | None = None,
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    if date_to < date_from:
        raise HTTPException(status_code=400, detail="date_to must be on or after date_from")

    conditions = [
        StaffScheduleException.exception_date >= date_from,
        StaffScheduleException.exception_date <= date_to,
    ]
    if person_id:
        conditions.append(StaffScheduleException.person_id == person_id)

    rows = db.scalars(
        select(StaffScheduleException)
        .where(and_(*conditions))
        .order_by(
            StaffScheduleException.exception_date,
            StaffScheduleException.person_id,
        )
    ).all()

    return [
        {
            "person_id": row.person_id,
            "date": row.exception_date,
            "status": row.status,
            "start_time": row.start_time,
            "end_time": row.end_time,
            "note": row.note,
            "source": row.source,
            "created_by": row.created_by,
        }
        for row in rows
    ]


@router.put("/exceptions/{person_id}/{exception_date}")
def put_schedule_exception(
    person_id: str,
    exception_date: date,
    body: ScheduleExceptionBody,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_supervisor),
) -> dict[str, Any]:
    row = db.scalar(
        select(StaffScheduleException).where(
            StaffScheduleException.person_id == person_id,
            StaffScheduleException.exception_date == exception_date,
        )
    )
    if row is None:
        row = StaffScheduleException(
            person_id=person_id,
            exception_date=exception_date,
            status=body.status,
            start_time=body.start_time,
            end_time=body.end_time,
            note=body.note,
            source="site-coverage",
            created_by=user.email,
        )
        db.add(row)
    else:
        row.status = body.status
        row.start_time = body.start_time
        row.end_time = body.end_time
        row.note = body.note
        row.source = "site-coverage"
        row.created_by = user.email

    db.commit()
    db.refresh(row)
    return {
        "person_id": row.person_id,
        "date": row.exception_date,
        "status": row.status,
        "start_time": row.start_time,
        "end_time": row.end_time,
        "note": row.note,
        "source": row.source,
        "created_by": row.created_by,
    }


@router.delete("/exceptions/{person_id}/{exception_date}", status_code=204)
def delete_schedule_exception(
    person_id: str,
    exception_date: date,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_supervisor),
):
    row = db.scalar(
        select(StaffScheduleException).where(
            StaffScheduleException.person_id == person_id,
            StaffScheduleException.exception_date == exception_date,
        )
    )
    if row:
        db.delete(row)
        db.commit()
    return None
