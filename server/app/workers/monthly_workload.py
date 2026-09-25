import asyncio
from datetime import datetime
from zoneinfo import ZoneInfo

from ..config import get_settings
from ..db import SessionLocal
from ..services.jira_workload import JiraWorkloadError, create_monthly_snapshot


def _next_month_start(now: datetime, hour: int) -> datetime:
    if now.month == 12:
        return datetime(now.year + 1, 1, 1, hour, 0, tzinfo=now.tzinfo)
    return datetime(now.year, now.month + 1, 1, hour, 0, tzinfo=now.tzinfo)


async def _ensure_snapshot() -> None:
    settings = get_settings()
    if not settings.jira_enabled:
        print("Jira workload worker is disabled; set JIRA_ENABLED=true to enable monthly refresh.", flush=True)
        return

    db = SessionLocal()
    try:
        snapshot = await create_monthly_snapshot(db, generated_by="monthly-worker")
        print(
            f"Workload snapshot ready: id={snapshot.id} "
            f"{snapshot.period_start} through {snapshot.period_end} "
            f"issues={snapshot.total_issues} mapped={snapshot.mapped_issues}",
            flush=True,
        )
    except JiraWorkloadError as exc:
        db.rollback()
        print(f"Jira workload refresh failed: {exc}", flush=True)
    except Exception as exc:
        db.rollback()
        print(f"Unexpected workload refresh failure: {exc}", flush=True)
    finally:
        db.close()


async def main() -> None:
    settings = get_settings()
    tz = ZoneInfo(settings.workload_timezone)

    # Catch up immediately after restarts. The snapshot creator is idempotent for a period.
    await _ensure_snapshot()

    while True:
        now = datetime.now(tz)
        next_run = _next_month_start(now, settings.workload_refresh_hour)
        seconds = max(60, (next_run - now).total_seconds())
        print(f"Next Jira workload refresh: {next_run.isoformat()}", flush=True)
        await asyncio.sleep(seconds)
        await _ensure_snapshot()


if __name__ == "__main__":
    asyncio.run(main())
