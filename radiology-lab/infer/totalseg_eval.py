"""TASK_TOTALSEG_EVAL — measure the pretrained model's accuracy on labeled cases.

Every TotalSegmentator dataset case ships its own 117 ground-truth masks, so we
can run the pretrained model and score it with Dice (1.0 = perfect overlap). This
is how you know whether the result is trustworthy for clinical use — you measure
it, per organ, rather than eyeballing one picture.

    python -m infer.totalseg_eval --config configs/totalseg_eval.yaml --subset 3
    python -m infer.totalseg_eval --cases s0000 s0001 --reuse
"""
import argparse
import csv
import json
import sys
from pathlib import Path

import nibabel as nib
import numpy as np

from data.paths import get_path
from infer.totalseg_infer import load_masks, pick_slice, run_totalseg
from infer.viz import overlay_gt_pred
from train.common import ensure_dir, load_config, set_seed


def dice(a: np.ndarray, b: np.ndarray) -> float:
    a = a > 0
    b = b > 0
    denom = int(a.sum() + b.sum())
    return 1.0 if denom == 0 else 2.0 * int((a & b).sum()) / denom


def resolve_cases(cfg: dict, args) -> list:
    ds = get_path("TOTALSEG_DATASET")
    names = args.cases or cfg.get("cases") or []
    if names:
        return [ds / n for n in names]
    n = args.subset or cfg.get("subset", 3)
    cases = sorted(p for p in ds.iterdir() if p.is_dir() and (p / "ct.nii.gz").exists())
    return cases[:n]


def load_gt(gt_dir: Path) -> dict:
    """Load every non-empty ground-truth organ mask for a case."""
    gt = {}
    for gf in sorted(gt_dir.glob("*.nii.gz")):
        arr = np.asanyarray(nib.load(str(gf)).dataobj)
        if arr.any():
            gt[gf.name.replace(".nii.gz", "")] = arr
    return gt


def main():
    ap = argparse.ArgumentParser(description="TASK_TOTALSEG_EVAL")
    ap.add_argument("--config", default="configs/totalseg_eval.yaml")
    ap.add_argument("--subset", type=int, default=None, help="evaluate first N cases")
    ap.add_argument("--cases", nargs="*", default=None, help="explicit case names, e.g. s0000 s0001")
    ap.add_argument("--reuse", action="store_true", help="reuse existing predictions if present")
    args = ap.parse_args()

    cfg = load_config(args.config)
    set_seed(cfg.get("seed", 42))
    out = ensure_dir(cfg["output_dir"])
    cases = resolve_cases(cfg, args)
    print(f"[eval] {len(cases)} case(s): {', '.join(c.name for c in cases)}", flush=True)

    per_organ: dict = {}   # organ -> [dice across cases]
    per_case = []

    for case in cases:
        try:
            ct_path = case / "ct.nii.gz"
            pred_dir = ensure_dir(out / case.name / "segmentations")
            already = any(pred_dir.glob("*.nii.gz"))

            if not (args.reuse and already):
                print(f"[eval] {case.name}: running pretrained inference…", flush=True)
                run_totalseg(ct_path, pred_dir, cfg.get("fast", True),
                             cfg.get("roi_subset", []) or [], cfg.get("force_split", False))
            else:
                print(f"[eval] {case.name}: reusing existing prediction.", flush=True)

            pred = load_masks(pred_dir)
            gt = load_gt(case / "segmentations")

            rows = []
            for organ, garr in gt.items():
                parr = pred.get(organ)
                d = dice(parr, garr) if parr is not None else 0.0
                rows.append((organ, int((garr > 0).sum()), d))
                per_organ.setdefault(organ, []).append(d)
            rows.sort(key=lambda r: -r[1])
            mean_d = float(np.mean([d for _, _, d in rows])) if rows else 0.0

            ct = np.asanyarray(nib.load(str(ct_path)).dataobj).astype(np.float32)
            z = pick_slice(gt, "auto")
            png = out / f"{case.name}_gt_vs_pred.png"
            overlay_gt_pred(ct, gt, pred, z, png, mean_dice=mean_d)

            per_case.append({
                "case": case.name,
                "mean_dice": round(mean_d, 3),
                "n_organs": len(rows),
                "overlay": str(png),
                "per_organ_dice": {o: round(d, 3) for o, _, d in rows},
            })
            print(f"[eval] {case.name}: mean Dice = {mean_d:.3f} over {len(rows)} organs -> {png}", flush=True)
        except Exception as e:  # one bad case (e.g. OOM) must not kill the batch
            print(f"[eval] {case.name}: FAILED ({type(e).__name__}: {e})", flush=True)
            per_case.append({"case": case.name, "error": f"{type(e).__name__}: {e}"})

    organ_mean = {o: round(float(np.mean(v)), 3)
                  for o, v in sorted(per_organ.items(), key=lambda kv: -float(np.mean(kv[1])))}
    overall = round(float(np.mean([d for v in per_organ.values() for d in v])), 3) if per_organ else 0.0

    metrics = {
        "task": "TASK_TOTALSEG_EVAL",
        "cases": [c.name for c in cases],
        "fast": bool(cfg.get("fast", True)),
        "overall_mean_dice": overall,
        "per_organ_mean_dice": organ_mean,
        "per_case": per_case,
    }
    with open(out / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    with open(out / "dice_table.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["organ", "mean_dice"])
        for o, d in organ_mean.items():
            w.writerow([o, d])

    print("=" * 60, flush=True)
    print(f"[eval] OVERALL mean Dice = {overall} across {len(cases)} case(s)", flush=True)
    print(f"[eval] Report -> {out/'metrics.json'} , {out/'dice_table.csv'}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
