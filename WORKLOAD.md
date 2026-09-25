# Rolling Jira workload and assignment recommendations

## Monthly workload window

The system uses the previous **three complete calendar months** as the official site-assignment workload.

| Snapshot run | Workload period |
| --- | --- |
| October 1 | July 1 - September 30 |
| November 1 | August 1 - October 31 |
| December 1 | September 1 - November 30 |

This changes only once per month so published assignments can reference a stable, reproducible workload snapshot.

## Version 1 workload

The Jira pull is intentionally simple:

```text
raw site = Jira project.name
assignment weight = number of matching Jira issues for that project
```

The API also keeps the three monthly subtotals so supervisors and Muse can see whether a site's volume is moving up or down, but the official assignment weight is only the 3-month total.

Example response:

```json
{
  "period_start": "2026-07-01",
  "period_end": "2026-09-30",
  "sites": [
    {
      "raw_site": "Walmart-6020-BRK",
      "ticket_count": 575,
      "assignment_weight": 575,
      "monthly_counts": {
        "2026-07": 181,
        "2026-08": 194,
        "2026-09": 200
      }
    }
  ]
}
```

## Jira connection

This uses the same Atlassian Cloud pattern as the existing Jira report:

```text
JIRA_BASE_URL=https://symbotic.atlassian.net
JIRA_EMAIL=
JIRA_API_TOKEN=
JIRA_PAGE_SIZE=100
JIRA_TIMEOUT_SECONDS=60
```

The token stays only in the server's local `.env`; do not commit it.

The default report population matches the existing report:

```text
JIRA_JQL_BASE=assignee IS NOT EMPTY AND cf[22087] IS NOT EMPTY
```

The worker automatically appends the previous three full calendar months, for example:

```text
(assignee IS NOT EMPTY AND cf[22087] IS NOT EMPTY)
AND created >= "2026-07-01"
AND created < "2026-10-01"
ORDER BY project ASC, created ASC
```

Only these Jira fields are requested:

```text
project
created
```

The worker does not parse assignees, roster data, Cells Impacted, status, or ticket details for this workload calculation.

## Why project name is the raw site

The existing Jira report already reads each issue's Jira project key and project name separately. For the first production version, the project name is the raw site identifier.

We intentionally do not map raw Jira names to the shorter Site Coverage labels yet. First run the real report and inspect the exact project-name list. Then build a small verified mapping such as:

```text
Walmart-6020-BRK -> BRK - 6020
Walmart-6010-DOUG -> DOUG-6010
```

That avoids guessing aliases before seeing the live Jira data.

## Monthly worker

Docker Compose includes:

```text
shifts-workload-worker
```

It:

1. checks for the current rolling snapshot immediately after startup,
2. creates it if missing,
3. waits until the first day of the next month,
4. refreshes at the configured local hour.

Defaults:

```text
WORKLOAD_TIMEZONE=America/New_York
WORKLOAD_REFRESH_HOUR=4
```

Snapshots are historical. A new month creates a new snapshot instead of overwriting the previous one.

## Manual first-run validation

Before enabling the unattended job, configure Jira in `.env`:

```text
JIRA_ENABLED=true
JIRA_BASE_URL=https://symbotic.atlassian.net
JIRA_EMAIL=your-email
JIRA_API_TOKEN=your-token
JIRA_PAGE_SIZE=100
JIRA_TIMEOUT_SECONDS=60
```

Rebuild:

```powershell
docker compose up -d --build
```

Watch the pull:

```powershell
docker compose logs -f workload-worker
```

Or trigger it manually as a supervisor:

```text
POST /api/v1/workload/refresh
```

Read the current snapshot:

```text
GET /api/v1/workload/current
```

The first acceptance test is simple: compare the raw Jira project names and three-month totals to the existing report/spreadsheet before using them for assignments.

## Assignment recommendation

The deterministic balancer consumes the latest snapshot and:

- eligible engineers,
- capacity factor per engineer,
- locked assignments.

Endpoint:

```text
POST /api/v1/workload/current/recommend-assignments
```

The deterministic plan is created before local AI is involved.

## Muse review

The app queries the existing Ramessar gateway's `/v1/models` endpoint and prefers:

1. `AI_ASSIGNMENT_MODEL`
2. `muse-glimmer:latest`
3. another installed Muse tag
4. `reasoning`
5. `auto`

Default:

```text
AI_ASSIGNMENT_MODEL=muse-glimmer:latest
```

Muse receives:

- the deterministic candidate,
- raw site weights,
- monthly subtotals,
- assignment locks,
- supervisor notes.

It can explain the candidate and recommend a small number of swaps, but it cannot publish the plan or bypass deterministic rules.

## Next step after the first Jira pull

Use the real raw project-name list to create a verified Jira-project-to-Site-Coverage mapping. Then wire the Coverage Builder to automatically send its eligible engineers, vacations, individual schedules, locks, and the latest workload snapshot into the recommendation endpoint.
