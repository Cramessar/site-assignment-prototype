import asyncio
from calendar import monthrange
from datetime import date, timedelta
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import SiteWorkloadMetric, WorkloadSnapshot
from .workload_period import add_months, first_day_of_month, previous_three_full_months


class JiraWorkloadError(RuntimeError):
    pass


class JiraAnalyticsClient:
    def __init__(self):
        self.settings = get_settings()
        if not self.settings.jira_analytics_enabled:
            raise JiraWorkloadError("Jira Analytics integration is disabled")
        if not self.settings.jira_analytics_base_url:
            raise JiraWorkloadError("JIRA_ANALYTICS_BASE_URL is required")

    async def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.settings.jira_analytics_base_url.rstrip("/") + "/",
            timeout=self.settings.jira_analytics_timeout_seconds,
        )

    async def latest_run(self, client: httpx.AsyncClient) -> dict[str, Any]:
        response = await client.get("api/runs")
        response.raise_for_status()
        rows = response.json()
        if not rows:
            raise JiraWorkloadError("Jira Analytics has no saved Jira runs")
        return rows[0]

    async def refresh_report(self, client: httpx.AsyncClient) -> dict[str, Any]:
        response = await client.post("api/jira/report")

        if response.status_code == 409:
            payload = response.json()
            job = ((payload.get("detail") or {}).get("job") or {})
            job_id = job.get("job_id")
            run_id = job.get("run_id")
            if not job_id:
                raise JiraWorkloadError("Jira Analytics reported an active job without a job_id")
        else:
            response.raise_for_status()
            job = response.json()
            job_id = job.get("job_id")
            run_id = job.get("run_id")
            if not job_id:
                raise JiraWorkloadError("Jira Analytics did not return a job_id")

        waited = 0
        while waited <= self.settings.jira_analytics_max_wait_seconds:
            status_response = await client.get(f"api/jira/jobs/{job_id}")
            status_response.raise_for_status()
            status = status_response.json()
            state = str(status.get("status") or "").lower()

            if state == "completed":
                if status.get("run_id"):
                    run_id = status["run_id"]
                if not run_id:
                    raise JiraWorkloadError("Completed Jira Analytics job has no run_id")
                return {"job": status, "run_id": run_id}

            if state == "failed":
                raise JiraWorkloadError(
                    f"Jira Analytics report failed: {status.get('error') or status.get('message') or 'unknown error'}"
                )

            await asyncio.sleep(self.settings.jira_analytics_poll_seconds)
            waited += self.settings.jira_analytics_poll_seconds

        raise JiraWorkloadError("Timed out waiting for Jira Analytics report to finish")

    async def choose_run(self, client: httpx.AsyncClient) -> dict[str, Any]:
        if self.settings.jira_analytics_refresh_report:
            refreshed = await self.refresh_report(client)
            run_id = refreshed["run_id"]
            runs = await client.get("api/runs")
            runs.raise_for_status()
            row = next((item for item in runs.json() if item.get("run_id") == run_id), None)
            return row or {"run_id": run_id}
        return await self.latest_run(client)

    async def site_dashboard(
        self,
        client: httpx.AsyncClient,
        run_id: str,
        start: date,
        end: date,
    ) -> dict[str, Any]:
        response = await client.get(
            f"api/runs/{run_id}/sites-dashboard",
            params={"date_from": start.isoformat(), "date_to": end.isoformat()},
        )
        response.raise_for_status()
        return response.json()


def _month_ranges(start: date, end: date) -> list[tuple[date, date]]:
    ranges: list[tuple[date, date]] = []
    cursor = first_day_of_month(start)
    while cursor <= end:
        month_end = cursor.replace(day=monthrange(cursor.year, cursor.month)[1])
        ranges.append((max(cursor, start), min(month_end, end)))
        cursor = add_months(cursor, 1)
    return ranges


