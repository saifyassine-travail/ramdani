from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="SentReminder",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("appointment_id", models.BigIntegerField(unique=True)),
                ("patient_id", models.BigIntegerField()),
                ("appointment_date", models.DateField()),
                ("phone_e164", models.CharField(max_length=32)),
                ("status", models.CharField(max_length=16)),
                ("error", models.TextField(blank=True, default="")),
                ("sent_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "sent_reminders",
            },
        ),
    ]
