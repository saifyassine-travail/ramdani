"""Sends appointment-reminder messages via a self-hosted Open-WA gateway
(https://openwa.dev — unofficial WhatsApp Web automation, not Meta's Cloud
API: no business verification or template approval needed, but it violates
WhatsApp's Terms of Service and the linked number can be banned. See
this service's README for the tradeoff and setup.

No template system here — Open-WA sends freeform text, so the message is
built directly in _build_message() below.
"""
import os

import requests

OPENWA_URL = os.environ.get("OPENWA_URL", "http://openwa-api:2785")


class WhatsAppNotConfigured(Exception):
    pass


class WhatsAppSendError(Exception):
    pass


class WhatsAppTransientError(Exception):
    """Not the appointment's fault — e.g. the session is mid-reconnect.
    Callers should NOT record this as a permanent failure; the next
    scheduler poll should retry."""
    pass


def _config():
    api_key = os.environ.get("OPENWA_API_KEY")
    session_id = os.environ.get("OPENWA_SESSION_ID")

    if not api_key or not session_id:
        raise WhatsAppNotConfigured(
            "OPENWA_API_KEY and OPENWA_SESSION_ID must both be set — see .env.example."
        )
    return api_key, session_id


def _build_message(patient_first_name: str, appointment_date_str: str) -> str:
    return (
        f"Bonjour {patient_first_name},\n\n"
        f"Ceci est un rappel de votre rendez-vous prévu le {appointment_date_str} "
        f"au cabinet.\n\nMerci de nous contacter si vous devez le reporter."
    )


def send_appointment_reminder(to_e164: str, patient_first_name: str, appointment_date_str: str) -> None:
    api_key, session_id = _config()

    url = f"{OPENWA_URL}/api/sessions/{session_id}/messages/send-text"
    payload = {
        "chatId": f"{to_e164}@c.us",
        "text": _build_message(patient_first_name, appointment_date_str),
    }
    resp = requests.post(
        url,
        headers={"X-API-Key": api_key},
        json=payload,
        timeout=20,
    )
    if resp.status_code == 409:
        # Session mid-reconnect (WhatsApp Web's own periodic page reload).
        raise WhatsAppTransientError(f"session not connected, will retry: {resp.text}")
    if resp.status_code >= 400:
        raise WhatsAppSendError(f"{resp.status_code}: {resp.text}")
