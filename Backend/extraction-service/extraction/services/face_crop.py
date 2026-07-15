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

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    faces = cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(60, 60),
    )

    if len(faces) == 0:
        raise FaceNotFoundError("No face was detected in the uploaded image.")

    # Pick the largest detection by area (width * height).
    x, y, w, h = max(faces, key=lambda box: box[2] * box[3])
    face = image[y : y + h, x : x + w]

    success, buffer = cv2.imencode(".jpg", face)
    if not success:
        raise ExtractionError("Failed to encode the cropped face as JPEG.")

    return buffer.tobytes()
