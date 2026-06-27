"""LIDC-IDRI nodule patch dataset for TASK_LIDC_NODULE_CLS.  [PHASE 2]

Planned implementation (uses pylidc):
  - pylidc reads a ~/.pylidcrc (or pylidc.conf) telling it where the LIDC-IDRI
    DICOMs live. We will auto-write it from paths.LIDC_IDRI on first run.
  - For each scan: cluster radiologist annotations into nodules, take the median
    centroid, extract a patch_size x patch_size axial patch (CT-windowed) -> label 1.
  - Sample neg_per_pos random non-nodule patches from the same scans -> label 0.
  - Stratified train/val split; return (1xHxW float tensor, label).
"""
import configparser
from pathlib import Path

from data.paths import get_path


def ensure_pylidc_config() -> Path:
    """Write ~/.pylidcrc pointing at the LIDC-IDRI DICOM root (pylidc needs this)."""
    root = get_path("LIDC_IDRI")
    rc = Path.home() / ".pylidcrc"
    cfg = configparser.ConfigParser()
    cfg["dicom"] = {"path": str(root), "warn": "True"}
    with open(rc, "w") as f:
        cfg.write(f)
    return rc


def build_patches(patients=60, patch_size=64, neg_per_pos=1, min_agreement=1, seed=42):
    """Return (X, y) patch arrays. [PHASE 2 — to be implemented]"""
    raise NotImplementedError(
        "LIDC patch mining is scaffolded; implemented in the next phase "
        "(run TASK_TOTALSEG_INFER first to verify the environment)."
    )
