# Site Coverage Manager — Prototype v5

Prototype v5 keeps the existing site/TSA assignment workflow and adds a **date-specific staffing calendar** for shift duration and overlap visibility.

## Team page — `index.html`

The default page remains the clean, read-only team view.

- Select a name to see site assignments, role, TSA support, handoff details, and daily schedule.
- A shared **Team Schedule** timeline shows both shifts on the same 5am–9pm axis.
- Morning defaults to **6am–4pm**.
- Midday defaults to **12pm–8pm**.
- TSAs appear on the same timeline with their respective shift teams.
- Vacation staff are shown as vacation instead of displaying a shift bar.
- Custom shifts are labeled as daily exceptions.
- The date controls allow the team to look at another day's schedule.
- A selected person's profile shows their scheduled duration and cross-shift overlaps for the selected date.

## Supervisor console — `manage.html`

All prior supervisor functionality remains available, plus the new **Shift Calendar**.

Supervisors can:

- Move backward/forward by day or jump back to Today.
- Change any active person's start and end time for a specific date.
- Represent 12-hour days, half days, late starts, and early departures.
- Mark a person **Off** for one date without placing them on vacation.
- Reset one person to the normal shift or reset all exceptions for a date.
- See total scheduled hours for morning and midday.
- See the calculated cross-team overlap window and duration.
- See how many daily schedule exceptions exist.

### Vacation vs. daily schedule exceptions

These are intentionally separate concepts:

- **Vacation** uses the existing vacation controls and triggers site/TSA redistribution.
- **Off / shortened / extended shift** is a date-specific calendar exception and does not currently rewrite the permanent site assignment map.

This avoids a one-day half shift changing assignments for every other day. A future date-aware assignment layer can use these calendar hours to drive daily site/TSA handoffs safely.

## Existing v4 functionality retained

- 38-site morning coverage
- Workload-based 60/40 noon handoff
- Engineer vacation rebalance
- Carolyn → BRK lock
- Missing/duplicate detection
- TSA balancing across both shifts
- TSA vacation/fallback coverage
- Team-facing assignment view
- JSON snapshot export

## Schedule storage

Schedule exceptions are stored under `scheduleOverrides` in the same browser-local state used by the rest of the prototype. An entry is keyed by date and person, so changing Tuesday does not change Wednesday.

The prototype still uses browser-local storage. Different computers do not yet share state.

## Run it

No packages or build step are required.

From PowerShell in this folder:

```powershell
python -m http.server 8080
```

Open:

- Team page: `http://localhost:8080`
- Supervisor console: `http://localhost:8080/manage.html`

## Tests

Run:

```powershell
node tests.js
```

The tests cover the existing assignment/TSA rules plus default shifts, 12-hour days, half days, daily Off status, date isolation, vacation display, and cross-shift overlap calculations.
