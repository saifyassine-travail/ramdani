"""Read-only access to the shared `mediassist` Postgres DB — same DB_* env
vars as Laravel's own .env and Backend/whatsapp-reminder-service. Never
writes here."""
import os

import psycopg2
import psycopg2.extras


def _connect():
    return psycopg2.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=os.environ.get("DB_PORT", "5432"),
        dbname=os.environ.get("DB_DATABASE", "mediassist"),
        user=os.environ.get("DB_USERNAME", "postgres"),
        password=os.environ.get("DB_PASSWORD", "root"),
        connect_timeout=5,
    )


def fetch_all_completed_appointments():
    """Every 'Terminé' (completed) appointment with its patient, vitals,
    medicaments and analyses — the raw material for the training set. Only
    completed visits: an in-progress or cancelled appointment has nothing
    worth summarizing yet."""
    with _connect() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    a."ID_RV" AS appointment_id,
                    a."ID_patient" AS patient_id,
                    a.appointment_date,
                    a.type AS appointment_type,
                    a.diagnostic,
                    p.gender,
                    p.birth_day,
                    cd.case_description,
                    cd.notes,
                    cd.weight, cd.pulse, cd.temperature, cd.blood_pressure,
                    cd.tall, cd.spo2, cd.custom_measures_values
                FROM appointments a
                JOIN patients p ON p."ID_patient" = a."ID_patient"
                LEFT JOIN case_descriptions cd ON cd."ID_RV" = a."ID_RV"
                WHERE a.status = 'Terminé'
                ORDER BY a."ID_patient", a.appointment_date
                """
            )
            appointments = list(cur.fetchall())

            cur.execute(
                """
                SELECT am."ID_RV" AS appointment_id, m.name, am.dosage, am.frequence, am.duree
                FROM appointment_medicament am
                JOIN medicaments m ON m."ID_Medicament" = am."ID_Medicament"
                """
            )
            meds_by_appt: dict[int, list[str]] = {}
            for row in cur.fetchall():
                label = row["name"]
                details = ", ".join(
                    v for v in (row["dosage"], row["frequence"], row["duree"]) if v
                )
                if details:
                    label = f"{label} ({details})"
                meds_by_appt.setdefault(row["appointment_id"], []).append(label)

            cur.execute(
                """
                SELECT aa."ID_RV" AS appointment_id, an.type_analyse
                FROM appointment_analyse aa
                JOIN analyses an ON an."ID_Analyse" = aa."ID_Analyse"
                """
            )
            analyses_by_appt: dict[int, list[str]] = {}
            for row in cur.fetchall():
                analyses_by_appt.setdefault(row["appointment_id"], []).append(row["type_analyse"])

    for appt in appointments:
        appt["medicaments"] = meds_by_appt.get(appt["appointment_id"], [])
        appt["analyses"] = analyses_by_appt.get(appt["appointment_id"], [])

    return appointments
