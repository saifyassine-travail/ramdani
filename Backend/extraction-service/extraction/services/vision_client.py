"""Gemini multimodal client for extracting structured data from a CIN image."""
import json
import logging
import re

import google.generativeai as genai
from django.conf import settings

from .exceptions import ExtractionError, GeminiAPIError
from .prompts import CIN_EXTRACTION_PROMPT

logger = logging.getLogger(__name__)

REQUIRED_FIELDS = (
    "first_name",
    "last_name",
    "full_name",
    "cin_number",
    "date_of_birth",
    "place_of_birth",
    "expiry_date",
)

# Matches an entire fenced block: ```json ... ``` or ``` ... ```
_FENCE_RE = re.compile(r"^\s*```(?:json)?\s*(.*?)\s*```\s*$", re.DOTALL | re.IGNORECASE)


def _strip_code_fences(text: str) -> str:
    """Remove a surrounding ```json ... ``` (or ``` ... ```) fence, if present."""
    match = _FENCE_RE.match(text)
    if match:
        return match.group(1).strip()
    return text.strip()


def extract_cin(image_bytes: bytes) -> dict:
    """Extract structured CIN fields from a card image using Gemini vision.

    Args:
        image_bytes: Raw bytes of the uploaded CIN image (JPEG/PNG).

    Returns:
        A dict with exactly the keys in ``REQUIRED_FIELDS``.

    Raises:
        GeminiAPIError: If the Gemini API request itself fails or is not configured.
        ExtractionError: If the response cannot be parsed as JSON or is missing
            required fields.
    """
    api_key = getattr(settings, "GEMINI_API_KEY", "")
    if not api_key:
        raise GeminiAPIError(
            "GEMINI_API_KEY is not configured; set it in the environment."
        )

    model_name = getattr(settings, "GEMINI_MODEL", "gemini-2.0-flash")

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(
            [
                CIN_EXTRACTION_PROMPT,
                {"mime_type": "image/jpeg", "data": image_bytes},
            ]
        )
    except Exception as exc:  # noqa: BLE001 - surface any SDK/transport failure as 502
        logger.exception("Gemini API call failed")
        raise GeminiAPIError(f"Gemini API request failed: {exc}") from exc

    try:
        raw_text = response.text
    except Exception as exc:  # noqa: BLE001 - blocked/empty candidates raise here
        raise ExtractionError(
            f"Gemini returned no usable text (possibly blocked): {exc}"
        ) from exc

    if not raw_text or not raw_text.strip():
        raise ExtractionError("Gemini returned an empty response.")

    cleaned = _strip_code_fences(raw_text)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ExtractionError(
            f"Could not parse JSON from the model response: {exc}. "
            f"Raw response (truncated): {raw_text[:300]!r}"
        ) from exc

    if not isinstance(data, dict):
        raise ExtractionError("Model response was valid JSON but not an object.")

    missing = [
        field
        for field in REQUIRED_FIELDS
        if field not in data or data.get(field) in (None, "")
    ]
    if missing:
        raise ExtractionError(
            f"Extraction is missing required field(s): {', '.join(missing)}."
        )

    # Return only the expected keys, in a predictable order.
    return {field: data[field] for field in REQUIRED_FIELDS}
