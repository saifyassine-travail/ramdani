"""Local vision-LLM OCR engine for CIN extraction, via Ollama.

This is the PRIMARY engine (see ``ocr_client.py`` for the dispatch/fallback
logic) — a local vision model reads the card image directly and returns
structured fields, instead of Tesseract's plain-text-OCR + regex/positional
parsing. Runs fully offline: no API key, no per-scan cost, no image ever
leaves the machine — Ollama (https://ollama.com) serves the model over a
local HTTP API (default ``http://127.0.0.1:11434``; a Dockerized deployment
of this service points ``OLLAMA_HOST`` at ``http://host.docker.internal:11434``
to reach an Ollama instance running natively on the host).

Prompt design notes (tuned against real Moroccan biometric CIN cards):
    * Photos are very often rotated 90/180 degrees (phone camera, card held
      any which way) — the prompt explicitly tells the model to mentally
      rotate the card upright rather than assume it's already oriented.
    * The card is bilingual (Arabic on the right, Latin/French on the left).
      The model is told to read only the Latin side; Arabic is irrelevant to
      this app's records.
    * Fields have no printed labels for name (current biometric layout: two
      bare lines above "Née le") — the prompt spells out the layout order
      instead of asking the model to find a label.
    * Birth date is sometimes printed as a bare year (older cards / low-res
      photos where only the year survived legibly) — the prompt allows a
      bare "YYYY" for ``date_of_birth`` rather than forcing a full date.
    * ``format: "json"`` (Ollama's constrained-JSON mode) + ``temperature: 0``
      keep output parseable and deterministic-ish; the model is still asked
      to output ONLY the JSON object, no surrounding prose, as a second layer
      of defense against extra text breaking ``json.loads``.
"""
import base64
import json
import logging
import re
import urllib.error
import urllib.request
from datetime import datetime
from os import environ

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

OLLAMA_HOST = environ.get("OLLAMA_HOST", "http://127.0.0.1:11434")
OLLAMA_MODEL = environ.get("OLLAMA_MODEL", "qwen2.5vl:3b")
# How long Ollama keeps the model loaded in memory after a request. Default
# ("5m") means a clinic with gaps between patients keeps re-paying the cold
# cost. "30m" trades some idle RAM/VRAM for consistently fast scans.
OLLAMA_KEEP_ALIVE = environ.get("OLLAMA_KEEP_ALIVE", "30m")
# Generous enough to cover a cold model load (can be well over a minute for
# an 8B-class model on CPU) plus inference — this is a ceiling, not typical
# per-scan latency (which is ~20s once the model is warm/resident).
_REQUEST_TIMEOUT_S = int(environ.get("OLLAMA_TIMEOUT_S", "300"))

_PROMPT = """You are reading a Moroccan national ID card (Carte Nationale d'Identité / CIN).
The photo MAY BE ROTATED 90 or 180 degrees — mentally rotate it upright before reading.
The card is bilingual (Arabic on the right, Latin/French on the left). Read ONLY the Latin/French text.

Card layout (Latin side, top to bottom):
- Two bare lines with the person's names: the GIVEN NAME (prénom) on top, then the FAMILY NAME (nom) below it.
- A line "Née le" or "Né le" followed by the date of birth.
- A line starting with "à" followed by the place of birth (town, sometimes two words).
- "N°" followed by the CIN number (1-2 uppercase letters then digits, e.g. FJ21731, Z171445).
- "Valable jusqu'au" followed by the card expiry date.
Ignore the "CAN ..." number, the signature, and all Arabic text.

The card has no printed "sex" field in Latin. Infer the person's gender from the
given name (and the Arabic name if helpful): "Male" or "Female". If genuinely unsure, use "".

Return ONLY a JSON object with EXACTLY these keys:
{
  "first_name": "",      // given name / prénom, as printed in Latin letters
  "last_name": "",       // family name / nom, as printed in Latin letters
  "cin_number": "",      // e.g. "FJ21731"
  "date_of_birth": "",   // "YYYY-MM-DD" if a full date is printed; if ONLY a year is printed, return just "YYYY"
  "place_of_birth": "",  // town after "à"
  "expiry_date": "",     // "YYYY-MM-DD" from "Valable jusqu'au"; "" if not fully visible
  "gender": ""           // "Male" or "Female" inferred from the name; "" if unsure
}
Use "" for any field you cannot read (except gender, which you should infer from the name). Do not guess other fields. Output the JSON only, no other text."""

_DATE_RE = re.compile(r"(\d{1,2})[.\/\- ](\d{1,2})[.\/\- ](\d{4})")


