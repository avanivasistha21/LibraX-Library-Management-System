from datetime import date, datetime, timedelta
from typing import Dict, Any, Optional, Tuple, List

# Business Logic Configuration Constants
DEFAULT_LOAN_DAYS = 14
RESERVATION_HOLD_DAYS = 7
DAILY_OVERDUE_FINE_RATE = 10.00  # INR per day
MAX_ALLOWED_UNPAID_FINE = 100.00 # INR threshold to block borrowing

MEMBER_LOAN_LIMITS = {
    "Student": 3,
    "Faculty": 5,
    "Staff": 4,
}

class BusinessRuleViolation(Exception):
    """Raised when a business rule or validation fails."""
    def __init__(self, message: str, code: str = "RULE_VIOLATION"):
        super().__init__(message)
        self.code = code
        self.message = message


def validate_member_eligibility(
    member: Dict[str, Any],
    active_loans_count: int,
    total_unpaid_fines: float
) -> Tuple[bool, Optional[str]]:
    """
    Validates whether a member is eligible to borrow books.
    Rules:
    1. Member status must be 'ACTIVE'.
    2. Active loans must not exceed the limit for their member type.
    3. Outstanding unpaid fines must not exceed the allowed threshold.
    """
    status = (member.get("status") or "").upper()
    if status != "ACTIVE":
        raise BusinessRuleViolation(
            f"Member '{member.get('full_name', member.get('id'))}' is currently {status} and cannot borrow books.",
            code="MEMBER_INACTIVE"
        )

    member_type = member.get("member_type", "Student")
    max_loans = MEMBER_LOAN_LIMITS.get(member_type, 3)
    if active_loans_count >= max_loans:
        raise BusinessRuleViolation(
            f"Member has reached the maximum borrowing limit of {max_loans} books for type '{member_type}'.",
            code="MAX_LOANS_EXCEEDED"
        )

    if total_unpaid_fines > MAX_ALLOWED_UNPAID_FINE:
        raise BusinessRuleViolation(
            f"Member has outstanding unpaid fines of ₹{total_unpaid_fines:.2f} (exceeds ₹{MAX_ALLOWED_UNPAID_FINE:.2f} threshold). Please clear dues first.",
            code="OUTSTANDING_FINES_EXCEEDED"
        )

    return True, None


def validate_copy_availability(copy: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    Validates whether a book copy can be borrowed.
    Rules:
    1. Copy status must be 'AVAILABLE'.
    """
    status = (copy.get("status") or "").upper()
    if status != "AVAILABLE":
        raise BusinessRuleViolation(
            f"Book copy '{copy.get('copy_id')}' cannot be issued because its status is '{status}'.",
            code="COPY_UNAVAILABLE"
        )
    return True, None


def calculate_loan_due_date(borrow_date: Optional[date] = None, duration_days: int = DEFAULT_LOAN_DAYS) -> date:
    """Computes loan due date ensuring due_date > borrow_date."""
    if borrow_date is None:
        borrow_date = date.today()
    return borrow_date + timedelta(days=duration_days)


def process_return_and_calculate_fine(
    borrow_date_val: Any,
    due_date_val: Any,
    return_date_val: Optional[Any] = None,
    daily_rate: float = DAILY_OVERDUE_FINE_RATE
) -> Dict[str, Any]:
    """
    Processes book return, validates dates, and computes overdue fine if any.
    Rules:
    1. return_date >= borrow_date
    2. If return_date > due_date, fine = (return_date - due_date).days * daily_rate
    3. Else fine = 0.00
    """
    def to_date(v: Any) -> date:
        if isinstance(v, str):
            return datetime.fromisoformat(v.replace("Z", "")).date()
        if isinstance(v, datetime):
            return v.date()
        if isinstance(v, date):
            return v
        return date.today()

    b_date = to_date(borrow_date_val)
    d_date = to_date(due_date_val)
    r_date = to_date(return_date_val) if return_date_val else date.today()

    if r_date < b_date:
        raise BusinessRuleViolation(
            f"Return date ({r_date}) cannot be earlier than borrow date ({b_date}).",
            code="INVALID_RETURN_DATE"
        )

    days_overdue = max(0, (r_date - d_date).days)
    fine_amount = round(days_overdue * daily_rate, 2)

    return {
        "return_date": r_date,
        "days_overdue": days_overdue,
        "fine_amount": fine_amount,
        "is_overdue": days_overdue > 0,
    }


def validate_reservation_dates(reserved_on_val: Any, expires_on_val: Optional[Any] = None) -> Tuple[date, date]:
    """
    Validates reservation date constraints: expires_on > reserved_on.
    """
    def to_date(v: Any) -> date:
        if isinstance(v, str):
            return datetime.fromisoformat(v.replace("Z", "")).date()
        if isinstance(v, datetime):
            return v.date()
        if isinstance(v, date):
            return v
        return date.today()

    r_date = to_date(reserved_on_val)
    if expires_on_val:
        e_date = to_date(expires_on_val)
    else:
        e_date = r_date + timedelta(days=RESERVATION_HOLD_DAYS)

    if e_date <= r_date:
        raise BusinessRuleViolation(
            f"Reservation expiration date ({e_date}) must be strictly after reserved date ({r_date}).",
            code="INVALID_RESERVATION_EXPIRY"
        )

    return r_date, e_date


def validate_fine_status_transition(current_status: str, new_status: str) -> None:
    """
    Validates state machine transitions for fines:
    UNPAID -> PAID or WAIVED
    PAID -> Final (no transition)
    WAIVED -> Final (no transition)
    """
    c_status = current_status.upper()
    n_status = new_status.upper()

    allowed = {
        "UNPAID": ["PAID", "WAIVED"],
        "PAID": [],
        "WAIVED": [],
    }

    if n_status not in allowed.get(c_status, []):
        raise BusinessRuleViolation(
            f"Illegal fine transition from '{c_status}' to '{n_status}'.",
            code="INVALID_FINE_STATUS_TRANSITION"
        )
