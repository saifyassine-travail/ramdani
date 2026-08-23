"""Tesseract-based OCR fallback engine for CIN extraction.

This is the FALLBACK engine — ``ocr_client.py`` uses it automatically when the
primary engine (a local Ollama vision model, see ``ollama_ocr.py``) can't be
reached, and it can also be selected directly via ``OCR_ENGINE=tesseract``.

No external API, no API key, no quota — everything runs in-process via
Tesseract (``pytesseract``, French-only). Moroccan CIN cards print most
fields in both Arabic and Latin (French) script; the OCR model only knows
Latin/French, so Arabic regions are ignored (usually read as low-confidence
noise and dropped) rather than transcribed.

Real cards (the current biometric format) do NOT print "Nom:"/"Prenom:"
labels next to the name — the surname and given name are just two bare
lines directly above the "Nee le <date>" line. So name extraction is
positional: find the birth-date line, then take the one or two name-shaped
lines immediately before it. A literal-label match (older/alternate layouts
that do print "Nom"/"Prenom") is tried first since it's more precise when
present.

This is inherently less accurate than the vision-model engine: it depends on
layout assumptions and OCR line order surviving intact. Fields that can't be
found are returned as "" rather than failing the whole request. The request
only fails if neither a CIN number nor a name could be found at all. It also
does not crop a face — ``face_crop.py`` (Haar cascade) covers that for both
engines.
"""
import logging
import re
from datetime import datetime

import cv2
import numpy as np
import pytesseract
from PIL import Image

from .exceptions import ExtractionError, OCRError
from .gender_from_name import gender_from_name

logger = logging.getLogger(__name__)

REQUIRED_FIELDS = (
    "first_name",
    "last_name",
    "full_name",
    "cin_number",
    "date_of_birth",
    "place_of_birth",
    "expiry_date",
    "gender",
)

_TESSERACT_LANG = "fra"
_TESSERACT_CONFIG = "--oem 3 --psm 6"

_CIN_NUMBER_RE = re.compile(r"\b[A-Z]{1,2}\d{5,8}\b")
_CIN_LINE_HINT_RE = re.compile(r"n\s*[°ºo]", re.IGNORECASE)
# Separator is usually "." or "/", but OCR sometimes drops a thin "/" and
# leaves just a space (e.g. "05/12 1983") — accept a literal space too, but
# not \s in general, since that would let a match cross a line break.
_DATE_RE = re.compile(r"\b(\d{1,2})[.\/\- ](\d{1,2})[.\/\- ](\d{4})\b")
_PRENOM_LABEL_RE = re.compile(r"pr[ée]nom\s*[:\-]?\s*(.*)", re.IGNORECASE)
_NOM_LABEL_RE = re.compile(r"^nom\s*[:\-]?\s*(.*)", re.IGNORECASE)
# "Ne le" / "Nee le" / "Né(e) le" — tolerate a few stray chars from OCR noise
# between the "ne(e)" stem and "le" (accents, a stray "(e)", etc). This is
# only a first attempt: the label itself is short and accented, so OCR
# mangles it often (seen in practice: "Née le" -> "Vée de"). When it fails
# to match anything, _parse_fields falls back to the first date-shaped line
# instead, since digits survive OCR far more reliably than accented words.
_BIRTH_LABEL_RE = re.compile(r"n[eé]{1,2}.{0,5}\ble\b", re.IGNORECASE)
_EXPIRY_LINE_HINT_RE = re.compile(r"valabl|jusqu", re.IGNORECASE)
_PLACE_RE = re.compile(r"\bà\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' \-]{1,40})", re.IGNORECASE)

# Fixed boilerplate that can otherwise look like a "name line" positionally.
_HEADER_WORDS = {
    "ROYAUME", "MAROC", "CARTE", "NATIONALE", "IDENTITE", "IDENTITÉ",
    "SPECIMEN", "VALABLE", "DIRECTEUR", "GENERAL", "GÉNÉRAL", "NATIONAL",
    "SURETE", "SÛRETÉ",
}

# Anything that isn't a letter, space, hyphen or apostrophe — OCR noise on a
# name line (stray digits, colons, pipes from a misread field border).
_NAME_NOISE_RE = re.compile(r"[^A-Za-zÀ-ÿ' \-]")


