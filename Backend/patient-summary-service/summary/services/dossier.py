"""Combine a patient's completed-appointment rows (from source_db) into one
anonymized, chronological dossier text — the live-summarization counterpart
to summary-lab's per-visit training rows. Same redaction rules as
anonymize.py: no name/CIN/phone/email/address/exact birth date, dates
relative (here: relative to the most recent visit, not "today", so the
text reads naturally as "J0" = the latest visit)."""
from .anonymize import age_band, day_offset
from .build_cases import _vitals


def build_dossier_text(rows: list[dict]) -> str:
    """`rows` must be sorted by appointment_date ascending, all belonging to
    the same patient (source_db.fetch_patient_completed_appointments does
    both)."""
    if not rows:
        return ""

    latest_date = rows[-1]["appointment_date"]
    first = rows[0]

    lines = [
        f"Patient: {'Homme' if first['gender'] == 'Male' else 'Femme'}, "
        f"{age_band(first['birth_day'], latest_date)} ans",
        f"Historique clinique ({len(rows)} visite(s) terminée(s), dates relatives à la visite la plus récente):",
        "",
    ]
    for row in rows:
        lines.append(f"--- Visite {day_offset(row['appointment_date'], latest_date)} ---")
        lines.append(f"Type: {row['appointment_type']}")
        vitals_line = ", ".join(f"{k}: {v}" for k, v in _vitals(row).items() if v not in (None, ""))
        if vitals_line:
            lines.append(f"Constantes: {vitals_line}")
        if row.get("diagnostic"):
            lines.append(f"Diagnostic: {row['diagnostic']}")
        if row.get("case_description"):
            lines.append(f"Description: {row['case_description']}")
        if row.get("notes"):
            lines.append(f"Notes: {row['notes']}")
        if row.get("medicaments"):
            lines.append("Médicaments: " + "; ".join(row["medicaments"]))
        if row.get("analyses"):
            lines.append("Analyses/examens: " + ", ".join(row["analyses"]))
        lines.append("")

    return "\n".join(lines)
