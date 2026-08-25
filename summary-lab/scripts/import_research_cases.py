#!/usr/bin/env python
"""Bootstrap real(-ish) training data from `research_cases` — ~253k
de-identified clinical case records from public literature (PMC-Patients,
E3C Corpus), imported separately into Postgres. There are zero approved
real appointments right now (fresh install), so `train_lora.py` has nothing
to train on; this script produces ~200 usable "approved" rows from public
literature in the meantime.

For each sampled row:
  1. build an anonymized_text block shaped like
     services/anonymize.py's AnonymizedCase.to_prompt_text()
  2. translate the case narrative to French if it isn't already (local
     Ollama) — production input is French-only, so training input must be
  3. draft a short French clinical summary from it, using the EXACT same
     model + SYSTEM_PROMPT as scripts/draft_summaries.py
  4. write the row as status="approved" with approved_summary = the draft
     — no doctor review step, since this is public-literature augmentation
     and no clinical decision depends on it (unlike real patient data).

Merges into data/real_cases.jsonl by internal_ref (same pattern as
export_dataset.py) so the 706 existing real "pending" rows are left
untouched. Re-running overwrites only the "research:*" rows.
"""
import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from services.research_db import DEFAULT_GROUPS, fetch_research_sample  # noqa: E402

# Same directory as this script — makes draft_summaries.py's constants
# importable without turning scripts/ into a package.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import draft_summaries as ds  # noqa: E402  (OLLAMA_HOST, MODEL, SYSTEM_PROMPT)

MAX_SOURCE_CHARS = 8000  # a handful of PMC narratives run to tens of KB (outliers); cap for sane call times
NUM_CTX = 8192

GENDER_MAP = {"M": "Homme", "F": "Femme"}

TRANSLATE_SYSTEM_PROMPT = (
    "Tu es un traducteur médical. Traduis intégralement le texte clinique "
    "suivant en français. Conserve tout le contenu clinique (termes, "
    "valeurs, chronologie, noms d'examens). Ne résume pas, ne raccourcis "
    "pas, n'ajoute aucun commentaire ni aucune note : réponds uniquement "
    "avec le texte traduit."
)


