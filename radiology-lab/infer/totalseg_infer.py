"""TASK_TOTALSEG_INFER — run pretrained TotalSegmentator on one CT volume.

No training. Outputs per-organ NIfTI masks + a PNG overlay of one axial slice.

    python -m infer.totalseg_infer --config configs/totalseg_infer.yaml
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

import nibabel as nib
import numpy as np

from data.paths import get_path
from infer.viz import overlay_axial
from train.common import ensure_dir, load_config, set_seed


def find_ct(cfg: dict) -> Path:
    """Resolve which CT .nii.gz to segment (explicit volume > case > first found)."""
    if cfg.get("input_volume"):
        p = Path(cfg["input_volume"]).expanduser()
        if not p.exists():
            raise FileNotFoundError(f"input_volume does not exist: {p}")
        return p

    ds = get_path("TOTALSEG_DATASET")

    if cfg.get("input_case"):
        case = ds / cfg["input_case"]
        ct = case / "ct.nii.gz"
        if ct.exists():
            return ct
        cands = sorted(case.glob("*.nii*"))
        if cands:
            return cands[0]
        raise FileNotFoundError(f"No CT NIfTI found in case folder: {case}")

    # Otherwise: first case in the dataset that has a ct.nii.gz
    for case in sorted(p for p in ds.iterdir() if p.is_dir()):
        ct = case / "ct.nii.gz"
        if ct.exists():
            return ct
    cands = sorted(ds.rglob("ct.nii.gz"))
    if cands:
        return cands[0]
    raise FileNotFoundError(
        f"Could not find any 'ct.nii.gz' under {ds}. "
        f"Set input_volume in the config to point at a CT explicitly."
    )


def run_totalseg(ct_path: Path, out_dir: Path, fast: bool, roi_subset: list,
                 force_split: bool = True) -> None:
    """Wrap the TotalSegmentator CLI; fall back to its python API if not on PATH.

    force_split chunks the volume to keep peak RAM low (important on small WSL).
    """
    cmd = ["TotalSegmentator", "-i", str(ct_path), "-o", str(out_dir)]
    if fast:
        cmd.append("--fast")
    if force_split:
        cmd.append("--force_split")
    if roi_subset:
        cmd += ["--roi_subset", *map(str, roi_subset)]

    try:
        print("[totalseg] CLI:", " ".join(cmd), flush=True)
        subprocess.run(cmd, check=True)
        return
    except FileNotFoundError:
        print("[totalseg] 'TotalSegmentator' not on PATH — using python API.", flush=True)
    except subprocess.CalledProcessError as e:
        print(f"[totalseg] CLI failed ({e}); trying python API.", flush=True)

    from totalsegmentator.python_api import totalsegmentator
    totalsegmentator(
        str(ct_path), str(out_dir),
        fast=fast,
        force_split=force_split,
        roi_subset=list(roi_subset) if roi_subset else None,
        nr_thr_resamp=1,   # single-threaded resampling/saving -> lower peak RAM
        nr_thr_saving=1,
    )


def load_masks(seg_dir: Path) -> dict:
    """Load every non-empty per-organ mask produced by TotalSegmentator."""
    masks = {}
    for f in sorted(Path(seg_dir).glob("*.nii.gz")):
        arr = np.asanyarray(nib.load(str(f)).dataobj)
        if arr.any():
            masks[f.name.replace(".nii.gz", "")] = arr
    return masks


def pick_slice(masks: dict, mode) -> int:
    """'auto' -> axial slice with the most segmented voxels; else the given int."""
    if mode != "auto":
        return int(mode)
    if not masks:
        return 0
    combined = None
    for arr in masks.values():
        b = arr > 0
        combined = b if combined is None else (combined | b)
    counts = combined.sum(axis=(0, 1))  # voxels per axial slice
    return int(np.argmax(counts))


def main():
    ap = argparse.ArgumentParser(description="TASK_TOTALSEG_INFER")
    ap.add_argument("--config", default="configs/totalseg_infer.yaml")
    args = ap.parse_args()

    cfg = load_config(args.config)
    set_seed(cfg.get("seed", 42))

    out_dir = ensure_dir(cfg["output_dir"])
    seg_dir = ensure_dir(out_dir / "segmentations")

    ct_path = find_ct(cfg)
    print(f"[totalseg] Input CT : {ct_path}", flush=True)
    print(f"[totalseg] Output   : {seg_dir}", flush=True)

    run_totalseg(
        ct_path, seg_dir,
        fast=cfg.get("fast", True),
        roi_subset=cfg.get("roi_subset", []) or [],
        force_split=cfg.get("force_split", True),
    )

    masks = load_masks(seg_dir)
    print(f"[totalseg] {len(masks)} non-empty organ masks.", flush=True)

    ct = np.asanyarray(nib.load(str(ct_path)).dataobj).astype(np.float32)
    z = pick_slice(masks, cfg.get("overlay_slice", "auto"))
    png = out_dir / "overlay_axial.png"
    overlay_axial(ct, masks, z, png)
    print(f"[totalseg] Overlay PNG: {png} (slice {z})", flush=True)

    summary = {
        "task": "TASK_TOTALSEG_INFER",
        "input_ct": str(ct_path),
        "segmentations_dir": str(seg_dir),
        "num_organs": len(masks),
        "organs": list(masks.keys()),
        "overlay_png": str(png),
        "overlay_slice": z,
        "fast": bool(cfg.get("fast", True)),
    }
    with open(out_dir / "metrics.json", "w") as f:
        json.dump(summary, f, indent=2)
    print(f"[totalseg] Done. Summary -> {out_dir/'metrics.json'}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
