"""Face detection and cropping using OpenCV's pretrained Haar cascade.

No training is required: ``haarcascade_frontalface_default.xml`` ships with the
``opencv-python-headless`` package (``cv2.data.haarcascades``).
"""
import cv2
import numpy as np

from .exceptions import ExtractionError, FaceNotFoundError

_CASCADE_PATH = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"


def crop_face(image_bytes: bytes) -> bytes:
    """Detect the largest frontal face in an image and return it as JPEG bytes.

    Args:
        image_bytes: Raw bytes of the source image (e.g. the CIN card photo).

    Returns:
        JPEG-encoded bytes of the cropped face region.

    Raises:
        ExtractionError: If the image cannot be decoded or the cascade cannot load.
        FaceNotFoundError: If no face is detected in the image.
    """
    array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise ExtractionError("The uploaded file could not be decoded as an image.")

    cascade = cv2.CascadeClassifier(_CASCADE_PATH)
    if cascade.empty():
        raise ExtractionError(
            f"Failed to load the Haar cascade classifier from {_CASCADE_PATH!r}."
        )

    # CIN photos come off a phone at any orientation. The Haar cascade only
    # finds upright/near-upright frontal faces, so try all four 90° rotations
    # and keep the first (largest) face found — this is what makes rotated
    # cards work instead of failing with "No face was detected".
    face = _detect_face_any_orientation(image, cascade)
    if face is None:
        raise FaceNotFoundError("No face was detected in the uploaded image.")

    success, buffer = cv2.imencode(".jpg", face)
    if not success:
        raise ExtractionError("Failed to encode the cropped face as JPEG.")

    return buffer.tobytes()


# (orientation, cv2 rotation code). None = as-is; the rest are the three 90°
# steps. Order matters only for tie-breaking — we pick the largest face across
# all orientations, preferring the upright reading when sizes tie.
_ORIENTATIONS = (
    (0, None),
    (90, cv2.ROTATE_90_CLOCKWISE),
    (180, cv2.ROTATE_180),
    (270, cv2.ROTATE_90_COUNTERCLOCKWISE),
)


def _detect_face_any_orientation(image, cascade):
    """Return the largest face crop across 0/90/180/270° rotations, or None.

    Args:
        image: BGR image (numpy array) as decoded by ``cv2.imdecode``.
        cascade: a loaded, non-empty ``cv2.CascadeClassifier``.

    Returns:
        The cropped face region (BGR numpy array) from whichever orientation
        gave the biggest detection, or ``None`` if no orientation yields a face.
    """
    best_face = None
    best_area = 0

    for _angle, rotation in _ORIENTATIONS:
        rotated = image if rotation is None else cv2.rotate(image, rotation)
        gray = cv2.cvtColor(rotated, cv2.COLOR_BGR2GRAY)
        faces = cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(60, 60),
        )
        for x, y, w, h in faces:
            area = w * h
            if area > best_area:
                best_area = area
                best_face = rotated[y : y + h, x : x + w]

    return best_face
