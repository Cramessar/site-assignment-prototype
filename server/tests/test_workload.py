from datetime import date

from app.services.assignment_advisor import build_balanced_plan
from app.services.jira_workload import _month_ranges
from app.services.workload_period import previous_three_full_months


def test_previous_three_complete_months():
    start, end = previous_three_full_months(date(2026, 10, 1))
    assert start == date(2026, 7, 1)
    assert end == date(2026, 9, 30)

    start, end = previous_three_full_months(date(2027, 1, 15))
    assert start == date(2026, 10, 1)
    assert end == date(2026, 12, 31)


def test_month_ranges_cover_three_complete_months():
    assert _month_ranges(date(2026, 7, 1), date(2026, 9, 30)) == [
        (date(2026, 7, 1), date(2026, 7, 31)),
        (date(2026, 8, 1), date(2026, 8, 31)),
        (date(2026, 9, 1), date(2026, 9, 30)),
    ]


def test_balancer_respects_canonical_site_locks_and_capacity():
    plan = build_balanced_plan(
        site_weights={
            "Walmart-6020-BRK": 575,
            "Walmart-6010-DOUG": 445,
            "Walmart-6012-PLV": 389,
            "UNFI-JOL": 102,
        },
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
    assert sorted(assigned) == sorted(
        ["Walmart-6020-BRK", "Walmart-6010-DOUG", "Walmart-6012-PLV", "UNFI-JOL"]
    )
