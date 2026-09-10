"""Sends appointment-reminder messages via Meta's official WhatsApp Cloud API.

This replaces the earlier Open-WA gateway (unofficial WhatsApp Web
automation), which was free and could send arbitrary text but violated
WhatsApp's Terms of Service and put the clinic's number at risk of a
permanent ban with no appeal.

The tradeoff we took on in exchange:

A reminder goes to a patient who has not messaged the clinic, so it falls
OUTSIDE the 24-hour customer service window. Meta does not allow freeform
text there — only a pre-approved *template*. That is why there is no
_build_message() any more: the French wording now lives in the template
registered on the WhatsApp Business Account, and this module only supplies
the two positional variables it declares:

    {{1}}  patient first name
    {{2}}  appointment date, already formatted in French by reminder_job

Changing the reminder wording therefore means creating a new template and
waiting for Meta to approve it — it is no longer a one-line edit here.

Utility templates delivered outside an open service window are billed on
delivery, so the WhatsApp Business Account needs a payment method or sends
start failing.
"""
import os

import requests

API_VERSION = os.environ.get("WHATSAPP_API_VERSION", "v21.0")
GRAPH_URL = os.environ.get("WHATSAPP_GRAPH_URL", "https://graph.facebook.com")

# Meta error codes that mean "try again later", not "this appointment is
# unreachable". Anything not listed here is treated as permanent so the
# appointment gets recorded as failed instead of retried every poll forever.
TRANSIENT_META_CODES = {
    1,       # API unknown — Meta's own transient bucket
    2,       # API service temporarily unavailable
    4,       # API too many calls
    130429,  # Cloud API rate limit hit
    131048,  # spam rate limit hit
    131056,  # pair rate limit (this business/recipient pair, too frequent)
    133016,  # account temporarily unavailable (restore in progress)
    # "template name does not exist in <lang>" — which is also what Meta
    # answers while a freshly submitted template is still PENDING review.
    # Treating it as permanent would be a quiet disaster on rollout day:
    # every appointment in the batch would be recorded as failed and never
    # retried, so the first day's patients would silently get nothing even
    # after approval landed an hour later. Retrying costs only a log line.
    132001,
}


class WhatsAppNotConfigured(Exception):
    pass


class WhatsAppSendError(Exception):
    pass


class WhatsAppTransientError(Exception):
    """Not the appointment's fault — e.g. a rate limit or a Meta-side blip.
    Callers should NOT record this as a permanent failure; the next
    scheduler poll should retry."""
    pass


def _config():
    token = os.environ.get("WHATSAPP_TOKEN")
    phone_number_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID")

    if not token or not phone_number_id:
        raise WhatsAppNotConfigured(
            "WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID must both be set — "
            "see .env.example."
        )

    # The template must already be APPROVED on the WABA; a PENDING or
    # REJECTED one is rejected at send time with error 132001.
    template = os.environ.get("WHATSAPP_TEMPLATE_NAME", "rappel_rendez_vous")
    language = os.environ.get("WHATSAPP_TEMPLATE_LANG", "fr")
    return token, phone_number_id, template, language


def send_appointment_reminder(to_e164: str, patient_first_name: str, appointment_date_str: str) -> None:
    token, phone_number_id, template, language = _config()

    # `to` takes the number in E.164 *without* the leading '+', which is
    # exactly what phone.normalize_phone() already produces.
    url = f"{GRAPH_URL}/{API_VERSION}/{phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to_e164,
        "type": "template",
        "template": {
            "name": template,
            "language": {"code": language},
            "components": [
                {
                    "type": "body",
                    # Positional parameters — order matters and must match
                    # the {{1}}/{{2}} order declared in the approved template.
                    "parameters": [
                        {"type": "text", "text": patient_first_name},
                        {"type": "text", "text": appointment_date_str},
                    ],
                }
            ],
        },
    }

    try:
        resp = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=20,
        )
    except requests.RequestException as exc:
        # DNS hiccup, TLS reset, read timeout — the appointment is fine,
        # the network was not. Retry on the next poll.
        raise WhatsAppTransientError(f"could not reach the Graph API: {exc}") from exc

    if resp.status_code == 200:
        return

    # Meta puts the useful part in a JSON error object; fall back to the raw
    # body when it answers with something that isn't JSON (a proxy error page).
    try:
        error = resp.json().get("error", {})
    except ValueError:
        error = {}
    code = error.get("code")
    # error.message is often just "(#100) Invalid parameter"; the sentence
    # that actually says what is wrong lives in error_data.details.
    detail = error.get("error_data", {}).get("details") or error.get("message") or resp.text

    if resp.status_code == 429 or resp.status_code >= 500 or code in TRANSIENT_META_CODES:
        raise WhatsAppTransientError(f"{resp.status_code}/{code}: {detail}")

    raise WhatsAppSendError(f"{resp.status_code}/{code}: {detail}")
