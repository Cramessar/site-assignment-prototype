# Site Coverage Manager — Prototype v7

A browser-based prototype for site assignment, TSA support, multi-shift staffing calendars, supervisors, and date-aware daily coverage planning.

## Run it

Open `index.html` directly, or serve the folder locally:

```powershell
cd path\to\site-assignment-prototype-v7
python -m http.server 8080
```

Then open `http://localhost:8080`.

- `index.html` — clean, read-only team view
- `manage.html` — supervisor / manager console

No packages or database are required. Prototype state is stored in browser localStorage.

## v7 additions

### Full operational roster
The staffing calendar now contains the supplied 53-person roster plus three people retained from the working prototype because they were not present in the latest roster table: Youssef, Bryan, and Ola.

The current Weekend coverage identities were reconciled to the roster where possible, including:

- Ryan Jackson — Weekend Day TSA
- Ryan Mine — separate Weekday Mid Sr TSE
- Garret Bishop — Weekend Mid TCE
- Chad Cruz Jr., Bronson Wong, Carolyn Shin, David Lewis, Joshua Benson, Cameron McCreery, and Krysztof Capuras

### Named shifts and supervisors
The organization layer now includes:

- Weekday Morning — Matthew Weimer (TSS)
- Weekday Mid — Chaitanya Jagarapu (TSS)
- Weekday Night — Oluwafemi Okediran (TSS)
- Weekend Day — Christopher (derived from the roster Manager column)
- Weekend Mid — Stephen Parker (TSS)
- Weekend Night — Guillermo Rodriguez (TSS)
- Commissioning — Michael Westfield (Manager)
- Leader — Brian shown as the leadership supervisor because Tony Rodriguez and Michael Westfield both list Brian as manager
- Unassigned — Andrea Capuras remains here because no shift was supplied

The original Manager value is also preserved per person, even when it differs from the shift supervisor.

### Shift Setup
The supervisor console has a Shift Setup section. Default start/end times can be configured for each operational shift without editing code.

Known defaults are seeded only where previously established:

- Weekend Day: 6:00 AM–4:00 PM
- Weekend Mid: 12:00 PM–8:00 PM

Other shifts intentionally begin with **Hours not configured** rather than guessed schedules.

### Overnight shifts
Shift defaults and individual daily exceptions support crossing midnight. For example, `8:00 PM → 6:00 AM` is treated as a 10-hour shift.

### Team-facing organization view
Employees can now:

- select anyone in the full roster
- see their operational shift
- see their listed manager
- see their shift supervisor
- see configured default hours and date-specific exceptions
- see a Shift Supervisors directory

People whose shifts do not yet participate in the 38-site assignment engine still get a useful roster/schedule profile instead of a fake site assignment.

## Existing v6 functionality retained

- 38 workbook sites and 1,926-ticket workload model
- Weekend Day full coverage and Weekend Mid takeover model
- approximately 60/40 workload split during the current 12–4 overlap
- vacation-based rebalance
- configurable site locks, including BRK → Carolyn
- TSA support and fallback for the current coverage teams
- date-aware Daily Plans
- preview/apply workflow
- Coverage Health
- dynamic handoffs
- Scenario Mode
- Undo and recent change history
- daily notes and availability statuses
- historical fairness tracking
- read-only team assignment page

## Important current boundary

The new shifts are now part of the **staffing and organizational calendar**, but the 38 existing sites are still intentionally assigned only through the validated Weekend Day / Weekend Mid coverage engine. We have not invented site ownership, workload targets, or TSA rules for the newly added shifts.

That gives us a safe next step: define which site pool each additional shift participates in, its handoff relationship, and its workload target before connecting it to automatic Daily Plan assignment.

## Tests

Run:

```powershell
node tests.js
```

The v7 tests cover the original assignment/TSA/Daily Plan behavior plus full-roster loading, shift-supervisor mapping, unconfigured default hours, shift-default editing, identity separation for the two Ryans, and overnight shifts.
