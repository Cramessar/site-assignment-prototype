from datetime import date

from app.services.assignment_advisor import build_balanced_plan
from app.services.jira_workload import _created_month, _raw_site
from app.services.workload_period import previous_three_full_months


def test_previous_three_complete_months():
    start, end = previous_three_full_months(date(2026, 10, 1))
    assert start == date(2026, 7, 1)
    assert end == date(2026, 9, 30)

    start, end = previous_three_full_months(date(2027, 1, 15))
    assert start == date(2026, 10, 1)
    assert end == date(2026, 12, 31)


def test_raw_site_uses_jira_project_name():
    issue = {
        "key": "WMT-123",
        "fields": {
            "project": {"key": "WMT", "name": "Walmart-6020-BRK"},
            "created": "2026-09-17T12:00:00.000+0000",
        },
    }
    assert _raw_site(issue) == "Walmart-6020-BRK"
    assert _created_month(issue) == "2026-09"


def test_raw_site_falls_back_to_project_key():
    issue = {"key": "ABC-123", "fields": {"project": {"key": "ABC"}}}
    assert _raw_site(issue) == "ABC"


def test_balancer_respects_locks_and_capacity():
    plan = build_balanced_plan(
        site_weights={"Walmart-6020-BRK": 575, "Walmart-6010-DOUG": 445, "Walmart-6012-PLV": 389, "UNFI-JOL": 102},
        engineers=[
            {"id": "carolyn", "name": "Carolyn", "capacity": 1.0},
            {"id": "bronson", "name": "Bronson", "capacity": 1.0},
        ],
        locks=[
            {"person_id": "carolyn", "site_id": "Walmart-6020-BRK"},
            {"person_id": "bronson", "site_id": "UNFI-JOL"},
        ],
    )

    assert "Walmart-6020-BRK" in plan["assignments"]["carolyn"]
    assert "UNFI-JOL" in plan["assignments"]["bronson"]
    assigned = [site for sites in plan["assignments"].values() for site in sites]
    assert sorted(assigned) == sorted(["Walmart-6020-BRK", "Walmart-6010-DOUG", "Walmart-6012-PLV", "UNFI-JOL"])
