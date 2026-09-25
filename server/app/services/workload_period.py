from calendar import monthrange
from datetime import date, timedelta


def first_day_of_month(value: date) -> date:
    return value.replace(day=1)


def add_months(value: date, months: int) -> date:
    month_index = value.year * 12 + (value.month - 1) + months
    year, month_zero = divmod(month_index, 12)
    month = month_zero + 1
    day = min(value.day, monthrange(year, month)[1])
    return date(year, month, day)


def previous_three_full_months(as_of: date) -> tuple[date, date]:
    current_month = first_day_of_month(as_of)
    start = add_months(current_month, -3)
    end = current_month - timedelta(days=1)
    return start, end


def period_key(start: date, end: date) -> str:
    return f"{start.isoformat()}_{end.isoformat()}"
