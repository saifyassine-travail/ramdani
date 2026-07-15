"""API views for CIN extraction."""
import base64

from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import CINUploadSerializer
from .services.exceptions import ExtractionError, GeminiAPIError
from .services.face_crop import crop_face
from .services.vision_client import extract_cin
from .validators import validate_cin_fields


class ExtractCINView(APIView):
    """POST a Moroccan CIN image; get back structured fields + a cropped face.

    Response shape (200)::

        {
            "data": { "full_name": ..., "cin_number": ..., ... },
            "photo_base64": "<base64 JPEG of the cropped face>",
            "validation": { "cin_number": true, ... }
        }

    Status codes:
        * 400 - invalid upload (missing file, wrong type, too large)
        * 422 - extraction/parse failed, or no face found
        * 502 - the Gemini vision call itself failed
    """

    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = CINUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": "Invalid upload.", "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        image_bytes = serializer.validated_data["file"].read()

        try:
            data = extract_cin(image_bytes)
        except GeminiAPIError as exc:
            return Response(
                {"error": "Vision service request failed.", "detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except ExtractionError as exc:
            return Response(
                {"error": "Could not extract CIN data.", "detail": str(exc)},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        try:
            face_bytes = crop_face(image_bytes)
        except ExtractionError as exc:
            return Response(
                {"error": "Could not crop a face from the image.", "detail": str(exc)},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        photo_base64 = base64.b64encode(face_bytes).decode("ascii")

        return Response(
            {
                "data": data,
                "photo_base64": photo_base64,
                "validation": validate_cin_fields(data),
            },
            status=status.HTTP_200_OK,
        )
