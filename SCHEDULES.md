# Scheduling data model

The scheduling system separates a person's organizational shift from their actual recurring work pattern.

## Precedence

For any person and date, schedule resolution follows:

```text
date-specific exception
        ↓
person recurring schedule
        ↓
shift default
```

This lets most people inherit a standard shift while preserving recurring individual schedules without re-entering them each week.

## Shift defaults

Stored in `shift_schedule_defaults`.

Current baseline:

| Shift | Days | Default hours |
| --- | --- | --- |
| Weekday Morning | Mon-Thu | 6 AM-4 PM |
| Weekday Mid | Mon-Thu | 12 PM-10 PM |
| Weekday Night | Mon-Thu | 8 PM-6 AM |
| Weekend Day | Fri-Mon | 6 AM-4 PM |
| Weekend Mid | Fri-Mon | 12 PM-10 PM |
| Weekend Night | Fri-Mon | 8 PM-6 AM |
| Commissioning | Mon-Fri | 8 AM-5 PM |

Escalation Management is intentionally outside the current scheduling scope.

## Recurring person schedules

Stored in:

- `staff_schedule_profiles`
- `staff_schedule_segments`

A profile can fully replace the person's shift default. Multiple segments are allowed on the same weekday so split schedules remain real gaps in coverage rather than one artificial continuous shift.

Current seeded deviations from the supplied Microsoft Shifts screenshots include:

- David Lewis: Fri-Sun 6 AM-6 PM
- Chad Cruz Jr.: Fri-Sun 6 AM-6 PM
- Krysztof Capuras: Fri-Sun 8 AM-8 PM
- Garret Bishop: Mon 12 PM-10 PM; Fri-Sun 10 AM-8 PM
- Chaitanya Jagarapu: Mon/Wed 12 PM-10 PM; Tue/Thu 10 AM-8 PM
- Darwin Mounsey: Mon-Fri 1 PM-9 PM
- Michael Herrera: Fri-Sun 6 PM-6 AM
- Khalid Javed: Fri-Sun 6 PM-6 AM
- Kevin Mitchell: Fri-Sun 6 PM-6 AM
- Matthew Weimer: Mon/Wed 6 AM-4 PM; Tue/Thu split 5 AM-8:30 AM and 1 PM-5:30 PM

The seed is insert-only. Once a supervisor changes DB schedule data, container restarts do not overwrite that edit.

## Date-specific exceptions

Stored in `staff_schedule_exceptions`.

Supported statuses:

- Vacation
- Off
- Unavailable
- Training
- Meeting
- Working/custom hours

These are date-specific and shared across browsers. Vacation is no longer modeled as a permanent employee flag.

## APIs

Read shared scheduling configuration:

```text
GET /api/v1/schedules/config
```

Read exceptions:

```text
GET /api/v1/schedules/exceptions?date_from=2026-09-21&date_to=2026-09-27
```

Set one day's status or custom hours:

```text
PUT /api/v1/schedules/exceptions/{person_id}/{date}
```

Clear an exception:

```text
DELETE /api/v1/schedules/exceptions/{person_id}/{date}
```

Persist a standard shift change:

```text
PUT /api/v1/schedules/defaults/{shift_id}
```

## Availability banner

Public staffing, published assignments, and employee self-service views load the same shared exceptions.

The banner shows:

- **Out today**
- **Out this week**

On a published assignment page the banner is filtered to the shifts participating in that coverage plan. On the employee self-service page it narrows to the selected employee's shift.

Normal scheduled days off are not labeled as absences.

## Coverage calculations

Assignment windows use the actual recurring schedule segments.

For example, a split schedule of:

```text
5:00 AM-8:30 AM
1:00 PM-5:30 PM
```

does not count as continuous availability from 5:00 AM through 5:30 PM. Coverage generation preserves the midday gap.
