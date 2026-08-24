"""In-process poller: every POLL_MINUTES, check the clinic's configured
reminder hour (Settings -> Rappels, default 11) against the current wall
clock in TIME_ZONE. Once we've reached that hour, run the reminder batch —
SentReminder's per-appointment uniqueness means repeated polls after the
target hour just no-op for anyone already reminded, so there's no separate
"did we already run today" state to track, and it survives restarts and
same-day bookings made after the target hour cleanly.
"""
import logging
import os

from apscheduler.schedulers.background import BackgroundScheduler
from django.utils import timezone

logger = logging.getLogger(__name__)

POLL_MINUTES = int(os.environ.get("WHATSAPP_REMINDER_POLL_MINUTES", "15"))

_scheduler = None


def _poll():
    from . import source_db
    from .reminder_job import run_reminder_batch

    configured_hour = source_db.get_reminder_hour()
    current_hour = timezone.localtime().hour

    if current_hour < configured_hour:
        return

    try:
        result = run_reminder_batch()
        logger.info("reminder batch: %s", result)
    except Exception:
        logger.exception("reminder batch failed")


def start_scheduler():
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(timezone=str(timezone.get_current_timezone()))
    _scheduler.add_job(
        _poll, "interval", minutes=POLL_MINUTES, next_run_time=timezone.localtime()
    )
    _scheduler.start()
    logger.info("reminder scheduler started, polling every %s minutes", POLL_MINUTES)
