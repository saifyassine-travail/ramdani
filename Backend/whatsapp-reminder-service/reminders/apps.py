from django.apps import AppConfig


class RemindersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "reminders"

    def ready(self):
        # manage.py runs this on every invocation (migrate, test, shell, ...),
        # not just the server — only start the background poller when serving
        # (RUN_SERVER=true, set by the Dockerfile's gunicorn CMD). Gunicorn
        # is pinned to a single worker (see Dockerfile) so this can't start
        # more than once per container.
        import os

        if os.environ.get("RUN_SERVER") != "true":
            return
        if os.environ.get("WHATSAPP_REMINDER_DISABLE_SCHEDULER") == "true":
            return

        from .services.scheduler import start_scheduler

        start_scheduler()
