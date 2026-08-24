from django.core.management.base import BaseCommand

from reminders.services.reminder_job import run_reminder_batch


class Command(BaseCommand):
    help = "Send WhatsApp reminders for tomorrow's non-cancelled appointments (skips anyone already reminded)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Log what would be sent without calling the WhatsApp API or recording anything.",
        )

    def handle(self, *args, **options):
        result = run_reminder_batch(dry_run=options["dry_run"])
        self.stdout.write(self.style.SUCCESS(str(result)))
