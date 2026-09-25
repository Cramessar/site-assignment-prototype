# Rolling Jira workload and assignment recommendations

## Architecture

Shifts does **not** connect directly to Atlassian Jira.

The existing `jira-analytics-app` owns:

- Jira Cloud credentials
- JQL/report execution
- retry and rate-limit handling
- Jira report history
- raw ticket storage
- project/site normalization
- canonical physical-site totals

Shifts consumes that service over its local API:

```text
Atlassian Jira
      |
      v
jira-analytics-api :3201
      |
      | canonical Sites Dashboard API
      v
shifts-workload-worker
      |
      v
Shifts PostgreSQL workload snapshot
      |
      +--> deterministic assignment balancer
      |
      +--> Muse/local-AI review
```

Default local connection:

```text
JIRA_ANALYTICS_BASE_URL=http://host.docker.internal:3201
```

This keeps the Jira API token in one application and avoids maintaining two Jira clients.

## Monthly workload window

The official assignment workload uses the previous **three complete calendar months**.

| Snapshot run | Workload period |
| --- | --- |
| October 1 | July 1 - September 30 |
| November 1 | August 1 - October 31 |
| December 1 | September 1 - November 30 |

Published plans can therefore reference one stable, reproducible workload snapshot for the month.

## Canonical site weight

Jira Analytics already groups Jira project aliases into canonical physical sites through its
`config/site_normalization.json`.

Examples handled upstream include:

```text
WMT6020 / WMT6020S2 / WMT6020S25 / BRK-6020
    -> Walmart-6020-BRK

JOL -> UNFI-JOL
IRV -> Albertsons-IRV
WMT6006 -> Walmart-6006-CLM
```

Shifts consumes those canonical site IDs.

For v1:

```text
assignment_weight = canonical site's Jira issue total during the 3-month window
```

No AI-generated weighting is used.

## Jira Analytics API calls

At monthly refresh, Shifts can first request a fresh normal Jira Analytics report:

```text
POST /api/jira/report
```

It polls:

```text
GET /api/jira/jobs/{job_id}
```

until the report completes.

If Jira Analytics already has an active report, Shifts follows that existing job rather than starting another one.

After completion, Shifts queries the existing Sites Dashboard endpoint:

```text
GET /api/runs/{run_id}/sites-dashboard
    ?date_from=2026-07-01
    &date_to=2026-09-30
```

That endpoint intentionally uses all site tickets rather than roster-only assignee tickets, which makes it the correct source for site demand.

Shifts also requests each of the three individual months so the snapshot can retain monthly context:

```text
Walmart-6020-BRK
Jul     181
Aug     194
Sep     200
--------------
Weight  575
```

The monthly values are context for supervisors and Muse; the official weight remains 575.

## Shifts environment

No Jira credentials are needed in Shifts.

```text
JIRA_ANALYTICS_ENABLED=true
JIRA_ANALYTICS_BASE_URL=http://host.docker.internal:3201
JIRA_ANALYTICS_REFRESH_REPORT=true
JIRA_ANALYTICS_POLL_SECONDS=5
JIRA_ANALYTICS_MAX_WAIT_SECONDS=1800
JIRA_ANALYTICS_TIMEOUT_SECONDS=60
```

### JIRA_ANALYTICS_REFRESH_REPORT

`true`:
- request a fresh Jira Analytics report before making the monthly snapshot.

`false`:
- use the most recent already-saved Jira Analytics report.

For the monthly first-of-month job, `true` is the recommended production setting.

## Monthly worker

Docker Compose includes:

```text
shifts-workload-worker
```

It:

1. checks for the current 3-month Shifts snapshot after startup,
2. if missing, asks Jira Analytics for fresh/current data,
3. stores the canonical site totals in Shifts PostgreSQL,
4. waits until the first day of the next month,
5. repeats at the configured local hour.

Defaults:

```text
WORKLOAD_TIMEZONE=America/New_York
WORKLOAD_REFRESH_HOUR=4
```

Snapshot creation is idempotent by workload period/source.

## Coverage requirement

The Jira Analytics report must contain the full requested three-month period.

The adapter checks the selected run's `date_min` and `date_max`. If the report does not cover the requested range, Shifts refuses to create a misleading partial workload snapshot.

The existing Jira Analytics report start date should therefore remain earlier than the oldest rolling month needed by Shifts.

## Manual validation

Confirm Jira Analytics is running:

```powershell
docker ps --filter name=jira-analytics
```

Its API should be available on the host:

```text
http://localhost:3201/health
```

Then rebuild Shifts:

```powershell
docker compose up -d --build
docker compose logs -f workload-worker
```

A supervisor can also trigger the Shifts snapshot manually:

```text
POST /api/v1/workload/refresh
```

Read the result:

```text
GET /api/v1/workload/current
```

The response contains canonical sites such as:

```json
{
  "site_id": "Walmart-6020-BRK",
  "ticket_count": 575,
  "assignment_weight": 575,
  "monthly_counts": {
    "2026-07": 181,
    "2026-08": 194,
    "2026-09": 200
  }
}
```

## Assignment recommendation

The deterministic balancer consumes:

- latest canonical site workload snapshot
- eligible engineers
- engineer capacity factors
- hard assignment locks

Endpoint:

```text
POST /api/v1/workload/current/recommend-assignments
```

The deterministic candidate exists before local AI is called.

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

Muse receives the deterministic candidate, canonical site weights, monthly subtotals, hard locks, and supervisor notes.

It can explain the plan and recommend a small number of changes, but it cannot publish or bypass deterministic validation.

## Next UI integration

The Coverage Builder should automatically construct the recommendation request from:

- selected shifts
- individual start/end times
- vacation / Off / Unavailable / Training / Meeting
- eligible engineers
- locked site ownership
- capacity policy
- latest rolling workload snapshot

The supervisor flow then becomes:

```text
Select coverage period
      -> Generate
      -> deterministic balance
      -> Muse review
      -> supervisor edits
      -> Publish
```
