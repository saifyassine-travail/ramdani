"""Read-only access to the shared `mediassist` Postgres DB, scoped to one
patient's completed appointments — same DB_* env vars and same read-only
role as Backend/whatsapp-reminder-service and summary-lab."""
import os

import psycopg2
import psycopg2.extras


def _connect():
    return psycopg2.connect(
        host=os.environ.get("DB_HOST", "host.docker.internal"),
        port=os.environ.get("DB_PORT", "5432"),
        dbname=os.environ.get("DB_DATABASE", "mediassist"),
        user=os.environ.get("DB_USERNAME", "postgres"),
        password=os.environ.get("DB_PASSWORD", ""),
        connect_timeout=5,
    )


def fetch_patient_completed_appointments(patient_id: int):
    """This patient's 'Terminé' appointments, oldest first, with vitals,
    medicaments and analyses attached. Same shape as summary-lab's export
    query, scoped with a WHERE ID_patient = %s instead of pulling everyone."""
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
                    p.birth_day
                FROM appointments a
                JOIN patients p ON p."ID_patient" = a."ID_patient"
                WHERE a."ID_patient" = %s AND a.status = 'Terminé'
                ORDER BY a.appointment_date ASC
                """,
                (patient_id,),
            )
            appointments = list(cur.fetchall())
            if not appointments:
                return []

            appt_ids = [a["appointment_id"] for a in appointments]

            cur.execute(
                """
                SELECT "ID_RV" AS appointment_id, case_description, notes,
                       weight, pulse, temperature, blood_pressure, tall, spo2,
                       custom_measures_values
                FROM case_descriptions WHERE "ID_RV" = ANY(%s)
                """,
                (appt_ids,),
            )
            cd_by_appt = {row["appointment_id"]: row for row in cur.fetchall()}

            cur.execute(
                """
                SELECT am."ID_RV" AS appointment_id, m.name, am.dosage, am.frequence, am.duree
                FROM appointment_medicament am
                JOIN medicaments m ON m."ID_Medicament" = am."ID_Medicament"
                WHERE am."ID_RV" = ANY(%s)
                """,
                (appt_ids,),
            )
            meds_by_appt: dict[int, list[str]] = {}
            for row in cur.fetchall():
                label = row["name"]
                details = ", ".join(v for v in (row["dosage"], row["frequence"], row["duree"]) if v)
                if details:
                    label = f"{label} ({details})"
                meds_by_appt.setdefault(row["appointment_id"], []).append(label)

            cur.execute(
                """
                SELECT aa."ID_RV" AS appointment_id, an.type_analyse
                FROM appointment_analyse aa
                JOIN analyses an ON an."ID_Analyse" = aa."ID_Analyse"
                WHERE aa."ID_RV" = ANY(%s)
                """,
                (appt_ids,),
            )
            analyses_by_appt: dict[int, list[str]] = {}
            for row in cur.fetchall():
                analyses_by_appt.setdefault(row["appointment_id"], []).append(row["type_analyse"])

    for appt in appointments:
        cd = cd_by_appt.get(appt["appointment_id"], {})
        appt["case_description"] = cd.get("case_description")
        appt["notes"] = cd.get("notes")
        appt["weight"] = cd.get("weight")
        appt["pulse"] = cd.get("pulse")
        appt["temperature"] = cd.get("temperature")
        appt["blood_pressure"] = cd.get("blood_pressure")
        appt["tall"] = cd.get("tall")
        appt["spo2"] = cd.get("spo2")
        appt["custom_measures_values"] = cd.get("custom_measures_values")
        appt["medicaments"] = meds_by_appt.get(appt["appointment_id"], [])
        appt["analyses"] = analyses_by_appt.get(appt["appointment_id"], [])

    return appointments
