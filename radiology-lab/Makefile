# radiology-lab — CPU-only task runner (WSL2 Ubuntu).
# Usage: `make setup`, then `make totalseg-infer`, `make train-kits`, etc.

# Keep the venv on the NATIVE Linux filesystem, not /mnt/c — pip writes thousands
# of small files and the Windows mount makes that 10-50x slower. Override with
# `make setup VENV=/some/path` if you like.
PY ?= python3
VENV ?= $(HOME)/.venvs/radiology-lab
PIP := $(VENV)/bin/pip
PYTHON := $(VENV)/bin/python

# Override case count from the CLI, e.g. `make train-kits SUBSET=4`
SUBSET ?=
SUBSET_FLAG := $(if $(SUBSET),--subset $(SUBSET),)

.PHONY: help setup totalseg-infer totalseg-eval train-kits train-lidc train-rsna clean

help:
	@echo "Targets:"
	@echo "  setup           Create .venv and install CPU torch + requirements"
	@echo "  totalseg-infer  TASK 1: pretrained TotalSegmentator on one CT volume"
	@echo "  train-kits      TASK 2: 2D U-Net on KiTS23 kidney slices"
	@echo "  train-lidc      TASK 3: nodule vs non-nodule CNN (LIDC-IDRI)"
	@echo "  train-rsna      TASK 4: ResNet18 pneumonia classifier (RSNA)"
	@echo "  clean           Remove outputs/ and caches"
	@echo "Add SUBSET=N to limit cases, e.g. 'make train-kits SUBSET=4'."

setup:
	$(PY) -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install torch==2.3.1 torchvision==0.18.1 --index-url https://download.pytorch.org/whl/cpu
	$(PIP) install -r requirements.txt
	@echo "Done. Now edit configs/paths.yaml with your dataset paths."

totalseg-infer:
	$(PYTHON) -m infer.totalseg_infer --config configs/totalseg_infer.yaml

totalseg-eval:
	$(PYTHON) -m infer.totalseg_eval --config configs/totalseg_eval.yaml $(SUBSET_FLAG)

train-kits:
	$(PYTHON) -m train.train_kits --config configs/kits_2d.yaml $(SUBSET_FLAG)

train-kits-tumor:
	$(PYTHON) -m train.train_kits --config configs/kits_tumor.yaml $(SUBSET_FLAG)

train-lidc:
	$(PYTHON) -m train.train_lidc --config configs/lidc_nodule_cls.yaml $(SUBSET_FLAG)

train-rsna:
	$(PYTHON) -m train.train_rsna --config configs/rsna_pneumonia.yaml $(SUBSET_FLAG)

train-nih:
	$(PYTHON) -m train.train_nih --config configs/nih_cxr14.yaml $(SUBSET_FLAG)

clean:
	rm -rf outputs/ runs/
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
	find . -type d -name .ipynb_checkpoints -prune -exec rm -rf {} +
	@echo "Cleaned."
