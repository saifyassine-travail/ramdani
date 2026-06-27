# radiology-lab

A single, **CPU-only** project to train and run four radiology tasks on a laptop
(Windows + WSL2 Ubuntu, no GPU). Optimized aggressively for CPU: small models,
small input sizes, small subsets, and pretrained weights wherever possible.

This is the **training/experimentation** counterpart to the existing
[`../radiology-ai`](../radiology-ai) service (a FastAPI chest-X-ray inference API
using TorchXRayVision + Grad-CAM + MedSAM2). See **Integration** below.

---

## Tasks

| ID | What | Data | Training? |
|----|------|------|-----------|
| **TASK_TOTALSEG_INFER** | Pretrained TotalSegmentator on a CT volume → per-organ NIfTI + axial overlay PNG | Totalsegmentator_dataset_v201 | ❌ inference only |
| **TASK_KITS_2D** | Small 2D U-Net (MONAI, ~1M params) on kidney slices | KiTS23 | ✅ ≤5 epochs |
| **TASK_LIDC_NODULE_CLS** | 3-conv-block CNN, nodule vs non-nodule 64×64 patches | LIDC-IDRI (pylidc) | ✅ ≤10 epochs |
| **TASK_RSNA_PNEUMONIA** | ResNet18 (ImageNet) chest X-ray pneumonia | RSNA challenge | ✅ ≤5 epochs |

**Implementation status:** `TASK_TOTALSEG_INFER` is fully implemented (it works
immediately, no training — use it to verify your setup). The three training tasks
are **scaffolded** (configs, models, dataset/loader interfaces, CLI with
`--subset`, Makefile targets) and get their full training loops in the next phase.

---

## Layout

```
radiology-lab/
  configs/     one YAML per task + paths.yaml (your dataset locations)
  data/        dataset loaders + path resolver
  models/      small CPU-friendly models (UNet2d, SmallCNN, ResNet18 head)
  train/       one train script per task + common.py (seed/io/device)
  infer/       TotalSegmentator inference + visualization
  notebooks/   one quickstart per task, each with an "Open in Colab" badge
  requirements.txt  Makefile  README.md
```

---

## Setup (WSL2 Ubuntu)

```bash
cd radiology-lab
make setup          # creates .venv, installs CPU torch + all requirements
```

`make setup` installs the **CPU build** of PyTorch from the official CPU wheel
index, so nothing tries to pull CUDA.

Then point the project at your data — edit **`configs/paths.yaml`**:

```yaml
TOTALSEG_DATASET: /mnt/d/datasets/Totalsegmentator_dataset_v201
KITS23:           /mnt/d/datasets/kits23-main
RSNA_PNEUMONIA:   /mnt/d/datasets/rsna-pneumonia-detection-challenge
LIDC_IDRI:        /mnt/d/datasets/LIDC-IDRI
```

(Windows `D:\datasets\…` → WSL `/mnt/d/datasets/…`. Any value can also be
overridden by an env var of the same name.)

> Tip: the project lives on the Windows filesystem (`/mnt/c/...`). For heavy
> training you can `cp -r radiology-lab ~/` into the WSL filesystem for faster
> small-file I/O — the big dataset reads happen from `/mnt/...` either way.

---

## Run

```bash
make totalseg-infer            # TASK 1 — verify your setup first (no training)
make train-kits  SUBSET=4      # TASK 2
make train-lidc  SUBSET=20     # TASK 3
make train-rsna  SUBSET=500    # TASK 4
make clean                     # remove outputs/ and caches
```

Every training script accepts `--subset N` to cap the number of cases. All runs
use a deterministic seed, a tqdm progress bar, and write to `outputs/<task>/`:
`metrics.json`, a checkpoint (`best.pth`), and a sample-output PNG.

---

## Realistic CPU expectations

Rough numbers on a 4-core laptop CPU (no GPU). CPUs vary widely — treat as
order-of-magnitude.

| Task | Setting | Time |
|------|---------|------|
| TASK_TOTALSEG_INFER | `fast: true` (3 mm), 1 volume | ~3–8 min/volume |
| TASK_TOTALSEG_INFER | full resolution, 1 volume | 20–40+ min (use `fast`) |
| TASK_KITS_2D | 20 train / 5 val, 128², 5 epochs | **~30 min** |
| TASK_LIDC_NODULE_CLS | ~60 patients, 64² patches, 10 epochs | ~20–40 min (patch mining dominates) |
| TASK_RSNA_PNEUMONIA | 2000 imgs, 224², frozen backbone, 5 epochs | ~20–30 min |

Use `--subset` and the `fast`/small-image config options to get a first run in a
few minutes before committing to the full settings.

---

## Why we do NOT train 3D nnU-Net (or any 3D model) from scratch

- **3D conv on CPU is ~10–100× too slow.** A single nnU-Net 3D training fold
  expects a modern GPU and runs for *many hours to days* even there; on CPU it is
  effectively infeasible.
- **Memory.** Full-resolution 3D CT volumes + 3D feature maps blow past laptop RAM.
- **It's unnecessary here.** For segmentation we either (a) **reuse** the already
  pretrained TotalSegmentator (TASK 1), or (b) train a **2D** U-Net on axial
  slices (TASK 2) — both are CPU-tractable and give you a working pipeline.

So: pretrained 3D inference is fine; *training* stays 2D / small CNNs.

---

## Move a task to Google Colab (one click)

Each notebook in `notebooks/` starts with an **“Open in Colab”** badge. After you
push this repo to GitHub, edit the badge URL in each notebook to your
`github-user/repo`, then one click opens it on Colab's free GPU — far faster than
laptop CPU, and you can raise the subset sizes / image sizes there.

In Colab, mount Google Drive (the notebooks include the cell) and point
`configs/paths.yaml` at your Drive copy of the datasets.

---

## Integration with `radiology-ai`

`radiology-ai` is the **production inference** service for the clinic app
(chest-X-ray pathology + heatmaps). `radiology-lab` is where you **train/evaluate**
new models. Concrete benefits:

- **TASK_RSNA_PNEUMONIA** and **TASK_LIDC_NODULE_CLS** produce a `best.pth` whose
  pneumonia / nodule heads overlap the TorchXRayVision pathology space already
  served by `radiology-ai` — you can A/B them or fine-tune, then drop the
  checkpoint behind the same FastAPI endpoint.
- **TASK_TOTALSEG_INFER** adds organ-level CT segmentation, a capability
  `radiology-ai` doesn't have yet; it could become a new inference route.

The two stay separate repos/services; `radiology-lab` is the upstream lab.
