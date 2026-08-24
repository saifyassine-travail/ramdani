#!/usr/bin/env python
"""Export every completed appointment's case as an anonymized training-set
row (see services/anonymize.py for what's stripped). Output format is
identical to generate_synthetic_cases.py's, so draft_summaries.py and the
review/train scripts work on either.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.build_cases import build_cases  # noqa: E402
from services.source_db import fetch_all_completed_appointments  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("-o", "--output", default="data/real_cases.jsonl")
    args = parser.parse_args()

    rows = fetch_all_completed_appointments()
    if not rows:
        print(
            "No completed appointments found — nothing to export yet. "
            "This is expected on a fresh install; re-run once real "
            "consultations have been recorded and marked 'Terminé'.",
            file=sys.stderr,
        )

    cases = build_cases(rows)

    out_path = Path(__file__).resolve().parent.parent / args.output
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # Merge with any existing file so already-reviewed rows (draft/approved
    # summaries a doctor already edited) aren't wiped out by a re-export.
    existing = {}
    if out_path.exists():
        with out_path.open() as f:
            for line in f:
                rec = json.loads(line)
                existing[rec["internal_ref"]] = rec

    with out_path.open("w") as f:
        for case in cases:
            prior = existing.get(case.internal_ref, {})
            f.write(json.dumps({
                "internal_ref": case.internal_ref,
                "anonymized_text": case.to_prompt_text(),
                "draft_summary": prior.get("draft_summary", ""),
                "approved_summary": prior.get("approved_summary", ""),
                "status": prior.get("status", "pending"),
            }, ensure_ascii=False) + "\n")

    print(f"Wrote {len(cases)} cases to {out_path} ({len(existing)} carried over prior review state)")


if __name__ == "__main__":
    main()
