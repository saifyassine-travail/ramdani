"""
Minimal Django settings for the WhatsApp appointment-reminder microservice.

This service owns one local model (SentReminder, for dedup/idempotency) in
its own SQLite file. It never writes to the main `mediassist` Postgres
database — it only reads appointments/patients/user_settings from it via a
plain psycopg2 connection (see reminders/services/source_db.py), the same
read-only role the extraction-service's OCR pipeline plays for CIN uploads.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

try:
    from dotenv import load_dotenv

    load_dotenv(BASE_DIR / ".env")
except ImportError:  # pragma: no cover - dotenv is optional
    pass

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY", "dev-insecure-change-me-in-production"
)
DEBUG = os.environ.get("DJANGO_DEBUG", "true").lower() == "true"
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",")

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.staticfiles",
    "reminders",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": []},
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# This service's own state (SentReminder dedup log). Mounted on a volume in
# docker-compose so it survives container recreation.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.environ.get("SQLITE_PATH", BASE_DIR / "data" / "db.sqlite3"),
    }
}

LANGUAGE_CODE = "en-us"

# "whatsapp_reminder_hour" (set in the clinic's Settings page) is a clinic
# wall-clock hour, e.g. 11 means 11:00 in the clinic's own timezone — not
# UTC (the Laravel app's own config/app.php timezone is UTC, which has no
# bearing on what a doctor means by "11h"). Override if the clinic isn't in
# Morocco.
TIME_ZONE = os.environ.get("CLINIC_TIMEZONE", "Africa/Casablanca")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
