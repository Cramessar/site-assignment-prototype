import json
from pathlib import Path

from sqlalchemy import delete
from sqlalchemy.orm import Session

from ..models import ShiftScheduleDefault, StaffScheduleProfile, StaffScheduleSegment


DEFAULT_SEED_PATH = Path("/app/config/schedule_seed.json")

# These are specific prototype-era defaults that were superseded by the
# Microsoft Shifts screenshots. We only auto-repair the exact old values so a
# later supervisor edit is not silently overwritten.
LEGACY_DEFAULTS = {
    "weekday-mid": {
        "old": ("12:00", "20:00", [1, 2, 3, 4]),
        "new": ("12:00", "22:00", [1, 2, 3, 4]),
    },
    "weekend-mid": {
        "old": ("12:00", "20:00", [5, 6, 7, 1]),
        "new": ("12:00", "22:00", [5, 6, 7, 1]),
    },
    "weekday-night": {
        "old": ("20:00", "06:00", [1, 2, 3, 4, 5]),
        "new": ("20:00", "06:00", [1, 2, 3, 4]),
    },
    "commissioning": {
        "old": ("09:00", "17:00", [1, 2, 3, 4, 5]),
        "new": ("08:00", "17:00", [1, 2, 3, 4, 5]),
    },
}


def _matches_default(row: ShiftScheduleDefault, expected: tuple[str, str, list[int]]) -> bool:
    start, end, days = expected
    return (
        row.default_start == start
        and row.default_end == end
        and sorted(int(day) for day in (row.active_iso_weekdays or [])) == sorted(int(day) for day in days)
    )


def _sync_seeded_profile(db: Session, profile_data: dict) -> tuple[int, int]:
    """Keep screenshot/user-confirmed recurring schedules canonical.

    Recurring profiles do not currently have a supervisor editing UI. That
    makes the seed the source of truth for these known individual patterns.
    Replacing the segments on startup also fixes databases created from older
    prototype schedule values.
    """
    person_id = profile_data["person_id"]
    existing = db.get(StaffScheduleProfile, person_id)
    profile_created = 0

    if existing is None:
        existing = StaffScheduleProfile(person_id=person_id)
        db.add(existing)
        profile_created = 1

    existing.full_name = profile_data["full_name"]
    existing.shift_id = profile_data["shift_id"]
    existing.replaces_shift_default = bool(profile_data.get("replaces_shift_default", True))
    existing.source = profile_data.get("source", "seed")
    existing.note = profile_data.get("note")
    db.flush()

    db.execute(
        delete(StaffScheduleSegment).where(
            StaffScheduleSegment.person_id == person_id
        )
    )

    segment_count = 0
    per_day_order: dict[int, int] = {}
    for segment in profile_data.get("segments", []):
        weekday = int(segment["iso_weekday"])
        order = segment.get("segment_order")
        if order is None:
            order = per_day_order.get(weekday, 0)
        per_day_order[weekday] = int(order) + 1

        db.add(
            StaffScheduleSegment(
                person_id=person_id,
                iso_weekday=weekday,
                segment_order=int(order),
                start_time=segment["start_time"],
                end_time=segment["end_time"],
                note=segment.get("note"),
            )
        )
        segment_count += 1

    return profile_created, segment_count


def seed_schedules(db: Session, seed_path: Path = DEFAULT_SEED_PATH) -> dict[str, int]:
    if not seed_path.exists():
        return {"shift_defaults": 0, "profiles": 0, "segments": 0}

    data = json.loads(seed_path.read_text(encoding="utf-8"))
    counts = {"shift_defaults": 0, "profiles": 0, "segments": 0}

    for row in data.get("shift_defaults", []):
        existing = db.get(ShiftScheduleDefault, row["shift_id"])
        if existing is None:
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
            continue

        repair = LEGACY_DEFAULTS.get(row["shift_id"])
        if repair and _matches_default(existing, repair["old"]):
            existing.default_start, existing.default_end, existing.active_iso_weekdays = repair["new"]

    for profile in data.get("custom_profiles", []):
        created, segment_count = _sync_seeded_profile(db, profile)
        counts["profiles"] += created
        counts["segments"] += segment_count

    db.commit()
    return counts
