#!/usr/bin/env python
"""Fill in `draft_summary` for every "pending" row in a cases JSONL file, by
asking a local Ollama text model to summarize the anonymized clinical
context. These drafts are NOT training labels yet — a doctor must review
and either edit-and-approve or reject each one (see README) before
train_lora.py will use it.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434")
MODEL = os.environ.get("DRAFT_MODEL", "qwen2.5:7b")

SYSTEM_PROMPT = (
    "Tu es un assistant médical qui résume un dossier de consultation pour "
    "un médecin généraliste/gynécologue, en français, de façon concise "
    "(4-6 lignes maximum). Ne mentionne jamais de nom, numéro, ou tout "
    "identifiant personnel (il n'y en a de toute façon aucun dans le texte "
    "fourni) : reste uniquement sur le contenu clinique. Structure: motif, "
    "éléments cliniques marquants, conduite tenue (traitement/examens), "
    "suivi recommandé si mentionné."
)


def call_ollama(anonymized_text: str) -> str:
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": anonymized_text},
        ],
        "stream": False,
    }
    req = urllib.request.Request(
        f"{OLLAMA_HOST}/api/chat",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        body = json.loads(resp.read())
    return body["message"]["content"].strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cases_file")
    parser.add_argument(
        "--force", action="store_true",
        help="Re-draft rows that already have a draft_summary (still skips approved/rejected rows).",
    )
    args = parser.parse_args()

    path = Path(args.cases_file)
    rows = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]

    drafted = 0
    for row in rows:
        if row["status"] in ("approved", "rejected"):
            continue
        if row["draft_summary"] and not args.force:
            continue
        try:
            row["draft_summary"] = call_ollama(row["anonymized_text"])
            row["status"] = "drafted"
            drafted += 1
        except (urllib.error.URLError, TimeoutError, KeyError) as exc:
            print(f"[{row['internal_ref']}] draft failed: {exc}", file=sys.stderr)

    path.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n")
    print(f"Drafted {drafted}/{len(rows)} rows in {path}. "
          f"Now review: edit `approved_summary` and set status to \"approved\" "
          f"(or \"rejected\") for each row you're keeping/discarding.")


if __name__ == "__main__":
    main()
