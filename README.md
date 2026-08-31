# Site Coverage Manager — Prototype v6

A browser-based prototype for site assignment, TSA support, staffing calendars, and date-aware daily coverage planning.

## Run it

Open `index.html` directly, or serve the folder locally:

```powershell
cd path\to\site-assignment-prototype-v6
python -m http.server 8080
```

Then open `http://localhost:8080`.

- `index.html` — clean, read-only team view
- `manage.html` — supervisor / manager console

No packages or database are required. State is stored in the browser's localStorage for prototype testing.

## v6 additions

### Daily Plan engine
The staffing calendar now generates date-aware coverage windows based on actual engineer start/end times. A normal day creates:

- 6:00 AM–12:00 PM — morning owns full site coverage
- 12:00 PM–4:00 PM — morning/midday workload targets approximately 60/40
- 4:00 PM–8:00 PM — midday owns full site coverage

Half days, late starts, early departures, and 12-hour shifts automatically create additional boundaries and handoffs.

### Preview + Apply
Supervisor staffing changes generate a candidate Daily Plan. The console compares it with the currently applied plan and shows how many site-window and TSA-window assignments would change before publishing it.

### Coverage Health
The Daily Plan checks:

- full site coverage in every generated window
- TSA availability for every working engineer
- overlap workload split
- assignment-lock compliance
- no-engineer coverage gaps

### Dynamic handoffs
The console lists site and TSA handoffs at each staffing boundary rather than assuming every transition happens exactly at noon or 4 PM.

### Assignment locks
Supervisors can configure locked site-to-engineer relationships. `BRK - 6020 → Carolyn` is seeded as the first lock. A lock is honored only while the owner is actually available; once the owner leaves, the Daily Plan creates a real handoff instead of leaving the site uncovered.

### Scenario Mode
Scenario Mode makes temporary staffing, vacation, TSA, note, and assignment changes without publishing them to localStorage. Use **Apply scenario & plan** to commit the scenario, or **Discard scenario** to return to the live state.

### Undo + change history
Committed supervisor changes maintain an in-session Undo stack and a small persistent recent-change log.

### Daily notes
Each date supports:

- a general team note
- person-specific supervisor notes

The team-facing assignment view shows relevant notes.

### Availability status
In addition to shift start/end and Off/Vacation, a person can be marked:

- Working
- Training
- Meeting
- Unavailable

Training, Meeting, and Unavailable remove that person from generated coverage for the displayed shift. For a partial-day event, adjust the person's working start/end time and add a note describing the exception.

### Historical fairness
Each applied Daily Plan stores ticket-weighted coverage-hours by engineer. The supervisor console shows Today / 7-day / 30-day totals. This is a planning fairness proxy based on the workbook's 30-day ticket volume, not actual ticket production.

### Team view
The employee page now prioritizes the applied Daily Plan and shows each engineer's actual coverage windows, sites, workload weight, and TSA for that period. TSAs see the engineers they support by generated time window.

## Existing rules retained

- 38 workbook sites
- ticket workload sourced from the workbook's second sheet
- morning full coverage
- approximately 60/40 morning/midday workload during overlap
- vacations automatically rebalance baseline sites and TSA support
- Carolyn/BRK protection, now represented as a configurable lock
- morning and midday TCE/TSE roles
- Ryan + Amin morning TSAs; Ola midday TSA
- cross-shift TSA pairings and fallbacks
- duplicate and missing-site diagnostics

## Tests

Run:

```powershell
node tests.js
```

The v6 test suite covers the original site/TSA logic plus daily windows, 60/40 dynamic overlap, BRK lock handoff behavior, half days, availability states, plan staleness, notes, configurable locks, and fairness-history recording.
