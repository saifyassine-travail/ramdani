"""Core reminder batch: find tomorrow's non-cancelled appointments, skip
anyone already reminded (SentReminder is the source of truth for that, not
the clock — this makes the job safe to call as often as you like), message
everyone else, and record the outcome either way so a bad number or a
permanent API error doesn't get retried forever (a transient error, e.g.
the WhatsApp session mid-reconnect, is deliberately NOT recorded, so the
next poll retries it).
"""
import logging

from ..models import SentReminder
from . import source_db
from .phone import normalize_phone
from .whatsapp_client import (
    WhatsAppNotConfigured,
    WhatsAppSendError,
    WhatsAppTransientError,
    send_appointment_reminder,
)

logger = logging.getLogger(__name__)


def run_reminder_batch(dry_run: bool = False) -> dict:
    appointments = source_db.get_tomorrow_appointments()
    already_sent_ids = set(
        SentReminder.objects.filter(
            appointment_id__in=[a["appointment_id"] for a in appointments]
        ).values_list("appointment_id", flat=True)
    )

    result = {"considered": len(appointments), "sent": 0, "skipped": 0, "failed": 0}

    for appt in appointments:
        appointment_id = appt["appointment_id"]
        if appointment_id in already_sent_ids:
            result["skipped"] += 1
            continue

        phone_e164 = normalize_phone(appt["phone_num"])
        appointment_date_str = appt["appointment_date"].strftime("%d/%m/%Y")

        if not phone_e164:
            logger.warning(
                "appointment %s: unusable phone number %r, skipping",
                appointment_id, appt["phone_num"],
            )
            _record(appointment_id, appt, phone_e164 or "", "failed", "invalid phone number", dry_run)
            result["failed"] += 1
            continue

        if dry_run:
            logger.info(
                "[dry-run] would remind appointment %s (%s %s -> %s) for %s",
                appointment_id, appt["first_name"], appt["last_name"],
                phone_e164, appointment_date_str,
            )
            result["sent"] += 1
            continue

        try:
            send_appointment_reminder(phone_e164, appt["first_name"], appointment_date_str)
        except WhatsAppNotConfigured as exc:
            logger.error("WhatsApp not configured: %s", exc)
            # Don't record — nothing was actually attempted, so a future
            # poll (once configured) should still try this appointment.
            result["failed"] += 1
            continue
        except WhatsAppTransientError as exc:
            logger.warning("appointment %s: transient error, will retry: %s", appointment_id, exc)
            result["failed"] += 1
            continue
        except WhatsAppSendError as exc:
            logger.error("appointment %s: send failed: %s", appointment_id, exc)
            _record(appointment_id, appt, phone_e164, "failed", str(exc), dry_run)
            result["failed"] += 1
            continue

        _record(appointment_id, appt, phone_e164, "sent", "", dry_run)
        result["sent"] += 1

    return result


def _record(appointment_id, appt, phone_e164, status, error, dry_run):
    if dry_run:
        return
    SentReminder.objects.update_or_create(
        appointment_id=appointment_id,
        defaults={
            "patient_id": appt["patient_id"],
            "appointment_date": appt["appointment_date"],
            "phone_e164": phone_e164,
            "status": status,
            "error": error,
        },
    )
