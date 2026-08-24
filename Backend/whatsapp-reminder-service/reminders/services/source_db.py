"""Read-only access to the shared `mediassist` Postgres database (owned by
the Laravel backend — see Backend/MediAssist). This service never writes
here; it only reads tomorrow's appointments and the configured reminder
hour. Uses the same DB_* env var names as Laravel's own .env for one less
thing to keep in sync.
"""
import os
from datetime import date, timedelta

import psycopg2
import psycopg2.extras

DEFAULT_REMINDER_HOUR = 11

# 'Annulé' (cancelled) appointments never get a reminder.
CANCELLED_STATUS = "Annulé"


def _connect():
    return psycopg2.connect(
        host=os.environ.get("DB_HOST", "host.docker.internal"),
        port=os.environ.get("DB_PORT", "5432"),
        dbname=os.environ.get("DB_DATABASE", "mediassist"),
        user=os.environ.get("DB_USERNAME", "postgres"),
        password=os.environ.get("DB_PASSWORD", ""),
        connect_timeout=5,
    )


def get_reminder_hour() -> int:
    """Clinic wall-clock hour (0-23) configured in Settings -> Rappels ->
    "Heure d'envoi du rappel WhatsApp". Single-tenant app: one clinic, so we
    just take the first user_settings row. Falls back to the same default
    (11) the Settings UI and migration use if no row exists yet."""
    try:
        with _connect() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT whatsapp_reminder_hour FROM user_settings "
                "ORDER BY id ASC LIMIT 1"
            )
            row = cur.fetchone()
            if row and row[0] is not None:
                return int(row[0])
    except Exception:
        pass
    return DEFAULT_REMINDER_HOUR


def get_tomorrow_appointments():
    """Non-cancelled appointments dated tomorrow, with the patient's name
    and raw phone number. Returns a list of dicts."""
    tomorrow = date.today() + timedelta(days=1)
    with _connect() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    a."ID_RV" AS appointment_id,
                    a.appointment_date,
                    p."ID_patient" AS patient_id,
                    p.first_name,
                    p.last_name,
                    p.phone_num
                FROM appointments a
                JOIN patients p ON p."ID_patient" = a."ID_patient"
                WHERE a.appointment_date = %s
                  AND a.status != %s
                  AND (p.archived IS NULL OR p.archived = false)
                """,
                (tomorrow, CANCELLED_STATUS),
            )
            return list(cur.fetchall())
