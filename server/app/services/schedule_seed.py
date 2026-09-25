import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import ShiftScheduleDefault, StaffScheduleProfile, StaffScheduleSegment


DEFAULT_SEED_PATH = Path("/app/config/schedule_seed.json")


def seed_schedules(db: Session, seed_path: Path = DEFAULT_SEED_PATH) -> dict[str, int]:
    if not seed_path.exists():
        return {"shift_defaults": 0, "profiles": 0, "segments": 0}

    data = json.loads(seed_path.read_text(encoding="utf-8"))
    counts = {"shift_defaults": 0, "profiles": 0, "segments": 0}

    for row in data.get("shift_defaults", []):
        existing = db.get(ShiftScheduleDefault, row["shift_id"])
        if existing:
            continue
        db.add(
            ShiftScheduleDefault(
                shift_id=row["shift_id"],
                name=row["name"],
                default_start=row.get("default_start"),
                default_end=row.get("default_end"),
                active_iso_weekdays=row.get("active_iso_weekdays", []),
            )
        )
        counts["shift_defaults"] += 1

    for profile in data.get("custom_profiles", []):
        person_id = profile["person_id"]
        existing = db.get(StaffScheduleProfile, person_id)
        if existing:
            continue

        db.add(
            StaffScheduleProfile(
                person_id=person_id,
                full_name=profile["full_name"],
                shift_id=profile["shift_id"],
                replaces_shift_default=bool(profile.get("replaces_shift_default", True)),
                source=profile.get("source", "seed"),
                note=profile.get("note"),
            )
        )
        db.flush()
        counts["profiles"] += 1

        for index, segment in enumerate(profile.get("segments", [])):
            db.add(
                StaffScheduleSegment(
                    person_id=person_id,
                    iso_weekday=int(segment["iso_weekday"]),
                    segment_order=int(segment.get("segment_order", index)),
                    start_time=segment["start_time"],
                    end_time=segment["end_time"],
                    note=segment.get("note"),
                )
            )
            counts["segments"] += 1

    db.commit()
    return counts
