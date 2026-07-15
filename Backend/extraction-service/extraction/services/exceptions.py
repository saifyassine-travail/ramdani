"""Custom exceptions for the extraction pipeline.

The view distinguishes these to pick the right HTTP status:

* ``GeminiAPIError``   -> the vision API call itself failed        -> 502
* ``ExtractionError``  -> the response could not be parsed/validated -> 422
* ``FaceNotFoundError`` (an ``ExtractionError``) -> no face detected  -> 422
"""


class ExtractionError(Exception):
    """Raised when CIN data cannot be parsed or validated from the model output."""


class GeminiAPIError(Exception):
    """Raised when the Gemini API request itself fails (network, auth, quota)."""


class FaceNotFoundError(ExtractionError):
    """Raised when no face can be detected in the uploaded image."""
