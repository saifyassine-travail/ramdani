"""Turn raw (patient_id-grouped) appointment rows into AnonymizedCase
objects, including a same-patient history of prior visits (dates made
relative). Shared by the real DB export and the synthetic-data generator so
both produce identically-shaped output."""
from collections import defaultdict

from .anonymize import AnonymizedCase, age_band, day_offset


def _vitals(row: dict) -> dict:
    vitals = {
        "Poids": row.get("weight"),
        "Pouls": row.get("pulse"),
        "Température": row.get("temperature"),
        "TA": row.get("blood_pressure"),
        "Taille": row.get("tall"),
        "SpO2": row.get("spo2"),
    }
    # custom_measures_values: doctor-defined extra vitals (see user_settings.
    # custom_measures), stored as a JSON list of {"name": ..., "value": ...}.
    for measure in row.get("custom_measures_values") or []:
        name = measure.get("name")
        if name:
            vitals[name] = measure.get("value")
    return vitals


def build_cases(rows: list[dict]) -> list[AnonymizedCase]:
    """`rows` must be sorted by (patient_id, appointment_date) ascending —
    that's what gives a correct, causal (past-only) history per case."""
    by_patient: dict[int, list[dict]] = defaultdict(list)
    for row in rows:
        by_patient[row["patient_id"]].append(row)

    cases = []
    for visits in by_patient.values():
        for i, visit in enumerate(visits):
            anchor_date = visit["appointment_date"]
            history = [
                f"{day_offset(prior['appointment_date'], anchor_date)}: "
                f"{prior.get('diagnostic') or prior.get('case_description') or prior['appointment_type']}"
                for prior in visits[:i]
                if prior.get("diagnostic") or prior.get("case_description")
            ]
            cases.append(
                AnonymizedCase(
                    internal_ref=f"appt:{visit['appointment_id']}",
                    gender="Homme" if visit["gender"] == "Male" else "Femme",
                    age_band=age_band(visit["birth_day"], anchor_date),
                    appointment_type=visit["appointment_type"],
                    diagnostic=visit.get("diagnostic") or "",
                    case_description=visit.get("case_description") or "",
                    notes=visit.get("notes") or "",
                    vitals=_vitals(visit),
                    medicaments=visit.get("medicaments", []),
                    analyses=visit.get("analyses", []),
                    history=history,
                )
            )
    return cases
