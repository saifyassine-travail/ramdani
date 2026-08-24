# summary-lab — patient-case summarization: anonymize -> export -> auto-draft
# -> doctor review -> QLoRA fine-tune -> import into Ollama.
PY ?= python3
VENV ?= $(HOME)/.venvs/summary-lab
PIP := $(VENV)/bin/pip
PYTHON := $(VENV)/bin/python

.PHONY: help setup synthetic export draft train-smoke train export-ollama clean

help:
	@echo "Targets:"
	@echo "  setup           Create .venv, install GPU torch (cu128) + requirements"
	@echo "  synthetic       Generate fake placeholder cases (no DB needed) -> data/synthetic_cases.jsonl"
	@echo "  export          Export real completed appointments from Postgres -> data/real_cases.jsonl"
	@echo "  draft FILE=...  Auto-draft summaries for a cases file (default: data/real_cases.jsonl)"
	@echo "  review          Reminder to open scripts/review.html in a browser"
	@echo "  train-smoke     2-step smoke test of the training loop (any data, nothing usable saved)"
	@echo "  train           Real QLoRA fine-tune on doctor-approved rows (needs enough approved examples)"
	@echo "  export-ollama   Merge adapter -> GGUF -> register as an Ollama model"
	@echo "  clean           Remove outputs/ and caches"

setup:
	$(PY) -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install torch --index-url https://download.pytorch.org/whl/cu128
	$(PIP) install -r requirements.txt
	@echo "Done."

synthetic:
	$(PYTHON) scripts/generate_synthetic_cases.py

export:
	$(PYTHON) scripts/export_dataset.py

FILE ?= data/real_cases.jsonl
draft:
	$(PYTHON) scripts/draft_summaries.py $(FILE)

review:
	@echo "Open scripts/review.html directly in a browser (double-click it, or file://$(CURDIR)/scripts/review.html)"

train-smoke:
	$(PYTHON) scripts/train_lora.py --config configs/summary_lora.yaml --smoke-test

train:
	$(PYTHON) scripts/train_lora.py --config configs/summary_lora.yaml

export-ollama:
	bash scripts/export_to_ollama.sh

clean:
	rm -rf outputs/
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
