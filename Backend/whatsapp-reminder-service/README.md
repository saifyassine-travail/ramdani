# whatsapp-reminder-service

Sends a WhatsApp reminder to every patient whose appointment is dated
**tomorrow**, once per day at the hour configured in Settings ("Heure
d'envoi du rappel WhatsApp", default 11:00, clinic-local time).

Why "the day" and not "24h before an exact time": `appointments` in this app
only store a date (`appointment_date`) — there's no real scheduled clock
time, it's a walk-in queue. So this is the closest honest equivalent of a
24h-before reminder.

## How it works

- A background poller (`reminders/services/scheduler.py`) checks every
  `WHATSAPP_REMINDER_POLL_MINUTES` (default 15) whether the clinic's local
  time has reached the configured hour; once it has, it runs the batch.
- The batch (`reminders/services/reminder_job.py`) reads tomorrow's
  non-cancelled appointments directly from the shared `mediassist` Postgres
  DB (read-only), normalizes each patient's phone number, and sends the
  reminder as an approved template via Meta's **WhatsApp Cloud API**
  (`reminders/services/whatsapp_client.py`).
- Every appointment reminded (successfully or not) is recorded in this
  service's own SQLite table (`sent_reminders`), so nobody gets reminded
  twice even across restarts or frequent polling. A *transient* failure
  (the WhatsApp session mid-reconnect) is deliberately not recorded, so
  it's retried on the next poll instead of being given up on permanently.

## WhatsApp provider: Meta Cloud API (official)

This used to drive a real WhatsApp Web session via [Open-WA](https://openwa.dev)
— free, freeform text, no approvals, but it **violated WhatsApp's Terms of
Service** and the clinic's number could be banned at any time with no
appeal. Not a risk worth running on a medical practice's only number, so
the service now uses Meta's official Cloud API instead.

What that costs us, and it is not nothing:

- **No freeform text.** A reminder goes to a patient who has not messaged
  the clinic, so it falls outside Meta's 24-hour *customer service window*,
  where only a pre-approved **template** may be sent. The French wording
  lives in the template on the WABA, not in `whatsapp_client.py`. Changing
  the wording means creating a new template and waiting for approval again
  (usually minutes, up to 24h) — it is no longer a one-line edit.
- **It is billed.** Utility templates are free only *inside* an open
  service window, which a reminder never is. Every delivered reminder is
  charged, so the WhatsApp Business Account needs a payment method or
  sends start failing.
- **Rate tier.** The number starts at `TIER_250` (250 unique recipients per
  rolling 24h). Fine for ~40 patients/day; Meta raises it automatically as
  volume and quality build.

## Required setup (you do this once, outside this repo)

Everything lives on the clinic's WhatsApp Business Account. You need a
**System User** token (not a Graph Explorer one — those expire within the
hour), the sending number's **phone number ID**, and an **APPROVED**
template. See `.env.example` for exactly where each comes from.

Nothing sends until `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` are
set; until then the poller just logs "WhatsApp not configured" and does
nothing destructive. If the template is still `PENDING`, sends fail with
Meta error `132001` — that is the template, not the config.

Check the template's state at any time:

```bash
curl -sG "https://graph.facebook.com/v21.0/<WABA_ID>/message_templates" \
     --data-urlencode "fields=name,status,category,language" \
     -H "Authorization: Bearer $WHATSAPP_TOKEN"
```

## Manual testing

```bash
# Dry run: logs who WOULD be reminded, sends nothing, records nothing.
docker exec mediassist_whatsapp_reminder python manage.py send_reminders --dry-run

# Real send, right now, without waiting for the configured hour:
docker exec mediassist_whatsapp_reminder python manage.py send_reminders

# Same, over HTTP (internal network only, no published port):
docker exec mediassist_whatsapp_reminder \
  curl -s -X POST 'http://localhost:8200/api/send-now?dry_run=1'

# Health / last-sent check:
docker exec mediassist_whatsapp_reminder curl -s http://localhost:8200/api/health
```
