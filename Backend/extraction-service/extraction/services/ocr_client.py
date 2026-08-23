"""CIN OCR engine dispatch.

Public contract used by ``views.py`` (unchanged across this rewrite):
``extract_cin(image_bytes: bytes) -> dict`` returning exactly the keys in
``REQUIRED_FIELDS``, raising ``OCRError`` (-> 502) if the engine itself
failed, or ``ExtractionError`` (-> 422) if no usable fields were found.

Two engines are available:
    * ``ollama``    (default) — a local vision LLM via Ollama, see
      ``ollama_ocr.py``. More accurate (reads the card directly instead of
      plain-text OCR + regex), fully offline, but needs Ollama running with
      a vision model pulled, and is slower on CPU-only machines.
    * ``tesseract`` — the original local OCR + positional-heuristics engine,
      see ``tesseract_ocr.py``. No extra runtime dependency beyond the
      Tesseract binary, less accurate on real bilingual biometric cards.

Selection is via the ``OCR_ENGINE`` env var (``ollama`` or ``tesseract``,
default ``ollama``). When ``OCR_ENGINE=ollama`` and Ollama can't be reached
at all (not running, wrong ``OLLAMA_HOST``, network down), this
automatically falls back to Tesseract rather than failing the request
outright — so a clinic PC without Ollama set up (or with it temporarily
down) still gets a working, just less accurate, CIN scan instead of a hard
502. A genuine extraction failure (Ollama reachable but found no CIN/name)
does NOT fall back — that's a real "unreadable card" result either engine
would likely also fail on, not a reason to silently retry with the weaker
engine.
"""
import logging
from os import environ

from . import ollama_ocr, tesseract_ocr
from .ollama_ocr import OllamaUnavailableError

logger = logging.getLogger(__name__)

REQUIRED_FIELDS = ollama_ocr.REQUIRED_FIELDS

OCR_ENGINE = environ.get("OCR_ENGINE", "ollama").strip().lower()


def extract_cin(image_bytes: bytes) -> dict:
    """Extract structured CIN fields from a card image.

    See module docstring for engine selection / fallback behavior.
    """
    if OCR_ENGINE == "tesseract":
        return tesseract_ocr.extract_cin_tesseract(image_bytes)

    try:
        return ollama_ocr.extract_cin_ollama(image_bytes)
    except OllamaUnavailableError as exc:
        logger.warning(
            "Ollama unreachable (%s) — falling back to Tesseract for this request.", exc
        )
        return tesseract_ocr.extract_cin_tesseract(image_bytes)