async def collect_workload(start: date, end: date) -> dict[str, Any]:
    source = JiraAnalyticsClient()

    try:
        async with await source._client() as client:
            run = await source.choose_run(client)
            run_id = str(run.get("run_id") or "")
            if not run_id:
                raise JiraWorkloadError("Jira Analytics run is missing run_id")

            total_payload = await source.site_dashboard(client, run_id, start, end)
            monthly_payloads: list[tuple[str, dict[str, Any]]] = []

            for month_start, month_end in _month_ranges(start, end):
                payload = await source.site_dashboard(client, run_id, month_start, month_end)
                monthly_payloads.append((month_start.strftime("%Y-%m"), payload))

    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:1000]
        raise JiraWorkloadError(
            f"Jira Analytics returned HTTP {exc.response.status_code}: {detail}"
        ) from exc
    except httpx.HTTPError as exc:
        raise JiraWorkloadError(f"Jira Analytics request failed: {exc}") from exc

    metrics: dict[str, dict[str, Any]] = {}

    for row in total_payload.get("sites") or []:
        site_id = str(row.get("site_key") or row.get("site_name") or "").strip()
        if not site_id:
            continue
        count = int(row.get("total") or 0)
        metrics[site_id] = {
            "ticket_count": count,
            "assignment_weight": count,
            "open_count": 0,
            "monthly_counts": {},
            "priority_counts": {},
        }

    for month, payload in monthly_payloads:
        for row in payload.get("sites") or []:
            site_id = str(row.get("site_key") or row.get("site_name") or "").strip()
            if not site_id:
                continue
            if site_id not in metrics:
                metrics[site_id] = {
                    "ticket_count": 0,
                    "assignment_weight": 0,
                    "open_count": 0,
                    "monthly_counts": {},
                    "priority_counts": {},
                }
            metrics[site_id]["monthly_counts"][month] = int(row.get("total") or 0)

    for row in metrics.values():
        for month_start, _ in _month_ranges(start, end):
            row["monthly_counts"].setdefault(month_start.strftime("%Y-%m"), 0)
        row["monthly_counts"] = dict(sorted(row["monthly_counts"].items()))

    run_date_min = str(run.get("date_min") or "")[:10]
    run_date_max = str(run.get("date_max") or "")[:10]
    if run_date_min and run_date_min > start.isoformat():
        raise JiraWorkloadError(
            f"Jira Analytics run starts at {run_date_min}, but workload period starts at {start.isoformat()}"
        )
    if run_date_max and run_date_max < end.isoformat():
        raise JiraWorkloadError(
            f"Jira Analytics run ends at {run_date_max}, but workload period ends at {end.isoformat()}"
        )

    total_issues = int(total_payload.get("total_tickets") or sum(
        metric["ticket_count"] for metric in metrics.values()
    ))

    return {
        "period_start": start,
        "period_end": end,
        "source_query": f"jira-analytics run={run_id} sites-dashboard {start.isoformat()}..{end.isoformat()}",
        "total_issues": total_issues,
        "mapped_issues": total_issues,
        "unmapped_issues": 0,
        "unmapped_values": [],
        "metrics": metrics,
        "source_run_id": run_id,
    }


async def create_monthly_snapshot(
    db: Session,
    *,
    as_of: date | None = None,
    generated_by: str = "monthly-worker",
) -> WorkloadSnapshot:
    as_of = as_of or date.today()
    start, end = previous_three_full_months(as_of)

    existing = db.scalar(
        select(WorkloadSnapshot).where(
            WorkloadSnapshot.period_start == start,
            WorkloadSnapshot.period_end == end,
            WorkloadSnapshot.source == "jira-analytics",
        )
    )
    if existing:
        return existing

    data = await collect_workload(start, end)
    snapshot = WorkloadSnapshot(
        period_start=start,
        period_end=end,
        source="jira-analytics",
        source_query=data["source_query"],
        total_issues=data["total_issues"],
        mapped_issues=data["mapped_issues"],
        unmapped_issues=data["unmapped_issues"],
        unmapped_values=data["unmapped_values"],
        generated_by=generated_by,
    )
    db.add(snapshot)
    db.flush()

    for site_id, metric in data["metrics"].items():
        db.add(
            SiteWorkloadMetric(
                snapshot_id=snapshot.id,
                site_id=site_id,
                ticket_count=metric["ticket_count"],
                assignment_weight=metric["assignment_weight"],
                open_count=metric["open_count"],
                monthly_counts=metric["monthly_counts"],
                priority_counts=metric["priority_counts"],
            )
        )

    db.commit()
    db.refresh(snapshot)
    return snapshot
