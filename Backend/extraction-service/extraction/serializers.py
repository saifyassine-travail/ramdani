"""Serializers for the extraction endpoints."""
import os

from rest_framework import serializers

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png"}


class CINUploadSerializer(serializers.Serializer):
    """Validates a single uploaded CIN image (JPG/JPEG/PNG, max 10 MB)."""

    file = serializers.FileField()

    def validate_file(self, value):
        extension = os.path.splitext(value.name or "")[1].lower()
        if extension not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError(
                "Unsupported file type. Only JPG, JPEG and PNG images are allowed."
            )

        content_type = (getattr(value, "content_type", "") or "").lower()
        if content_type and content_type not in ALLOWED_CONTENT_TYPES:
            raise serializers.ValidationError(
                f"Unsupported content type '{content_type}'. "
                "Only JPEG and PNG images are allowed."
            )

        if value.size > MAX_UPLOAD_SIZE:
            raise serializers.ValidationError(
                "File too large. The maximum allowed size is 10 MB."
            )

        return value
