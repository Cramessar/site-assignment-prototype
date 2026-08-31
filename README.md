# Site Coverage Manager — Prototype v9

A browser-based operations prototype for multi-shift staffing, site assignment, TSA support, daily scheduling, and workload-balanced handoffs.

## Run it

Open `index.html` directly, or serve the folder locally:

```powershell
cd path\to\site-assignment-prototype-v9
python -m http.server 8080
```

Then open `http://localhost:8080`.

- `index.html` — read-only team view
- `manage.html` — supervisor / manager console

No packages or database are required. Prototype state is stored in browser localStorage.

## v9 additions

### Configurable shift schedules
Every operational shift now has editable default hours **and active days**.

Seeded defaults:

- Weekday Morning — 6:00 AM–4:00 PM, Monday–Thursday
- Weekday Mid — 12:00 PM–8:00 PM, Monday–Thursday
- Weekday Night — 8:00 PM–6:00 AM, Monday–Friday
- Weekend Day — 6:00 AM–4:00 PM, Friday–Monday
- Weekend Mid — 12:00 PM–8:00 PM, Friday–Monday
- Weekend Night — 8:00 PM–6:00 AM, Friday–Monday
- Commissioning — 9:00 AM–5:00 PM, Monday–Friday
- Leadership — 9:00 AM–5:00 PM, Monday–Friday

A supervisor can change both time and days from **Shift Setup & Supervisors**. Changes immediately affect calendar visibility and Coverage Builder eligibility.

Individual date-specific schedule exceptions still work, including scheduling someone on a day their shift is normally inactive.

### Supervisor-based shift inheritance
Andrea Capuras still has no explicit shift in the supplied roster, but because she reports to Guillermo Rodriguez she inherits the Weekend Night operational shift and its schedule.

### Multi-shift Coverage Builder
The supervisor console now has an on-demand Coverage Builder.

For the selected calendar date, a supervisor can:

1. select one or more active operational shifts
2. generate a preview
3. review site coverage, TSA coverage, workload distribution, and handoffs
4. publish that coverage plan to the team-facing page

The builder supports Weekday, Weekend, Mid, Night, and Commissioning teams without maintaining separate assignment engines for each one.

### How generic site balancing works
- Only TCE/TSE staff receive site ownership.
- Shift supervisors and managers are excluded from site assignment.
- TSAs are assigned as the support layer whenever they are scheduled in the selected coverage window.
- Sites are weighted using the existing 30-day ticket volume.
- Existing assignment locks are honored whenever the locked engineer is active in the selected shifts.
- Weekend Day + Weekend Mid retains the approved ~60/40 ticket-workload rule during overlap.
- Other shift combinations use active engineer headcount to establish shift-level workload share, which keeps per-person workload approximately equitable.
- Selected shifts generate automatic time windows and handoffs from their actual start/end times.
- Overnight shifts are supported.

Example: selecting Weekend Mid (12 PM–8 PM) and Weekend Night (8 PM–6 AM) creates an automatic 8 PM handoff of the 38-site pool.

### Published team coverage
A published multi-shift plan is date-specific. The team-facing page prefers that published plan and shows each participating engineer their site ownership and TSA by time window. TSAs see the engineers they are supporting in each window.

## Existing functionality retained

- 38 sites and 1,926-ticket workload model
- vacation-driven rebalancing for the original Weekend coverage team
- Weekend Day / Weekend Mid baseline assignment board
- configurable BRK → Carolyn assignment lock
- TSA support assignments and fallback logic
- daily staffing calendar
- half days, extended shifts, days off, training, meetings, and unavailable status
- date-aware Weekend Daily Plan
- scenario mode
- preview/apply workflow
- coverage health
- handoffs
- undo/change history
- daily notes
- fairness history
- full 57-person prototype roster including Christopher Ramessar and retained Youssef/Bryan/Ola
- supervisor-highlighted calendar rows

## Tests

Run:

```powershell
node tests.js
```

The v9 suite covers the original assignment/TSA/Daily Plan logic plus configurable active days, off-day schedule exceptions, supervisor-inherited shifts, Weekday coverage generation, Weekend 60/40 generation, Mid-to-Night handoffs, TSA participation, supervisor exclusion from site assignment, plan publication, and overnight schedules.
