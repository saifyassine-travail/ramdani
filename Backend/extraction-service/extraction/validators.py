"""Field-level validation for extracted CIN data.

``validate_cin_fields`` returns a per-field boolean map so the caller/UI can
highlight exactly which extracted values look wrong.
"""
import re
from datetime import date, datetime

# One or two uppercase letters followed by 5-8 digits, e.g. "K01234567".
# (Widened from the spec's \d{5,7} so the canonical example "K01234567",
# which has 8 digits, validates. Tighten to {5,7} or {6} if real cards differ.)
_CIN_RE = re.compile(r"^[A-Z]{1,2}\d{5,8}$")

# One or more unicode-letter words separated by single spaces (accents allowed,
# no digits, underscores or other punctuation).
_NAME_RE = re.compile(r"^[^\W\d_]+(?:\s[^\W\d_]+)*$", re.UNICODE)


def _parse_iso_date(value):
    """Return a ``date`` if ``value`` is a valid YYYY-MM-DD string, else ``None``."""
    if not isinstance(value, str):
        return None
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def validate_cin_fields(data: dict) -> dict:
    """Validate extracted CIN fields and return per-field validity info.

    Checks:
        * ``cin_number``    matches ``^[A-Z]{1,2}\\d{5,8}$``.
        * ``date_of_birth`` is a valid ISO (YYYY-MM-DD) date.
        * ``expiry_date``   is a valid ISO date **and** in the future.
        * ``full_name``     is non-empty and contains only letters and spaces.

    Also returns ``expiry_status`` so the UI can tell an *expired* card apart
    from one whose expiry couldn't be read (the ``expiry_date`` boolean is
    false in both cases). This lets the app warn "card expired on <date>"
    without blocking the scan — the fields are still parsed and returned:
        * ``"valid"``   — expiry is a real date in the future.
        * ``"expired"`` — expiry is a real date, but today or in the past.
        * ``"unknown"`` — expiry was empty or unparseable.
    """
    cin_number = data.get("cin_number")
    full_name = data.get("full_name")
    dob = _parse_iso_date(data.get("date_of_birth"))
    expiry = _parse_iso_date(data.get("expiry_date"))
    today = date.today()

    if expiry is None:
        expiry_status = "unknown"
    elif expiry > today:
        expiry_status = "valid"
    else:
        expiry_status = "expired"

    return {
        "cin_number": bool(
            isinstance(cin_number, str) and _CIN_RE.match(cin_number.strip())
        ),
        "date_of_birth": dob is not None,
        "expiry_date": bool(expiry is not None and expiry > today),
        "expiry_status": expiry_status,
        "full_name": bool(
            isinstance(full_name, str)
            and full_name.strip()
            and _NAME_RE.match(full_name.strip())
        ),
    }
