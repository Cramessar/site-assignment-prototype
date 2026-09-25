# Rolling Jira workload and assignment recommendations

## Monthly workload window

The system uses the previous **three complete calendar months** as the official site-assignment workload.

Examples:

| Snapshot run | Workload period |
| --- | --- |
| October 1 | July 1 - September 30 |
| November 1 | August 1 - October 31 |
| December 1 | September 1 - November 30 |

This deliberately changes only once per month. Published assignment plans can therefore reference a stable, reproducible workload snapshot.

## Version 1 assignment weight

For v1:

```text
assignment_weight = total Jira issues for the site during the 3-month period
```

The snapshot also stores:

- monthly issue counts
- currently unresolved issue count
- priority distribution
- Jira values that could not be mapped to a canonical site

Those additional fields are visible for analysis but do **not** change assignment weight yet. That keeps the first model transparent and comparable to the spreadsheet process that already works.

## Jira integration

The worker supports:

- Jira Cloud enhanced JQL search
- Jira Data Center JQL search
- bearer-token authentication
- basic email/API-token authentication
- custom Jira site fields
- canonical site aliases

Required environment values:

```text
JIRA_ENABLED=true
JIRA_BASE_URL=https://jira.example.com
JIRA_DEPLOYMENT=data_center
JIRA_AUTH_MODE=bearer
JIRA_BEARER_TOKEN=...
JIRA_JQL_BASE=...
JIRA_SITE_FIELD=customfield_12345
```

For Jira Cloud, use:

```text
JIRA_DEPLOYMENT=cloud
JIRA_AUTH_MODE=basic
JIRA_EMAIL=...
JIRA_API_TOKEN=...
```

The application appends the date range to `JIRA_JQL_BASE`, so credentials and query configuration never need to change month to month.

## Site mapping

Canonical site IDs live in:

```text
server/config/sites.json
```

Known Jira/display aliases live in:

```text
server/config/site_aliases.json
```

Unknown Jira site values are retained in each snapshot's `unmapped_values` report rather than silently discarded.

## Schedule

The `shifts-workload-worker` container:

1. checks for the current snapshot immediately at startup,
2. creates it if missing,
3. waits until the 1st of the next month,
4. refreshes at `WORKLOAD_REFRESH_HOUR` in `WORKLOAD_TIMEZONE`.

Default:

```text
WORKLOAD_TIMEZONE=America/New_York
WORKLOAD_REFRESH_HOUR=4
```

The period is idempotent: restarting the container does not create duplicate snapshots.

## Manual testing

After Jira is configured:

```powershell
docker compose up -d --build
docker compose logs -f workload-worker
```

A supervisor can also trigger the current rolling period manually:

```text
POST /api/v1/workload/refresh
```

Read the latest snapshot:

```text
GET /api/v1/workload/current
```

List historical snapshots:

```text
GET /api/v1/workload/snapshots
```

## Assignment recommendation

The deterministic balancer takes:

- the latest site workload snapshot,
- eligible engineers,
- a capacity factor for each engineer,
- locked assignments.

It produces a complete site assignment before AI is involved.

```text
POST /api/v1/workload/current/recommend-assignments
```

Example request:

```json
{
  "engineers": [
    {"id": "carolyn", "name": "Carolyn", "capacity": 1.0},
    {"id": "bronson", "name": "Bronson", "capacity": 1.0},
    {"id": "david", "name": "David", "capacity": 1.0},
    {"id": "krysztof", "name": "Krysztof", "capacity": 1.0}
  ],
  "locks": [
    {"person_id": "carolyn", "site_id": "BRK - 6020"},
    {"person_id": "bronson", "site_id": "UNFI-JOL"}
  ],
  "notes": "Keep the senior cohort near the same workload.",
  "use_ai": true
}
```

Capacity is intentionally separate from scheduled hours. If four senior engineers should carry similar primary workload even when two work 12-hour shifts, give all four a capacity of `1.0`. If a team intentionally wants a longer-shift engineer to carry more, increase that person's capacity.

## Local model selection

The assignment reviewer calls the existing Ramessar gateway's `/v1/models` endpoint.

Preference order:

1. `AI_ASSIGNMENT_MODEL`
2. `muse-glimmer:latest`
3. another installed `muse-glimmer` tag
4. `reasoning`
5. `auto`
6. normal gateway default

Default:

```text
AI_ASSIGNMENT_MODEL=muse-glimmer:latest
```

The AI receives the deterministic candidate, site workload detail, supervisor notes, and locks. It can recommend a small number of operationally sensible changes, but it cannot publish the plan or bypass deterministic constraints.

## Next integration step

The Coverage Builder UI should automatically construct the eligible-engineer/capacity request from the selected shifts, schedules, vacations, and date-specific availability. That will connect the existing calendar logic directly to the monthly workload engine without asking a supervisor to type engineer inputs manually.
