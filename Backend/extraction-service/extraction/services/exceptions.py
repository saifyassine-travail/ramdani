"""Custom exceptions for the extraction pipeline.

The view distinguishes these to pick the right HTTP status:

* ``OCRError``          -> the OCR engine itself failed (missing binary,   -> 502
                            corrupt/undecodable image)
* ``ExtractionError``   -> no usable fields could be parsed from the OCR   -> 422
                            text
* ``FaceNotFoundError`` (an ``ExtractionError``) -> no face detected       -> 422
"""


class ExtractionError(Exception):
    """Raised when CIN data cannot be parsed or validated from the OCR output."""


class OCRError(Exception):
    """Raised when the OCR engine itself fails (binary missing, bad image, etc.)."""


class FaceNotFoundError(ExtractionError):
    """Raised when no face can be detected in the uploaded image."""
