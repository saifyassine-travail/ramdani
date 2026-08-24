# summary-lab

Fine-tunes a small local model (via Ollama) to write a short clinical
summary of a patient's case history — **without ever showing the model a
patient's name, CIN, phone, email, address, or exact birth date** (see
`services/anonymize.py`). Data never leaves this machine (Postgres and
Ollama are both local); anonymization is defense-in-depth on top of that,
not a substitute for it.

## Why fine-tune instead of just prompting

A well-written prompt on a strong local model gets you 80% of the way
there for free. This pipeline exists for the other 20%: teaching the model
your clinic's actual summary style/format/vocabulary from real (reviewed)
examples, via QLoRA (works on this machine's RTX 2060, 6GB VRAM).

## Status: pipeline is ready, training data is not

This repo has **zero completed appointments** right now (fresh install) —
there is nothing real to train on yet. Everything below works today with
synthetic placeholder data (`make synthetic`) to prove the pipeline runs
end-to-end; switch to `make export` once real consultations exist and are
marked "Terminé".

## Pipeline

```
Postgres (real cases)  ─┐
                         ├─> export_dataset.py ──> data/*.jsonl (anonymized)
generate_synthetic_cases.py ─┘                            │
                                                            v
                                              draft_summaries.py (local Ollama model drafts each)
                                                            │
                                                            v
                                          scripts/review.html (doctor edits/approves/rejects, exports)
                                                            │
                                                            v
                                     train_lora.py (QLoRA, only "approved" rows)
                                                            │
                                                            v
                                        export_to_ollama.sh (merge -> GGUF -> `ollama create`)
                                                            │
                                                            v
                                         ollama run mediassist-summary
```

## Try it now, with fake data

```bash
make setup                 # once: venv + GPU torch + deps (~10 min)
make synthetic              # generates data/synthetic_cases.jsonl
ollama pull qwen2.5:7b       # the draft model (only needed once)
make draft FILE=data/synthetic_cases.jsonl
# open scripts/review.html in a browser, load data/synthetic_cases.jsonl,
# approve a few rows, export -> overwrite data/synthetic_cases.jsonl
make train-smoke            # proves the QLoRA loop runs on this GPU
```

## Real run, once you have real data

```bash
make export                            # data/real_cases.jsonl, from Postgres
make draft                             # drafts with qwen2.5:7b
# review.html -> approve/reject/edit -> overwrite data/real_cases.jsonl
make train                             # needs a few dozen+ approved examples
make export-ollama                     # -> `ollama run mediassist-summary`
```

`make export` is safe to re-run any time — it merges into the existing
file, so already-reviewed rows (draft/approved/rejected) are preserved,
only new completed appointments get added as new "pending" rows.

## What's NOT built yet

- **Serving endpoint**: this only produces a fine-tuned model registered
  in Ollama. Wiring a "summarize this patient" button in the app itself
  (calling Ollama with the same anonymization step at request time) is a
  separate, smaller follow-up — ask if you want it built.
- A full in-app review UI (instead of the standalone `review.html`) —
  only worth building once there's enough real volume to make review a
  daily task rather than an occasional batch job.
