"""KiTS23 axial-slice dataset for TASK_KITS_2D.

Each case is <KITS23>/dataset/case_XXXXX/{imaging.nii.gz, segmentation.nii.gz}.
KiTS volumes are stored as (z, 512, 512), so an axial slice is data[z]. Labels:
0=background, 1=kidney, 2=tumor, 3=cyst. We segment the whole kidney region
(union of 1/2/3 by default) as a binary mask, keep only slices that contain it,
window the CT to soft-tissue, and resize to image_size.
"""
import nibabel as nib
import numpy as np
from scipy.ndimage import zoom
from torch.utils.data import Dataset

from data.paths import get_path
from infer.viz import window_ct


def list_kits_cases(limit: int | None = None):
    """Cases that have BOTH imaging and segmentation (downloaded), sorted."""
    ds = get_path("KITS23") / "dataset"
    cases = sorted(
        p for p in ds.glob("case_*")
        if (p / "imaging.nii.gz").exists() and (p / "segmentation.nii.gz").exists()
    )
    return cases[:limit] if limit else cases


def _resize(a: np.ndarray, size: int, order: int) -> np.ndarray:
    return zoom(a, (size / a.shape[0], size / a.shape[1]), order=order)


def extract_slices(cases, image_size=128, foreground_labels=(1, 2, 3),
                   only_with_kidney=True, slice_stride=1, label_mode="binary"):
    """Load each case once and return (images, masks) as small 2D arrays.

    label_mode:
      "binary"  -> mask in {0,1} (whole kidney region)
      "classes" -> mask in {0=bg, 1=kidney, 2=tumor} (KiTS labels, cyst->bg)
    slice_stride keeps every Nth qualifying slice (1=all) to cap CPU training time.
    """
    images, masks = [], []
    fg = np.asarray(list(foreground_labels))
    for case in cases:
        img = np.asanyarray(nib.load(str(case / "imaging.nii.gz")).dataobj).astype(np.float32)
        seg = np.asanyarray(nib.load(str(case / "segmentation.nii.gz")).dataobj)
        kept = 0
        for z in range(seg.shape[0]):
            m = np.isin(seg[z], fg)
            if only_with_kidney and not m.any():
                continue
            if kept % slice_stride != 0:
                kept += 1
                continue
            kept += 1
            im = window_ct(img[z])  # -> [0,1], soft-tissue window
            images.append(_resize(im, image_size, order=1).astype(np.float32))
            if label_mode == "classes":
                lab = np.where(np.isin(seg[z], (1, 2)), seg[z], 0).astype(np.float32)  # bg/kidney/tumor
                masks.append(np.rint(_resize(lab, image_size, order=0)).astype(np.uint8))
            else:
                masks.append((_resize(m.astype(np.float32), image_size, order=0) > 0.5).astype(np.uint8))
    if not images:
        return np.empty((0, image_size, image_size), np.float32), np.empty((0, image_size, image_size), np.uint8)
    return np.stack(images), np.stack(masks)


class KitsSliceDataset(Dataset):
    """Wraps pre-extracted (images, masks) arrays as 1xHxW tensors for MONAI."""

    def __init__(self, images: np.ndarray, masks: np.ndarray):
        self.images = images
        self.masks = masks

    def __len__(self):
        return len(self.images)

    def __getitem__(self, i):
        img = self.images[i][None].astype(np.float32)   # 1xHxW
        msk = self.masks[i][None].astype(np.int64)      # 1xHxW
        return {"image": img, "label": msk}
