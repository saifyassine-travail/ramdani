FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN mkdir -p /app/data

EXPOSE 8200

# RUN_SERVER is intentionally set only on the gunicorn command below, not as
# an image-wide ENV — apps.py starts the scheduler whenever it sees
# RUN_SERVER=true, and a Dockerfile-wide ENV would leak into every `docker
# exec ... manage.py ...` (migrate, send_reminders --dry-run, a shell, ...),
# starting a second, REAL, uncontrolled scheduler thread inside a process
# meant to just migrate or dry-run — that thread doesn't respect --dry-run
# and would send live messages behind the command's back.
#
# Single worker: the reminder poller (reminders/services/scheduler.py) starts
# once per process in AppConfig.ready() — more workers would poll (and,
# past the target hour, attempt to send) redundantly. SentReminder's unique
# appointment_id would still prevent duplicate sends, but there's no reason
# to pay for it.
CMD python manage.py migrate --noinput && \
    RUN_SERVER=true gunicorn config.wsgi:application --bind 0.0.0.0:8200 --workers 1 --timeout 30