def _preprocess(image_bytes: bytes) -> Image.Image:
    """Decode + binarize the image so Tesseract has a cleaner target."""
    array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise OCRError("The uploaded file could not be decoded as an image.")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Small source photos OCR poorly; upscale unless it's already large.
    height, width = gray.shape[:2]
    if max(height, width) < 1600:
        scale = 1600 / max(height, width)
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    return Image.fromarray(binary)


def _clean_name(value: str) -> str:
    value = _NAME_NOISE_RE.sub(" ", value).strip()
    value = re.sub(r"\s+", " ", value)
    return value.title() if value.isupper() else value


def _looks_like_name_line(line: str) -> bool:
    cleaned = _clean_name(line)
    # OCR noise near the anchor line is often a short garbled fragment (seen
    # in practice: a 2-char "pi" from a mangled label/border). Real Moroccan
    # given/family names are essentially never this short, so this also
    # filters noise without meaningfully risking a real name.
    if len(cleaned) < 3:
        return False
    if set(cleaned.upper().split()) & _HEADER_WORDS:
        return False
    return True


def _normalize_date(day: str, month: str, year: str) -> str | None:
    try:
        return datetime(int(year), int(month), int(day)).strftime("%Y-%m-%d")
    except ValueError:
        return None


def _names_by_label(lines: list[str]) -> tuple[str, str]:
    """Older/alternate layouts that literally print "Nom"/"Prenom" labels."""
    first_name = last_name = ""
    for idx, line in enumerate(lines):
        if not first_name:
            match = _PRENOM_LABEL_RE.search(line)
            if match:
                candidate = match.group(1) or (lines[idx + 1] if idx + 1 < len(lines) else "")
                first_name = _clean_name(candidate)
                continue
        if not last_name:
            match = _NOM_LABEL_RE.match(line)
            if match:
                candidate = match.group(1) or (lines[idx + 1] if idx + 1 < len(lines) else "")
                last_name = _clean_name(candidate)
    return first_name, last_name


def _names_by_position(lines: list[str], birth_idx: int | None) -> tuple[str, str]:
    """Current biometric layout: bare surname + given-name lines directly
    above the "Nee le <date>" line, no labels at all."""
    if birth_idx is None:
        return "", ""

    candidates = [line for line in lines[:birth_idx] if _looks_like_name_line(line)]
    if len(candidates) >= 2:
        return _clean_name(candidates[-1]), _clean_name(candidates[-2])
    if len(candidates) == 1:
        return _clean_name(candidates[-1]), ""
    return "", ""


def _strip_n_label_artifact(candidate: str) -> str:
    """Drop a leading "N" that's the "N°" (numéro) label glued onto the code
    by a missing space in OCR (e.g. "NU1234567" -> "U1234567"). Only applies to the
    2-letter-prefix case, since a real 2-letter province prefix starting with "N" would
    otherwise be indistinguishable from this artifact."""
    if len(candidate) > 1 and candidate[0] == "N" and candidate[1].isalpha():
        return candidate[1:]
    return candidate


def _extract_cin_number(raw_text: str, lines: list[str]) -> str:
    for line in lines:
        if _CIN_LINE_HINT_RE.search(line):
            match = _CIN_NUMBER_RE.search(line.upper())
            if match:
                return _strip_n_label_artifact(match.group(0))

    candidates = _CIN_NUMBER_RE.findall(raw_text.upper())
    return _strip_n_label_artifact(candidates[0]) if candidates else ""


def _extract_place_of_birth(lines: list[str], birth_idx: int | None) -> str:
    # Search a small window right after the birth line, not the whole card:
    # a global search can latch onto an unrelated "à" earlier in the noise
    # (header boilerplate, Arabic-as-Latin garbage, ...).
    window = lines[birth_idx : birth_idx + 3] if birth_idx is not None else lines
    match = _PLACE_RE.search("\n".join(window))
    if match:
        return _clean_name(match.group(1))

    if birth_idx is not None and birth_idx + 1 < len(lines):
        candidate = re.sub(r"^[àa]\s*", "", lines[birth_idx + 1], flags=re.IGNORECASE)
        if _looks_like_name_line(candidate):
            return _clean_name(candidate)

    return ""