def _normalize_date(value) -> str:
    """Full date -> YYYY-MM-DD; bare 4-digit year -> as-is; else best effort."""
    if not value:
        return ""
    value = str(value).strip()
    if re.fullmatch(r"\d{4}", value):
        return value
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return value
    match = _DATE_RE.search(value)
    if match:
        day, month, year = match.groups()
        try:
            return datetime(int(year), int(month), int(day)).strftime("%Y-%m-%d")
        except ValueError:
            return value
    return value


def _normalize_gender(value) -> str:
    """Coerce the model's gender answer to exactly 'Male', 'Female', or ''."""
    if not value:
        return ""
    v = str(value).strip().lower()
    if v in ("male", "m", "homme", "masculin"):
        return "Male"
    if v in ("female", "f", "femme", "féminin", "feminin"):
        return "Female"
    return ""


def _call_ollama(image_bytes: bytes) -> dict:
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {
                "role": "user",
                "content": _PROMPT,
                "images": [base64.b64encode(image_bytes).decode("ascii")],
            }
        ],
        "stream": False,
        "format": "json",
        "options": {"temperature": 0},
        # Keep the model resident in memory between requests — without this,
        # Ollama unloads it after ~5 min idle (its default), and the next scan
        # pays the full cold-load cost again (can exceed a generous timeout on
        # CPU-only / large models). A clinic doing scans throughout the day
        # should only ever pay that cost once, after the service starts.
        "keep_alive": OLLAMA_KEEP_ALIVE,
    }
    request = urllib.request.Request(
        f"{OLLAMA_HOST}/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )

    try:
        with urllib.request.urlopen(request, timeout=_REQUEST_TIMEOUT_S) as response:
            body = json.loads(response.read())
    except (urllib.error.URLError, TimeoutError) as exc:
        # Connection refused, DNS failure, timeout, ... -> Ollama unreachable.
        # ocr_client.py catches this specific exception to fall back to Tesseract.
        raise OllamaUnavailableError(f"Could not reach Ollama at {OLLAMA_HOST}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise OCRError(f"Ollama returned a non-JSON HTTP response: {exc}") from exc

    try:
        content = body["message"]["content"]
    except (KeyError, TypeError) as exc:
        raise OCRError(f"Unexpected Ollama response shape: {body!r}") from exc

    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        raise OCRError(f"Model did not return valid JSON: {content[:500]!r}") from exc


class OllamaUnavailableError(OCRError):
    """Ollama couldn't be reached at all (not running, wrong host, network down).

    A subclass of ``OCRError`` so it still maps to a 502 if it ever escapes
    unhandled, but distinct so ``ocr_client.py`` can catch specifically this
    case (as opposed to e.g. a malformed-response ``OCRError``) to trigger the
    Tesseract fallback.
    """


def extract_cin_ollama(image_bytes: bytes) -> dict:
    """Extract structured CIN fields from a card image using a local Ollama vision model.

    Args:
        image_bytes: Raw bytes of the uploaded CIN image (JPEG/PNG).

    Returns:
        A dict with exactly the keys in ``REQUIRED_FIELDS``. Fields the model
        couldn't read are "" (it's instructed not to guess).

    Raises:
        OllamaUnavailableError: Ollama isn't reachable at ``OLLAMA_HOST`` —
            caller should fall back to another engine.
        OCRError: Ollama responded but the response was malformed.
        ExtractionError: The model found neither a CIN number nor a name.
    """
    raw = _call_ollama(image_bytes)

    data = {
        "first_name": str(raw.get("first_name") or "").strip(),
        "last_name": str(raw.get("last_name") or "").strip(),
        "cin_number": str(raw.get("cin_number") or "").strip().upper(),
        "date_of_birth": _normalize_date(raw.get("date_of_birth")),
        "place_of_birth": str(raw.get("place_of_birth") or "").strip(),
        "expiry_date": _normalize_date(raw.get("expiry_date")),
        "gender": _normalize_gender(raw.get("gender")),
    }
    data["full_name"] = f"{data['first_name']} {data['last_name']}".strip()

    # Gender has no printed field on the card, so the model can miss it — fall
    # back to a name-based heuristic. Best-effort; the user verifies before save.
    if not data["gender"]:
        data["gender"] = gender_from_name(data["first_name"])

    logger.info("Ollama (%s) parsed fields: %s", OLLAMA_MODEL, data)

    if not data["cin_number"] and not data["first_name"] and not data["last_name"]:
        raise ExtractionError(
            "Could not find a CIN number or name in this image. "
            "Try a clearer, well-lit, non-blurry photo of the card."
        )

    return data
