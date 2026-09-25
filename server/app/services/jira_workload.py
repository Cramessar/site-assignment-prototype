import json
import re
from collections import Counter
from datetime import date, timedelta
from pathlib import Path
from typing import Any, AsyncIterator

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import SiteWorkloadMetric, WorkloadSnapshot
from .workload_period import previous_three_full_months


class JiraWorkloadError(RuntimeError):
    pass


def _normalized(value: str) -> str:
    return re.sub(r"[^A-Z0-9]+", "", str(value or "").upper())


def _display_value(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value.strip() or None
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, dict):
        for key in ("value", "name", "displayName", "key"):
            if value.get(key):
                return str(value[key]).strip()
        return None
    return str(value).strip() or None


class SiteMapper:
    def __init__(self, sites_path: str = "/app/config/sites.json", aliases_path: str | None = None):
        settings = get_settings()
        aliases_path = aliases_path or settings.jira_alias_file
        self.sites = json.loads(Path(sites_path).read_text(encoding="utf-8"))
        alias_data = {}
        alias_file = Path(aliases_path)
        if alias_file.exists():
            alias_data = json.loads(alias_file.read_text(encoding="utf-8"))

        self.lookup: dict[str, str] = {}
        for site_id in self.sites:
            self.lookup[_normalized(site_id)] = site_id
        for site_id, aliases in alias_data.items():
            if site_id not in self.sites:
                continue
            for alias in aliases or []:
                self.lookup[_normalized(alias)] = site_id

    def map_values(self, values: list[str]) -> tuple[str | None, list[str]]:
        mapped: list[str] = []
        unknown: list[str] = []
        for value in values:
            site_id = self.lookup.get(_normalized(value))
            if site_id:
                if site_id not in mapped:
                    mapped.append(site_id)
            elif value:
                unknown.append(value)
        return (mapped[0] if mapped else None), unknown


class JiraClient:
    def __init__(self):
        self.settings = get_settings()
        if not self.settings.jira_enabled:
            raise JiraWorkloadError("Jira integration is disabled")
        if not self.settings.jira_base_url:
            raise JiraWorkloadError("JIRA_BASE_URL is required")
        if not self.settings.jira_jql_base:
            raise JiraWorkloadError("JIRA_JQL_BASE is required")
        if not self.settings.jira_site_field:
            raise JiraWorkloadError("JIRA_SITE_FIELD is required")

    def _auth(self):
        mode = self.settings.jira_auth_mode.lower()
        if mode == "basic":
            if not self.settings.jira_email or not self.settings.jira_api_token:
                raise JiraWorkloadError("JIRA_EMAIL and JIRA_API_TOKEN are required for basic auth")
            return httpx.BasicAuth(self.settings.jira_email, self.settings.jira_api_token)
        return None

    def _headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if self.settings.jira_auth_mode.lower() == "bearer":
            if not self.settings.jira_bearer_token:
                raise JiraWorkloadError("JIRA_BEARER_TOKEN is required for bearer auth")
            headers["Authorization"] = f"Bearer {self.settings.jira_bearer_token}"
        return headers

    def _jql(self, start: date, end: date) -> str:
        next_day = end + timedelta(days=1)
        return (
            f"({self.settings.jira_jql_base}) "
            f'AND created >= "{start.isoformat()}" '
            f'AND created < "{next_day.isoformat()}" '
            "ORDER BY created ASC"
        )

    async def iter_issues(self, start: date, end: date) -> AsyncIterator[dict[str, Any]]:
        deployment = self.settings.jira_deployment.lower()
        fields = [
            self.settings.jira_site_field,
            "priority",
            "status",
            "created",
            "resolution",
            "resolutiondate",
            "issuetype",
        ]
        async with httpx.AsyncClient(
            base_url=self.settings.jira_base_url.rstrip("/"),
            timeout=self.settings.jira_timeout_seconds,
            verify=self.settings.jira_verify_ssl,
            auth=self._auth(),
            headers=self._headers(),
        ) as client:
            if deployment == "cloud":
                token: str | None = None
                while True:
                    body: dict[str, Any] = {
                        "jql": self._jql(start, end),
                        "fields": fields,
                        "maxResults": self.settings.jira_page_size,
                    }
                    if token:
                        body["nextPageToken"] = token
                    response = await client.post("/rest/api/3/search/jql", json=body)
                    response.raise_for_status()
                    payload = response.json()
                    for issue in payload.get("issues", []):
                        yield issue
                    token = payload.get("nextPageToken")
                    if not token or payload.get("isLast") is True:
                        break
            else:
                start_at = 0
                while True:
                    body = {
                        "jql": self._jql(start, end),
                        "fields": fields,
                        "maxResults": self.settings.jira_page_size,
                        "startAt": start_at,
                    }
                    response = await client.post("/rest/api/2/search", json=body)
                    response.raise_for_status()
                    payload = response.json()
                    issues = payload.get("issues", [])
                    for issue in issues:
                        yield issue
                    start_at += len(issues)
                    total = int(payload.get("total") or 0)
                    if not issues or start_at >= total:
                        break


