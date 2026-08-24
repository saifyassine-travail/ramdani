from django.db import models


class SentReminder(models.Model):
    """One row per appointment we've successfully (or unsuccessfully)
    attempted a WhatsApp reminder for. The unique appointment_id is what
    makes the reminder batch idempotent across repeated scheduler polls
    and container restarts."""

    appointment_id = models.BigIntegerField(unique=True)
    patient_id = models.BigIntegerField()
    appointment_date = models.DateField()
    phone_e164 = models.CharField(max_length=32)
    status = models.CharField(max_length=16)  # "sent" or "failed"
    error = models.TextField(blank=True, default="")
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "sent_reminders"

    def __str__(self):
        return f"appointment {self.appointment_id} -> {self.status}"
