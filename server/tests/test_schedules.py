import json
import os
from datetime import date

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_site_assignment.db")
os.environ.setdefault("AUTH_MODE", "dev")
os.environ.setdefault("DEV_USER_EMAIL", "supervisor@example.com")
os.environ.setdefault("BOOTSTRAP_SUPERVISORS", "supervisor@example.com")

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.db import Base, SessionLocal, engine
from app.main import app
from app.models import (
    ShiftScheduleDefault,
    StaffScheduleException,
    StaffScheduleProfile,
    StaffScheduleSegment,
)
from app.services.schedule_seed import seed_schedules


Base.metadata.create_all(bind=engine)
client = TestClient(app)


def _clear_schedule_tables():
    db = SessionLocal()
    try:
        db.execute(delete(StaffScheduleException))
        db.execute(delete(StaffScheduleSegment))
        db.execute(delete(StaffScheduleProfile))
        db.execute(delete(ShiftScheduleDefault))
        db.commit()
    finally:
        db.close()


def test_schedule_seed_is_idempotent_and_preserves_edits(tmp_path):
    _clear_schedule_tables()
    seed_path = tmp_path / "schedule_seed.json"
    seed_path.write_text(
        json.dumps(
            {
                "shift_defaults": [
                    {
                        "shift_id": "weekend-day",
                        "name": "Weekend Day",
                        "default_start": "06:00",
                        "default_end": "16:00",
                        "active_iso_weekdays": [5, 6, 7, 1],
                    }
                ],
                "custom_profiles": [
                    {
                        "person_id": "morning-david",
                        "full_name": "David Lewis",
                        "shift_id": "weekend-day",
                        "segments": [
                            {"iso_weekday": 5, "start_time": "06:00", "end_time": "18:00"},
                            {"iso_weekday": 6, "start_time": "06:00", "end_time": "18:00"},
                            {"iso_weekday": 7, "start_time": "06:00", "end_time": "18:00"},
                        ],
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    db = SessionLocal()
    try:
        first = seed_schedules(db, seed_path)
        assert first == {"shift_defaults": 1, "profiles": 1, "segments": 3}

        weekend = db.get(ShiftScheduleDefault, "weekend-day")
        weekend.default_end = "17:00"
        db.commit()

        second = seed_schedules(db, seed_path)
        assert second == {"shift_defaults": 0, "profiles": 0, "segments": 0}
        assert db.get(ShiftScheduleDefault, "weekend-day").default_end == "17:00"

        profile = db.get(StaffScheduleProfile, "morning-david")
        assert profile.full_name == "David Lewis"
        segments = db.scalars(
            select(StaffScheduleSegment)
            .where(StaffScheduleSegment.person_id == "morning-david")
            .order_by(StaffScheduleSegment.iso_weekday)
        ).all()
        assert [(x.iso_weekday, x.start_time, x.end_time) for x in segments] == [
            (5, "06:00", "18:00"),
            (6, "06:00", "18:00"),
            (7, "06:00", "18:00"),
        ]
    finally:
        db.close()


def test_schedule_config_and_shared_exception_crud():
    _clear_schedule_tables()
    db = SessionLocal()
    try:
        db.add(
            ShiftScheduleDefault(
                shift_id="weekend-mid",
                name="Weekend Mid",
                default_start="12:00",
                default_end="22:00",
                active_iso_weekdays=[5, 6, 7, 1],
            )
        )
        db.add(
            StaffScheduleProfile(
                person_id="mid-krysztof",
                full_name="Krysztof Capuras",
                shift_id="weekend-mid",
                replaces_shift_default=True,
                source="test",
            )
        )
        db.flush()
        db.add(
            StaffScheduleSegment(
                person_id="mid-krysztof",
                iso_weekday=5,
                segment_order=0,
                start_time="08:00",
                end_time="20:00",
            )
        )
        db.commit()
    finally:
        db.close()

    config = client.get("/api/v1/schedules/config")
    assert config.status_code == 200
    body = config.json()
    weekend_mid = next(x for x in body["shift_defaults"] if x["shift_id"] == "weekend-mid")
    assert weekend_mid["default_end"] == "22:00"
    profile = next(x for x in body["profiles"] if x["person_id"] == "mid-krysztof")
    assert profile["segments"][0]["start_time"] == "08:00"
    assert profile["segments"][0]["end_time"] == "20:00"

    vacation = client.put(
        "/api/v1/schedules/exceptions/mid-krysztof/2026-09-25",
        json={"status": "vacation", "note": "PTO"},
    )
    assert vacation.status_code == 200
    assert vacation.json()["status"] == "vacation"

    rows = client.get(
        "/api/v1/schedules/exceptions",
        params={"date_from": "2026-09-25", "date_to": "2026-10-01"},
    )
    assert rows.status_code == 200
    assert rows.json() == [
        {
            "person_id": "mid-krysztof",
            "date": "2026-09-25",
            "status": "vacation",
            "start_time": None,
            "end_time": None,
            "note": "PTO",
            "source": "site-coverage",
            "created_by": "supervisor@example.com",
        }
    ]

    deleted = client.delete("/api/v1/schedules/exceptions/mid-krysztof/2026-09-25")
    assert deleted.status_code == 204

    rows = client.get(
        "/api/v1/schedules/exceptions",
        params={"date_from": "2026-09-25", "date_to": "2026-10-01"},
    )
    assert rows.status_code == 200
    assert rows.json() == []


def test_shift_default_update_is_shared():
    _clear_schedule_tables()

    response = client.put(
        "/api/v1/schedules/defaults/weekday-mid",
        json={
            "name": "Weekday Mid",
            "default_start": "12:00",
            "default_end": "22:00",
            "active_iso_weekdays": [1, 2, 3, 4],
        },
    )
    assert response.status_code == 200
    assert response.json()["active_iso_weekdays"] == [1, 2, 3, 4]

    db = SessionLocal()
    try:
        row = db.get(ShiftScheduleDefault, "weekday-mid")
        assert row.default_start == "12:00"
        assert row.default_end == "22:00"
    finally:
        db.close()