def _site_values(fields: dict[str, Any], field_name: str) -> list[str]:
    raw = fields.get(field_name)
    values = raw if isinstance(raw, list) else [raw]
    out: list[str] = []
    for value in values:
        rendered = _display_value(value)
        if rendered:
            out.append(rendered)
    return out


def _priority_name(fields: dict[str, Any]) -> str:
    priority = fields.get("priority")
    if isinstance(priority, dict):
        return str(priority.get("name") or priority.get("id") or "Unknown")
    return _display_value(priority) or "Unknown"


def _is_open(fields: dict[str, Any]) -> bool:
    if fields.get("resolution") is not None or fields.get("resolutiondate"):
        return False
    status = fields.get("status")
    if isinstance(status, dict):
        category = status.get("statusCategory") or {}
        if str(category.get("key") or "").lower() == "done":
            return False
    return True


def _created_month(fields: dict[str, Any]) -> str:
    created = str(fields.get("created") or "")
    return created[:7] if len(created) >= 7 else "unknown"


async def collect_workload(start: date, end: date) -> dict[str, Any]:
    settings = get_settings()
    mapper = SiteMapper()
    client = JiraClient()

    metrics = {
        site_id: {
            "ticket_count": 0,
            "assignment_weight": 0,
            "open_count": 0,
            "monthly_counts": Counter(),
            "priority_counts": Counter(),
        }
        for site_id in mapper.sites
    }
    unmapped = Counter()
    total_issues = 0
    mapped_issues = 0

    try:
        async for issue in client.iter_issues(start, end):
            total_issues += 1
            fields = issue.get("fields") or {}
            raw_values = _site_values(fields, settings.jira_site_field)
            site_id, unknown = mapper.map_values(raw_values)

            if not site_id:
                unmapped.update(unknown or ["(missing site field)"])
                continue

            mapped_issues += 1
            row = metrics[site_id]
            row["ticket_count"] += 1
            row["assignment_weight"] += 1
            if _is_open(fields):
                row["open_count"] += 1
            row["monthly_counts"][_created_month(fields)] += 1
            row["priority_counts"][_priority_name(fields)] += 1
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:1000]
        raise JiraWorkloadError(f"Jira returned HTTP {exc.response.status_code}: {detail}") from exc
    except httpx.HTTPError as exc:
        raise JiraWorkloadError(f"Jira request failed: {exc}") from exc

    for row in metrics.values():
        row["monthly_counts"] = dict(sorted(row["monthly_counts"].items()))
        row["priority_counts"] = dict(row["priority_counts"])

    return {
        "period_start": start,
        "period_end": end,
        "source_query": client._jql(start, end),
        "total_issues": total_issues,
        "mapped_issues": mapped_issues,
        "unmapped_issues": total_issues - mapped_issues,
        "unmapped_values": [{"value": key, "count": count} for key, count in unmapped.most_common()],
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
