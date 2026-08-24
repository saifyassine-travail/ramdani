"""Strip patient-identifying fields before anything derived from a real case
ever reaches a model — for both the eventual live summarizer and the
training-set exporter below. Nothing here is a substitute for restricting DB
access; it's the boundary between "our data" and "what a model gets to see".

Removed entirely: name, CIN, phone, email, address, exact birth date.
Kept: gender, age *band* (not exact age), and all clinical content — vitals,
diagnostic, medicaments (name/dosage/frequence/duree), analyses, case
description text, notes.
Dates: never sent as absolute calendar dates (a real date is itself a weak
identifier when combined with other records) — every date is rewritten as
an offset in days from the appointment being summarized (e.g. "J-14").
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date


def age_band(birth_day: date, as_of: date) -> str:
    years = as_of.year - birth_day.year - (
        (as_of.month, as_of.day) < (birth_day.month, birth_day.day)
    )
    if years < 18:
        return "0-17"
    band_start = (years // 10) * 10
    return f"{band_start}-{band_start + 9}"


def day_offset(target: date, anchor: date) -> str:
    delta = (target - anchor).days
    if delta == 0:
        return "J0"
    return f"J{delta:+d}"


@dataclass
class AnonymizedCase:
    """One appointment's worth of de-identified clinical context, ready to
    hand to a model. `internal_ref` is for OUR bookkeeping only (matching a
    draft/approved summary back to the source row) — it is never included in
    anonymized_text and must never be sent to a model."""

    internal_ref: str  # e.g. "appt:123" — not a real identifier, just a join key
    gender: str
    age_band: str
    appointment_type: str
    diagnostic: str
    case_description: str
    notes: str
    vitals: dict
    medicaments: list[str] = field(default_factory=list)
    analyses: list[str] = field(default_factory=list)
    history: list[str] = field(default_factory=list)  # past appointments, relative dates

    def to_prompt_text(self) -> str:
        lines = [
            f"Patient: {self.gender}, {self.age_band} ans",
            f"Type de consultation: {self.appointment_type}",
        ]
        vitals_line = ", ".join(f"{k}: {v}" for k, v in self.vitals.items() if v not in (None, ""))
        if vitals_line:
            lines.append(f"Constantes: {vitals_line}")
        if self.diagnostic:
            lines.append(f"Diagnostic: {self.diagnostic}")
        if self.case_description:
            lines.append(f"Description du cas: {self.case_description}")
        if self.notes:
            lines.append(f"Notes: {self.notes}")
        if self.medicaments:
            lines.append("Médicaments prescrits: " + "; ".join(self.medicaments))
        if self.analyses:
            lines.append("Analyses/examens: " + ", ".join(self.analyses))
        if self.history:
            lines.append("Antécédents (rendez-vous précédents, dates relatives):")
            lines.extend(f"  - {h}" for h in self.history)
        return "\n".join(lines)
