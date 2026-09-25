from typing import Any

from .ai_gateway import assist
from .model_selector import select_assignment_model


class AssignmentAdvisorError(ValueError):
    pass


def build_balanced_plan(
    *,
    site_weights: dict[str, int],
    engineers: list[dict[str, Any]],
    locks: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    if not engineers:
        raise AssignmentAdvisorError("At least one engineer is required")

    ids = [str(row["id"]) for row in engineers]
    if len(ids) != len(set(ids)):
        raise AssignmentAdvisorError("Engineer IDs must be unique")

    capacities = {str(row["id"]): max(0.01, float(row.get("capacity") or 1.0)) for row in engineers}
    total_capacity = sum(capacities.values())
    total_weight = sum(max(0, int(weight or 0)) for weight in site_weights.values())
    targets = {engineer_id: total_weight * capacities[engineer_id] / total_capacity for engineer_id in ids}
    names = {str(row["id"]): str(row.get("name") or row["id"]) for row in engineers}

    assignments = {engineer_id: [] for engineer_id in ids}
    loads = {engineer_id: 0 for engineer_id in ids}
    locked_sites: set[str] = set()

    for lock in locks or []:
        person_id = str(lock.get("person_id") or "")
        site_id = str(lock.get("site_id") or "")
        if person_id not in assignments:
            raise AssignmentAdvisorError(f"Locked engineer is not eligible: {person_id}")
        if site_id not in site_weights:
            raise AssignmentAdvisorError(f"Locked site does not exist in workload snapshot: {site_id}")
        if site_id in locked_sites:
            raise AssignmentAdvisorError(f"Site is locked more than once: {site_id}")
        assignments[person_id].append(site_id)
        loads[person_id] += site_weights[site_id]
        locked_sites.add(site_id)

    free_sites = sorted(
        (site_id for site_id in site_weights if site_id not in locked_sites),
        key=lambda site_id: (-site_weights[site_id], site_id),
    )

    for site_id in free_sites:
        weight = site_weights[site_id]
        owner = min(
            ids,
            key=lambda engineer_id: (
                (loads[engineer_id] + weight) / max(1.0, targets[engineer_id]),
                loads[engineer_id] / max(1.0, targets[engineer_id]),
                len(assignments[engineer_id]),
                engineer_id,
            ),
        )
        assignments[owner].append(site_id)
        loads[owner] += weight

    rows = []
    for engineer_id in ids:
        target = targets[engineer_id]
        load = loads[engineer_id]
        rows.append(
            {
                "person_id": engineer_id,
                "name": names[engineer_id],
                "capacity": capacities[engineer_id],
                "target_weight": round(target, 2),
                "assigned_weight": load,
                "difference": round(load - target, 2),
                "site_count": len(assignments[engineer_id]),
                "sites": sorted(assignments[engineer_id], key=lambda site_id: (-site_weights[site_id], site_id)),
            }
        )

    rows.sort(key=lambda row: row["name"].lower())
    max_ratio = max((row["assigned_weight"] / max(1.0, row["target_weight"]) for row in rows), default=0)
    min_ratio = min((row["assigned_weight"] / max(1.0, row["target_weight"]) for row in rows), default=0)

    return {
        "total_weight": total_weight,
        "locked_sites": sorted(locked_sites),
        "imbalance_ratio_spread": round(max_ratio - min_ratio, 4),
        "engineers": rows,
        "assignments": assignments,
    }


async def review_plan_with_ai(
    *,
    plan: dict[str, Any],
    site_details: dict[str, dict[str, Any]],
    locks: list[dict[str, str]] | None = None,
    notes: str = "",
) -> dict[str, Any]:
    model = await select_assignment_model()
    task = """Review this deterministic site-assignment candidate.

The assignment_weight is the total Jira issue count from the previous three complete calendar months.
The deterministic candidate has already attempted to balance each engineer against their configured capacity.

Identify only meaningful operational improvements. Prefer a small number of swaps over a full rewrite.
Do not violate locked assignments. Do not assign a site to a person who is not listed.
If the candidate is already well balanced, say so instead of inventing changes.

For each proposed move, explain the workload effect and operational reason. Also flag any site whose
three monthly counts show a notable upward trend that a supervisor should watch.
"""
    context = {
        "supervisor_notes": notes,
        "locks": locks or [],
        "candidate_plan": plan,
        "site_workload": site_details,
    }
    result = await assist(task=task, context=context, model=model)
    return {"model": model, "content": result["content"]}
