# Site Coverage Manager — Prototype v10.1

v10 separates the prototype into focused pages and changes site assignment publication from a daily plan to an **operational-week plan**.

## Run locally

From PowerShell:

```powershell
cd path\to\site-assignment-prototype-v10
python -m http.server 8080
```

Open `http://localhost:8080`.

## Pages

- `index.html` — **Weekly Site Assignments** (public/read-only). This is the main team page. It shows one compact table with engineers as rows, coverage windows as columns, site chips, handoff highlighting, and TSA support.
- `calendar.html` — **Staffing Calendar** (public/read-only). Staffing is intentionally separate from site assignments.
- `manage.html` — **Supervisor Coverage Builder**. Select one or more shifts, generate a stable operational-week plan, preview it, and publish it to the team.
- `staffing.html` — **Staffing Editor**. Date-specific exceptions such as 12-hour days, half-days, late starts, early departures, Training/Meeting, or Off.
- `organization.html` — **Organization & Shift Setup**. Configure default hours and active days for each operational shift.

The previous all-in-one supervisor page is retained as `advanced.html` only as a reference while the prototype is being split apart.

## Weekly assignment behavior

Site assignments are now published as a weekly base plan rather than regenerated every day.

Examples with the current shift defaults:

- Weekend Day + Weekend Mid: **Friday through Monday**
- Weekday Morning + Weekday Mid: **Monday through Thursday**
- Weekday Night: **Monday through Friday**

The operational period is derived from the active-day settings in Organization, so changing a shift's workdays changes future generated assignment periods.

### Daily exceptions do not silently rewrite the week

A supervisor can still make a Sunday half-day or a Friday 12-hour exception in Staffing Editor. Those changes appear on the Staffing Calendar but the team's published weekly site assignment remains stable. This keeps the assignment list predictable for the team and makes unusual days an explicit supervisor exception instead of a surprise site reshuffle.

Changing a normal shift default, vacation state, assignment rule, or workload data marks an existing weekly plan as needing regeneration.

## Assignment table

The public assignment table is designed around the original Excel workflow:

- one row per engineer
- one column per generated coverage window
- normal site chips = site stays with that engineer
- orange site chips = site hands off in the next window
- green site chips = engineer takes that site over in the current window
- TSA coverage is shown in the final column and can change by window

Weekend Day + Weekend Mid still preserves the approved ~60/40 ticket-workload split during overlap. Other selected shift combinations balance workload using the active engineer count per shift and the 30-day site ticket weights.

## Persistence

The prototype still uses browser `localStorage`. v10 uses `site-coverage-manager-v10` and can migrate state from the v9 local-storage key on first load.

A shared backend/database is still required before multiple supervisors and team members on different computers can see the same live state.

## Tests

Run:

```powershell
node tests.js
```

Tests cover the original 38-site assignment engine, TSA logic, scheduling, configurable shift days/hours, multi-shift coverage, overnight shifts, supervisor inheritance, and v10 operational-week persistence.


## v10.1 hotfix
- Restored Vacation / Return from vacation controls in Staffing Editor.
- Engineer vacations use the existing workload rebalance logic.
- TSA vacations rebalance TSA support.
- Directory-only roster members can also be marked on/off vacation.
- Public Staffing Calendar remains read-only.


## v10.2 hotfix — daily non-working redistribution

The weekly assignment remains the stable source of truth, but the public Site Assignments page now applies the selected day's staffing state on top of that base plan. If an engineer is marked **Off**, **Unavailable**, **Training**, **Meeting**, or **Vacation**, that engineer is removed from active coverage for the affected day/window and their sites are redistributed among engineers who are actually working. TSA non-working statuses are handled the same way for support assignments.

Date-specific schedule changes do not mutate the stored weekly plan. Returning the employee to Working/default hours automatically restores the normal weekly-base behavior for unaffected windows.
