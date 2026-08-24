"""Normalize patients.phone_num (raw, unvalidated, usually local Moroccan
format like "0612345678") into the E.164 digits-only format WhatsApp's Cloud
API expects (e.g. "212612345678", no leading +)."""
import os
import re

DEFAULT_COUNTRY_CODE = os.environ.get("DEFAULT_COUNTRY_CODE", "212")


def normalize_phone(raw: str) -> str | None:
    if not raw:
        return None

    digits = re.sub(r"[^\d+]", "", raw.strip())
    if not digits:
        return None

    if digits.startswith("+"):
        digits = digits[1:]
    elif digits.startswith("00"):
        digits = digits[2:]
    elif digits.startswith("0"):
        # Local format (e.g. 0612345678) -> drop the trunk 0, prefix country code.
        digits = DEFAULT_COUNTRY_CODE + digits[1:]
    elif not digits.startswith(DEFAULT_COUNTRY_CODE):
        # No leading 0, no country code, no + — assume a local number missing
        # its trunk 0 (e.g. exported as "612345678").
        digits = DEFAULT_COUNTRY_CODE + digits

    # A real mobile number is at minimum ~9 digits after the country code.
    if len(digits) < 10:
        return None

    return digits
