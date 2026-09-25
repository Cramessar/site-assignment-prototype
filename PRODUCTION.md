# Production roadmap

The existing repository already contains valuable domain logic: workload weighting, shifts, vacations/non-working states, TSA support, assignment locks, operational-week plans, and multi-shift handoffs. The production path should preserve that logic while replacing browser-only persistence and hard-coded data sources.

## Foundation added on `feat/production-foundation`

- FastAPI service in `server/`
- PostgreSQL persistence
- immutable workspace revision history
- optimistic concurrency (stale updates return HTTP 409)
- viewer / supervisor / admin roles
- Docker Compose and nginx
- CI for JavaScript tests, API tests, and container builds
- health/readiness endpoints

The static browser app still uses localStorage on this branch. The next milestone is an API-backed state adapter so we can migrate screens without rewriting the assignment engine.

## Local development

```powershell
Copy-Item .env.example .env
docker compose up --build
```

- Web: http://localhost:8080
- API docs: http://localhost:8081/docs
- Health: http://localhost:8081/healthz

## Target architecture

```text
Team browser
    |
    | company SSO
    v
Web application
    |
    v
FastAPI
    |-- permissions
    |-- scheduling / assignment services
    |-- workload imports
    |-- reports / exports
    |-- audit trail
    v
PostgreSQL
```

## Delivery plan

### 1. Shared truth
Replace localStorage with the API.

Acceptance criteria:
- two browsers see the same assignments
- vacations/status changes propagate to other users
- concurrent edits cannot silently overwrite one another
- every save records actor, timestamp, revision, and optional note

### 2. Company identity
Use company SSO (for a Microsoft environment, Entra ID is a natural fit) at the platform/reverse-proxy layer.

Roles:
- viewer: assignments + staffing calendar
- supervisor: staffing changes + generate/publish plans
- admin: roster, shifts, site/workload configuration, permissions

The API never trusts a browser-provided role.

### 3. Normalize the data model
The single JSON workspace is a migration bridge. Move to relational entities:
- people
- teams/shifts/supervisors
- recurring schedules
- daily availability exceptions
- sites + aliases
- workload snapshots
- assignment locks
- operational weeks
- generated plan versions
- site assignments per coverage window
- TSA assignments
- notes
- audit events

### 4. Workload ingestion
Hard-coded `tickets30` must become versioned workload snapshots.

Each snapshot should record:
- source and import timestamp
- canonical site
- Jira aliases
- raw ticket count by family
- total tickets
- workload score
- reporting period

Plans should reference the exact workload snapshot used to generate them.

### 5. Operational reports
Generate the artifacts the team already understands:
- Fri-Sun / operational-week assignment grid
- temporary coverage and handoff times
- TSA assignment table
- workload per engineer
- missing/duplicate coverage
- rebalance before/after diff
- Excel/PDF/print views

### 6. Product UI
Move the static pages into a component application after the API contract is stable.

Recommended screens:
- My Assignments
- Team Assignment Board
- Staffing Calendar
- Coverage Builder
- Workload Explorer
- Organization / Roster
- Site Catalog
- Audit History
- Admin / Integrations

## Business rules that must remain regression-tested

- Carolyn -> BRK and other assignment locks
- workload balancing is based on workload, not site count
- vacation / Off / Training / Meeting / Unavailable remove someone from affected coverage
- weekly assignments are the base plan and daily exceptions are overlays
- handoffs occur at real staffing boundaries
- supervisors/managers do not receive engineer site ownership
- TSA ownership is separate from site ownership
- overnight shifts cross midnight
- published plans must be reproducible

## Reproducible-plan principle

A published plan should eventually reference:
1. roster version
2. shift configuration version
3. workload snapshot
4. assignment locks
5. availability snapshot
6. algorithm version
7. generated result
8. manual overrides
9. publisher
10. publish timestamp

That is the line between a scheduling helper and an operational system the company can trust.
