"""Download a small subset of KiTS23 imaging (CT volumes).

The kits23-main repo ships only segmentations; the CTs live on HuggingFace
(~27 GB for all 489 cases). For TASK_KITS_2D we only need ~25 cases, so this
fetches imaging.nii.gz for the first N cases that already have a segmentation.

    python -m data.kits_download 25
"""
import shutil
import sys
import urllib.request
from pathlib import Path

from data.paths import get_path

BASE = "https://huggingface.co/datasets/neheller/KiTS-Challenge-Imaging/resolve/main/images"


def main(n: int = 25):
    ds = get_path("KITS23") / "dataset"
    cases = sorted(p for p in ds.glob("case_*") if (p / "segmentation.nii.gz").exists())[:n]
    print(f"Downloading imaging for {len(cases)} cases into {ds}", flush=True)

    ok = 0
    for i, case in enumerate(cases, 1):
        dest = case / "imaging.nii.gz"
        if dest.exists() and dest.stat().st_size > 0:
            print(f"[{i}/{len(cases)}] {case.name}: already present ({dest.stat().st_size/1e6:.0f} MB)", flush=True)
            ok += 1
            continue
        url = f"{BASE}/{case.name}.nii.gz"
        tmp = case / ".partial.imaging.nii.gz"
        try:
            print(f"[{i}/{len(cases)}] {case.name}: downloading…", flush=True)
            urllib.request.urlretrieve(url, str(tmp))
            shutil.move(str(tmp), str(dest))
            print(f"    -> {dest.stat().st_size/1e6:.1f} MB", flush=True)
            ok += 1
        except Exception as e:
            if tmp.exists():
                tmp.unlink()
            print(f"    FAILED: {type(e).__name__}: {e}", flush=True)

    print(f"Done. {ok}/{len(cases)} cases have imaging.nii.gz.", flush=True)


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 25)
