"""CT organ segmentation via TotalSegmentator — Phase 3 "CT route".

Mirrors the validated radiology-lab pipeline (Dice 0.84–0.99 on major organs).
Takes an uploaded NIfTI CT, returns a base64 axial overlay + the organ list.

NOTE: TotalSegmentator inference is heavy. On CPU expect ~1–2 min/scan with the
fast model; for clinical speed run radiology-ai on a GPU host. Requires
`pip install totalsegmentator nibabel matplotlib` in the radiology-ai env.
"""
import base64
import io
import os
import tempfile
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.patches as mpatches  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

# Use ALL CPU cores for inference (PyTorch on CPU often defaults to half).
_NCPU = os.cpu_count() or 4
os.environ.setdefault("OMP_NUM_THREADS", str(_NCPU))
os.environ.setdefault("MKL_NUM_THREADS", str(_NCPU))
try:
    import torch
    torch.set_num_threads(_NCPU)
except Exception:
    pass

# A useful default set (thorax/abdomen) so the run stays light on CPU.
DEFAULT_ROI = [
    "liver", "spleen", "kidney_left", "kidney_right", "stomach", "pancreas",
    "gallbladder", "aorta", "urinary_bladder", "heart",
    "lung_upper_lobe_left", "lung_lower_lobe_left",
    "lung_upper_lobe_right", "lung_middle_lobe_right", "lung_lower_lobe_right",
]


def _window(s, wl=40.0, ww=400.0):
    lo, hi = wl - ww / 2, wl + ww / 2
    return (np.clip(s, lo, hi) - lo) / (hi - lo + 1e-8)


def _overlay_b64(ct, masks, z, alpha=0.45, max_organs=20):
    bg = np.rot90(_window(ct[:, :, z].astype(np.float32)))
    rgb = np.stack([bg, bg, bg], axis=-1)
    cmap = plt.get_cmap("tab20")
    legend = []
    for i, (name, m) in enumerate(list(masks.items())[:max_organs]):
        ms = np.rot90(m[:, :, z].astype(bool))
        if ms.any():
            c = np.array(cmap(i % 20)[:3])
            rgb[ms] = (1 - alpha) * rgb[ms] + alpha * c
            legend.append(mpatches.Patch(color=c, label=name))
    fig, ax = plt.subplots(figsize=(7, 7))
    ax.imshow(np.clip(rgb, 0, 1))
    ax.axis("off")
    if legend:
        ax.legend(handles=legend, loc="upper right", fontsize=6, framealpha=0.6)
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=110, bbox_inches="tight")
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode()


def preview_montage(nifti_bytes: bytes, n: int = 9) -> dict:
    """Fast grayscale montage of evenly-spaced axial slices (no segmentation).

    Lets the user *see* the CT volume immediately on upload. Needs only nibabel.
    """
    import math
    import tempfile

    import nibabel as nib

    with tempfile.NamedTemporaryFile(suffix=".nii.gz", delete=False) as tf:
        tf.write(nifti_bytes)
        path = tf.name
    try:
        ct = np.asanyarray(nib.load(path).dataobj).astype(np.float32)
    finally:
        os.unlink(path)

    depth = ct.shape[2]
    idxs = np.linspace(int(depth * 0.15), int(depth * 0.85), n).astype(int)
    cols = int(math.ceil(math.sqrt(n)))
    rows = int(math.ceil(n / cols))

    fig, axs = plt.subplots(rows, cols, figsize=(cols * 2.2, rows * 2.2))
    axs = np.atleast_1d(axs).flatten()
    for ax in axs:
        ax.axis("off")
    for ax, z in zip(axs, idxs):
        ax.imshow(np.rot90(_window(ct[:, :, z])), cmap="gray")
        ax.set_title(f"coupe {z}", fontsize=7, color="#888")
    fig.suptitle(f"CT {ct.shape[0]}×{ct.shape[1]}×{depth}", fontsize=9)
    fig.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=100, bbox_inches="tight")
    plt.close(fig)
    return {
        "preview_image": base64.b64encode(buf.getvalue()).decode(),
        "shape": list(ct.shape),
        "num_slices": int(depth),
    }


class CTAnalyzer:
    """Lazy: checks availability at init; loads the heavy model on first call."""

    def __init__(self):
        try:
            import totalsegmentator  # noqa: F401
            import nibabel  # noqa: F401
            self.available = True
        except Exception:
            self.available = False

    def analyze(self, nifti_bytes: bytes, fast: bool = True, roi_subset=None) -> dict:
        if not self.available:
            raise RuntimeError("TotalSegmentator/nibabel not installed in the radiology-ai env.")
        import nibabel as nib
        from totalsegmentator.python_api import totalsegmentator

        with tempfile.TemporaryDirectory() as tmp:
            ct_path = os.path.join(tmp, "ct.nii.gz")
            with open(ct_path, "wb") as f:
                f.write(nifti_bytes)
            seg_dir = os.path.join(tmp, "seg")
            totalsegmentator(ct_path, seg_dir, fast=fast,
                             roi_subset=roi_subset or DEFAULT_ROI,
                             nr_thr_resamp=_NCPU, nr_thr_saving=2)

            masks = {}
            for fp in sorted(Path(seg_dir).glob("*.nii.gz")):
                arr = np.asanyarray(nib.load(str(fp)).dataobj)
                if arr.any():
                    masks[fp.name.replace(".nii.gz", "")] = arr

            ct = np.asanyarray(nib.load(ct_path).dataobj).astype(np.float32)
            if masks:
                comb = None
                for arr in masks.values():
                    b = arr > 0
                    comb = b if comb is None else (comb | b)
                z = int(np.argmax(comb.sum(axis=(0, 1))))
            else:
                z = ct.shape[2] // 2

            return {
                "modality": "CT",
                "num_organs": len(masks),
                "organs": list(masks.keys()),
                "overlay_image": _overlay_b64(ct, masks, z),
                "slice": z,
                "disclaimer": (
                    "Segmentation IA à titre indicatif uniquement. "
                    "Ne remplace pas l'interprétation d'un radiologue qualifié."
                ),
            }
