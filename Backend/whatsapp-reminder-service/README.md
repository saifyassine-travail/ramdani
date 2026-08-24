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
  DB (read-only), normalizes each patient's phone number, and sends a plain
  text reminder via a self-hosted **Open-WA** gateway
  (`reminders/services/whatsapp_client.py`).
- Every appointment reminded (successfully or not) is recorded in this
  service's own SQLite table (`sent_reminders`), so nobody gets reminded
  twice even across restarts or frequent polling. A *transient* failure
  (the WhatsApp session mid-reconnect) is deliberately not recorded, so
  it's retried on the next poll instead of being given up on permanently.

## WhatsApp provider: Open-WA (unofficial) — know the tradeoff

This drives a real WhatsApp Web session via [Open-WA](https://openwa.dev),
not Meta's official Cloud API: **no** business verification, **no**
message-template approval, free. In exchange: it **violates WhatsApp's
Terms of Service**, and the linked number can be suspended or banned by
WhatsApp at any time, with no appeal. Chosen deliberately anyway — if that
tradeoff ever needs to flip back to the compliant, template-based Meta
Cloud API, that implementation is still straightforward to restore (git
history / ask to re-add it) — the parts that would change are just
`whatsapp_client.py` and the `OPENWA_*` env vars, nothing else in this
service.

## Required setup (you do this once, outside this repo)

An Open-WA instance must already be running and linked (QR-code scan with
the clinic's WhatsApp, once) — see `~/OpenWA` on this machine, or
https://openwa.dev/docs/getting-started for a fresh setup elsewhere. Then
see `.env.example` for `OPENWA_URL`/`OPENWA_API_KEY`/`OPENWA_SESSION_ID`.
Nothing sends until those are set; until then the poller just logs
"WhatsApp not configured" and does nothing destructive.

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
