"""Tests for the CIN extraction endpoint.

Both the OCR call (``extract_cin``) and the OpenCV face crop (``crop_face``)
are mocked, so these tests need no Tesseract install, no network, and no
real image.
"""
import base64
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

EXTRACTED = {
    "first_name": "Mohammed",
    "last_name": "Alaoui",
    "full_name": "Mohammed Alaoui",
    "cin_number": "K01234567",
    "date_of_birth": "1990-05-14",
    "place_of_birth": "Casablanca",
    "expiry_date": "2032-01-01",
}
FACE_BYTES = b"\xff\xd8\xff\xe0fake-jpeg-face-bytes"


class ExtractCINViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = "/api/extract/cin/"

    def _upload(self):
        return SimpleUploadedFile(
            "cin.jpg", b"pretend-image-bytes", content_type="image/jpeg"
        )

    @patch("extraction.views.crop_face")
    @patch("extraction.views.extract_cin")
    def test_returns_200_with_expected_shape(self, mock_extract, mock_crop):
        mock_extract.return_value = EXTRACTED
        mock_crop.return_value = FACE_BYTES

        response = self.client.post(
            self.url, {"file": self._upload()}, format="multipart"
        )

        self.assertEqual(response.status_code, 200)

        body = response.data
        self.assertEqual(set(body.keys()), {"data", "photo_base64", "validation"})
        self.assertEqual(body["data"], EXTRACTED)
        self.assertEqual(
            body["photo_base64"], base64.b64encode(FACE_BYTES).decode("ascii")
        )
        self.assertEqual(
            body["validation"],
            {
                "cin_number": True,
                "date_of_birth": True,
                "expiry_date": True,
                "full_name": True,
            },
        )

        mock_extract.assert_called_once()
        mock_crop.assert_called_once()

    def test_rejects_non_image_upload_with_400(self):
        bad = SimpleUploadedFile(
            "notes.txt", b"hello", content_type="text/plain"
        )
        response = self.client.post(self.url, {"file": bad}, format="multipart")
        self.assertEqual(response.status_code, 400)
