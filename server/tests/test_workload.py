from datetime import date
import json

from app.services.assignment_advisor import build_balanced_plan
from app.services.jira_workload import SiteMapper
from app.services.workload_period import previous_three_full_months


def test_previous_three_complete_months():
    start, end = previous_three_full_months(date(2026, 10, 1))
    assert start == date(2026, 7, 1)
    assert end == date(2026, 9, 30)

    start, end = previous_three_full_months(date(2027, 1, 15))
    assert start == date(2026, 10, 1)
    assert end == date(2026, 12, 31)


def test_site_mapper_handles_aliases(tmp_path):
    sites = tmp_path / "sites.json"
    aliases = tmp_path / "aliases.json"
    sites.write_text(json.dumps(["BRK - 6020", "DOUG-6010"]), encoding="utf-8")
    aliases.write_text(json.dumps({"DOUG-6010": ["Doug - 6010", "DOU-6010"]}), encoding="utf-8")

    mapper = SiteMapper(str(sites), str(aliases))
    assert mapper.map_values(["BRK-6020"])[0] == "BRK - 6020"
    assert mapper.map_values(["Doug - 6010"])[0] == "DOUG-6010"
    assert mapper.map_values(["Unknown Site"])[0] is None


def test_balancer_respects_locks_and_capacity():
    plan = build_balanced_plan(
        site_weights={"BRK": 575, "DOUG": 445, "PLV": 389, "JOL": 102},
        engineers=[
            {"id": "carolyn", "name": "Carolyn", "capacity": 1.0},
            {"id": "bronson", "name": "Bronson", "capacity": 1.0},
        ],
        locks=[
            {"person_id": "carolyn", "site_id": "BRK"},
            {"person_id": "bronson", "site_id": "JOL"},
        ],
    )

    assert "BRK" in plan["assignments"]["carolyn"]
    assert "JOL" in plan["assignments"]["bronson"]
    assigned = [site for sites in plan["assignments"].values() for site in sites]
    assert sorted(assigned) == ["BRK", "DOUG", "JOL", "PLV"]
