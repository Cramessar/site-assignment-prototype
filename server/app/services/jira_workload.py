import asyncio
from collections import Counter
from datetime import date, timedelta
from typing import Any, AsyncIterator

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import SiteWorkloadMetric, WorkloadSnapshot
from .workload_period import previous_three_full_months


class JiraWorkloadError(RuntimeError):
    pass


class JiraClient:
    def __init__(self):
        self.settings = get_settings()
        if not self.settings.jira_enabled:
            raise JiraWorkloadError("Jira integration is disabled")
        if not self.settings.jira_base_url:
            raise JiraWorkloadError("JIRA_BASE_URL is required")
        if not self.settings.jira_email:
            raise JiraWorkloadError("JIRA_EMAIL is required")
        if not self.settings.jira_api_token:
            raise JiraWorkloadError("JIRA_API_TOKEN is required")

    def _jql(self, start: date, end: date) -> str:
        next_day = end + timedelta(days=1)
        base = self.settings.jira_jql_base.strip()
        clauses = [
            f'created >= "{start.isoformat()}"',
            f'created < "{next_day.isoformat()}"',
        ]
        if base:
            clauses.insert(0, f"({base})")
        return " AND ".join(clauses) + " ORDER BY project ASC, created ASC"

    async def _request_with_retry(self, client: httpx.AsyncClient, body: dict[str, Any]) -> dict[str, Any]:
        last_error: Exception | None = None
        for attempt in range(1, 6):
            try:
                response = await client.post("rest/api/3/search/jql", json=body)
            except httpx.HTTPError as exc:
                last_error = exc
                if attempt == 5:
                    raise JiraWorkloadError(f"Jira request failed: {exc}") from exc
                await asyncio.sleep(min(2 ** attempt, 15))
                continue

            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After", "5")
                try:
                    delay = int(retry_after or "5")
                except ValueError:
                    delay = 5
                if attempt == 5:
                    raise JiraWorkloadError("Jira rate limit persisted after 5 attempts")
                await asyncio.sleep(max(1, min(delay, 60)))
                continue

            if response.status_code >= 500 and attempt < 5:
                await asyncio.sleep(min(2 ** attempt, 15))
                continue

            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                detail = response.text[:1000]
                raise JiraWorkloadError(
                    f"Jira returned HTTP {response.status_code}: {detail}"
                ) from exc

            try:
                return response.json()
            except ValueError as exc:
                raise JiraWorkloadError("Jira returned invalid JSON") from exc

        if last_error:
            raise JiraWorkloadError(str(last_error))
        raise JiraWorkloadError("Jira request failed after retries")

    async def iter_issues(self, start: date, end: date) -> AsyncIterator[dict[str, Any]]:
        auth = httpx.BasicAuth(self.settings.jira_email, self.settings.jira_api_token)
        headers = {"Accept": "application/json", "Content-Type": "application/json"}

        async with httpx.AsyncClient(
            base_url=self.settings.jira_base_url.rstrip("/") + "/",
            timeout=self.settings.jira_timeout_seconds,
            auth=auth,
            headers=headers,
        ) as client:
            next_page_token: str | None = None
            while True:
                body: dict[str, Any] = {
                    "jql": self._jql(start, end),
                    "fields": ["project", "created"],
                    "maxResults": self.settings.jira_page_size,
                }
                if next_page_token:
                    body["nextPageToken"] = next_page_token

                payload = await self._request_with_retry(client, body)
                issues = payload.get("issues") or []
                for issue in issues:
                    yield issue

                if payload.get("isLast", False):
                    break

                next_page_token = payload.get("nextPageToken")
                if not next_page_token:
                    raise JiraWorkloadError(
                        "Jira reported more pages but did not return nextPageToken"
                    )


def _raw_site(issue: dict[str, Any]) -> str:
    fields = issue.get("fields") or {}
    project = fields.get("project") or {}
    project_name = str(project.get("name") or "").strip()
    if project_name:
        return project_name

    project_key = str(project.get("key") or "").strip()
    if project_key:
        return project_key

    issue_key = str(issue.get("key") or "").strip()
    if "-" in issue_key:
        return issue_key.split("-", 1)[0]

    return "(unknown project)"


def _created_month(issue: dict[str, Any]) -> str:
    created = str((issue.get("fields") or {}).get("created") or "")
    return created[:7] if len(created) >= 7 else "unknown"


async def collect_workload(start: date, end: date) -> dict[str, Any]:
    client = JiraClient()
    counts: Counter[str] = Counter()
    monthly_counts: dict[str, Counter[str]] = {}
    total_issues = 0

    async for issue in client.iter_issues(start, end):
        total_issues += 1
        site = _raw_site(issue)
        counts[site] += 1
        monthly_counts.setdefault(site, Counter())[_created_month(issue)] += 1

    metrics = {}
    for site, count in counts.items():
        metrics[site] = {
            "ticket_count": count,
            "assignment_weight": count,
            "open_count": 0,
            "monthly_counts": dict(sorted(monthly_counts.get(site, {}).items())),
            "priority_counts": {},
        }

    return {
        "period_start": start,
        "period_end": end,
        "source_query": client._jql(start, end),
        "total_issues": total_issues,
        "mapped_issues": total_issues,
        "unmapped_issues": 0,
        "unmapped_values": [],
        "metrics": metrics,
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
            WorkloadSnapshot.source == "jira",
        )
    )
    if existing:
        return existing

    data = await collect_workload(start, end)
    snapshot = WorkloadSnapshot(
        period_start=start,
        period_end=end,
        source="jira",
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