def call_ollama(system_prompt: str, user_text: str, timeout: int) -> str:
    payload = {
        "model": ds.MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_text},
        ],
        "stream": False,
        "options": {"num_ctx": NUM_CTX},
    }
    req = urllib.request.Request(
        f"{ds.OLLAMA_HOST}/api/chat",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = json.loads(resp.read())
    return body["message"]["content"].strip()


def _patient_line(gender: str | None, age_raw: str | None) -> str | None:
    gender_fr = GENDER_MAP.get((gender or "").strip().upper())
    age_num = None
    if age_raw:
        m = re.match(r"\s*(\d+)", str(age_raw))
        if m:
            age_num = m.group(1)
    if gender_fr and age_num:
        return f"Patient: {gender_fr}, {age_num} ans"
    if gender_fr:
        return f"Patient: {gender_fr}"
    if age_num:
        return f"Patient: {age_num} ans"
    return None


def _entities_line(row: dict) -> str | None:
    # Entity text is in the row's original language — only usable without
    # translation for E3C/fr rows (already French, no translation step).
    if row.get("source") != "e3c" or (row.get("language") or "").lower() != "fr":
        return None
    entities = row.get("entities") or []
    seen = set()
    texts = []
    for ent in entities:
        text = (ent.get("text") or "").strip()
        key = text.lower()
        if text and key not in seen:
            seen.add(key)
            texts.append(text)
    if not texts:
        return None
    return "Éléments cliniques identifiés: " + ", ".join(texts)


def build_anonymized_text(row: dict, french_case_text: str) -> str:
    lines = []
    patient_line = _patient_line(row.get("gender"), row.get("age"))
    if patient_line:
        lines.append(patient_line)
    lines.append("Type de consultation: Dossier clinique (littérature médicale)")
    entities_line = _entities_line(row)
    if entities_line:
        lines.append(entities_line)
    lines.append(f"Description du cas: {french_case_text}")
    return "\n".join(lines)


def scale_groups(groups, limit):
    if not limit:
        return groups
    total = sum(n for _, _, n in groups)
    scaled = []
    for source, lang, n in groups:
        scaled_n = max(1, round(n * limit / total))
        scaled.append((source, lang, scaled_n))
    return scaled


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("-o", "--output", default="data/real_cases.jsonl")
    parser.add_argument(
        "--limit", type=int, default=None,
        help="Scale the ~200-row default sample down proportionally, e.g. "
             "--limit 10 for a quick smoke test before running the full batch.",
    )
    parser.add_argument("--translate-timeout", type=int, default=180)
    parser.add_argument("--draft-timeout", type=int, default=180)
    args = parser.parse_args()

    groups = scale_groups(DEFAULT_GROUPS, args.limit)
    print(f"Sampling groups (source, language, n): {groups}", file=sys.stderr)

    rows = fetch_research_sample(groups)
    print(f"Fetched {len(rows)} rows from research_cases.", file=sys.stderr)

    new_records: dict[str, dict] = {}
    failures: list[tuple[str, str, str]] = []
    skipped: list[str] = []
    t0 = time.time()

    for i, row in enumerate(rows, 1):
        ref = f"research:{row['source']}:{row['source_id']}"
        text = (row.get("summary_text") or "").strip()
        if not text:
            skipped.append(ref)
            continue
        if len(text) > MAX_SOURCE_CHARS:
            text = text[:MAX_SOURCE_CHARS]

        lang = (row.get("language") or "").strip().lower()
        try:
            if lang and lang != "fr":
                french_text = call_ollama(TRANSLATE_SYSTEM_PROMPT, text, args.translate_timeout)
            else:
                french_text = text
        except (urllib.error.URLError, TimeoutError, KeyError, OSError, ValueError) as exc:
            print(f"[{ref}] translation failed: {exc}", file=sys.stderr)
            failures.append((ref, "translate", str(exc)))
            continue

        anonymized_text = build_anonymized_text(row, french_text)

        try:
            draft = call_ollama(ds.SYSTEM_PROMPT, anonymized_text, args.draft_timeout)
        except (urllib.error.URLError, TimeoutError, KeyError, OSError, ValueError) as exc:
            print(f"[{ref}] draft failed: {exc}", file=sys.stderr)
            failures.append((ref, "draft", str(exc)))
            continue

        new_records[ref] = {
            "internal_ref": ref,
            "anonymized_text": anonymized_text,
            "draft_summary": draft,
            "approved_summary": draft,
            "status": "approved",
        }
        print(f"[{i}/{len(rows)}] {ref} ok ({time.time() - t0:.0f}s elapsed)", file=sys.stderr)

    out_path = ROOT / args.output
    out_path.parent.mkdir(parents=True, exist_ok=True)

    existing: dict[str, dict] = {}
    if out_path.exists():
        with out_path.open() as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                rec = json.loads(line)
                existing[rec["internal_ref"]] = rec

    added = sum(1 for k in new_records if k not in existing)
    updated = sum(1 for k in new_records if k in existing)
    existing.update(new_records)

    with out_path.open("w") as f:
        for rec in existing.values():
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    elapsed = time.time() - t0
    print("")
    print(f"Done in {elapsed:.0f}s.")
    print(f"Rows fetched: {len(rows)}")
    print(f"Rows added: {added}, updated: {updated}, skipped (empty text): {len(skipped)}, failed: {len(failures)}")
    if skipped:
        print(f"Skipped refs: {skipped}")
    if failures:
        print("Failures:")
        for ref, stage, err in failures:
            print(f"  [{stage}] {ref}: {err}")
    print(f"Total rows now in {out_path}: {len(existing)}")


if __name__ == "__main__":
    main()