def _extract_dates(lines: list[str], birth_idx: int | None) -> tuple[str, str]:
    """Birth date comes from the anchor line itself; expiry is searched for
    independently (a "Valable jusqu'au" hint, or otherwise the first date on
    a later line) rather than assumed to be "whichever date comes second" —
    OCR frequently merges/reorders lines, so raw left-to-right date order in
    the full text isn't reliable."""
    date_of_birth = ""
    if birth_idx is not None:
        match = _DATE_RE.search(lines[birth_idx])
        if match:
            date_of_birth = _normalize_date(*match.groups()) or ""

    expiry_date = ""
    for line in lines:
        if _EXPIRY_LINE_HINT_RE.search(line):
            match = _DATE_RE.search(line)
            if match:
                candidate = _normalize_date(*match.groups()) or ""
                if candidate != date_of_birth:
                    expiry_date = candidate
                    break

    all_dates = [d for d in (_normalize_date(*m) for m in _DATE_RE.findall("\n".join(lines))) if d]
    if not date_of_birth:
        remaining = [d for d in all_dates if d != expiry_date]
        date_of_birth = remaining[0] if remaining else ""
    if not expiry_date:
        remaining = [d for d in all_dates if d != date_of_birth]
        expiry_date = remaining[0] if remaining else ""

    return date_of_birth, expiry_date


def _parse_fields(raw_text: str) -> dict:
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]

    birth_idx = next(
        (idx for idx, line in enumerate(lines) if _BIRTH_LABEL_RE.search(line)), None
    )
    if birth_idx is None:
        # The label ("Née le") is short and accented, so OCR mangles it
        # often. Digits are far more reliable — fall back to the first
        # date-shaped line as the anchor instead.
        birth_idx = next(
            (idx for idx, line in enumerate(lines) if _DATE_RE.search(line)), None
        )

    first_name, last_name = _names_by_label(lines)
    if not first_name and not last_name:
        first_name, last_name = _names_by_position(lines, birth_idx)

    cin_number = _extract_cin_number(raw_text, lines)
    date_of_birth, expiry_date = _extract_dates(lines, birth_idx)
    place_of_birth = _extract_place_of_birth(lines, birth_idx)

    full_name = f"{first_name} {last_name}".strip()

    return {
        "first_name": first_name,
        "last_name": last_name,
        "full_name": full_name,
        "cin_number": cin_number,
        "date_of_birth": date_of_birth,
        "place_of_birth": place_of_birth,
        "expiry_date": expiry_date,
        # No vision model here to read gender — infer from the name (best-effort).
        "gender": gender_from_name(first_name),
    }


def extract_cin_tesseract(image_bytes: bytes) -> dict:
    """Extract structured CIN fields from a card image using local Tesseract OCR.

    Args:
        image_bytes: Raw bytes of the uploaded CIN image (JPEG/PNG).

    Returns:
        A dict with exactly the keys in ``REQUIRED_FIELDS``. Fields that
        couldn't be read are returned as "".

    Raises:
        OCRError: If the image can't be decoded or Tesseract itself fails.
        ExtractionError: If neither a CIN number nor a name could be found.
    """
    image = _preprocess(image_bytes)

    try:
        raw_text = pytesseract.image_to_string(
            image, lang=_TESSERACT_LANG, config=_TESSERACT_CONFIG
        )
    except pytesseract.TesseractNotFoundError as exc:
        raise OCRError(f"Tesseract is not installed or not on PATH: {exc}") from exc
    except Exception as exc:  # noqa: BLE001 - surface any OCR failure as 502
        logger.exception("Tesseract OCR call failed")
        raise OCRError(f"OCR request failed: {exc}") from exc

    data = _parse_fields(raw_text)

    # TEMP diagnostic logging (remove once real-card accuracy is confirmed).
    logger.warning("OCR raw text:\n%s", raw_text)
    logger.warning("OCR parsed fields: %s", data)

    if not data["cin_number"] and not data["first_name"] and not data["last_name"]:
        raise ExtractionError(
            "Could not find a CIN number or name in this image. "
            "Try a clearer, well-lit, non-blurry photo of the card."
        )

    return data
