#!/usr/bin/env python
"""Generate obviously-fake case rows, shaped exactly like services.source_db's
real query output, so the rest of the pipeline (build_cases -> draft ->
review -> train) can be exercised end-to-end before any real patient data
exists. Never reads or writes the real database.
"""
import argparse
import json
import random
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.build_cases import build_cases  # noqa: E402

DIAGNOSES = [
    "Cystite aiguë non compliquée",
    "Suivi grossesse T2, RAS",
    "Contrôle post-opératoire, cicatrisation normale",
    "Ménométrorragies à explorer",
    "Contraception, renouvellement pilule",
    "Douleurs pelviennes chroniques",
    "Infection vaginale à Candida",
    "Contrôle stérilet, position correcte",
]
MEDS = [
    ("Amoxicilline", "500mg", "3x/jour", "7 jours"),
    ("Paracétamol", "1g", "si douleur", "5 jours"),
    ("Acide folique", "5mg", "1x/jour", "3 mois"),
    ("Fluconazole", "150mg", "dose unique", "1 jour"),
]
ANALYSES = ["Échographie pelvienne", "ECBU", "NFS", "Bilan hormonal", "Frottis cervico-vaginal"]


def make_patient_rows(patient_id: int, n_visits: int, rng: random.Random) -> list[dict]:
    birth_day = date(rng.randint(1970, 2005), rng.randint(1, 12), rng.randint(1, 28))
    gender = "Female"
    start = date.today() - timedelta(days=rng.randint(30, 800))
    rows = []
    for v in range(n_visits):
        appt_date = start + timedelta(days=v * rng.randint(20, 90))
        rows.append(
            {
                "appointment_id": patient_id * 100 + v,
                "patient_id": patient_id,
                "appointment_date": appt_date,
                "appointment_type": rng.choice(["Consultation", "Control"]),
                "diagnostic": rng.choice(DIAGNOSES),
                "gender": gender,
                "birth_day": birth_day,
                "case_description": "Patiente se présente pour " + rng.choice(DIAGNOSES).lower(),
                "notes": "" if rng.random() < 0.5 else "Contrôle dans 1 mois si absence d'amélioration.",
                "weight": round(rng.uniform(50, 85), 1),
                "pulse": rng.randint(60, 95),
                "temperature": round(rng.uniform(36.4, 37.8), 1),
                "blood_pressure": f"{rng.randint(100, 130)}/{rng.randint(60, 85)}",
                "tall": round(rng.uniform(1.55, 1.75), 2),
                "spo2": rng.randint(96, 100),
                "K": None,
                "P": None,
                "Sang": rng.choice(["A+", "O+", "B+", "AB+", None]),
                "Glycimide": round(rng.uniform(0.8, 1.2), 2),
                "medicaments": [
                    f"{n} ({d}, {f}, {du})" for n, d, f, du in rng.sample(MEDS, k=rng.randint(0, 2))
                ],
                "analyses": rng.sample(ANALYSES, k=rng.randint(0, 2)),
            }
        )
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--patients", type=int, default=15)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("-o", "--output", default="data/synthetic_cases.jsonl")
    args = parser.parse_args()

    rng = random.Random(args.seed)
    rows = []
    for patient_id in range(1, args.patients + 1):
        rows.extend(make_patient_rows(patient_id, rng.randint(1, 4), rng))
    rows.sort(key=lambda r: (r["patient_id"], r["appointment_date"]))

    cases = build_cases(rows)

    out_path = Path(__file__).resolve().parent.parent / args.output
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w") as f:
        for case in cases:
            f.write(json.dumps({
                "internal_ref": case.internal_ref,
                "anonymized_text": case.to_prompt_text(),
                "draft_summary": "",
                "approved_summary": "",
                "status": "pending",
            }, ensure_ascii=False) + "\n")

    print(f"Wrote {len(cases)} synthetic cases to {out_path}")


if __name__ == "__main__":
    main()
