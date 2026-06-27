"""Visualization helpers (headless / Agg backend for WSL)."""
import matplotlib

matplotlib.use("Agg")
import matplotlib.patches as mpatches  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402


def window_ct(slice2d: np.ndarray, wl: float = 40.0, ww: float = 400.0) -> np.ndarray:
    """Soft-tissue CT window -> [0,1] for display."""
    lo, hi = wl - ww / 2, wl + ww / 2
    s = np.clip(slice2d, lo, hi)
    return (s - lo) / (hi - lo + 1e-8)


def overlay_axial(ct_volume, masks: dict, slice_idx: int, out_path,
                  alpha: float = 0.45, max_organs: int = 20) -> str:
    """Save a PNG: one axial CT slice with coloured organ masks overlaid.

    ct_volume : HxWxD numpy array (Hounsfield units)
    masks     : {organ_name: HxWxD binary array}
    """
    ct_slice = ct_volume[:, :, slice_idx].astype(np.float32)
    bg = np.rot90(window_ct(ct_slice))
    rgb = np.stack([bg, bg, bg], axis=-1)

    shown = [n for n in list(masks.keys())[:max_organs]]
    cmap = plt.get_cmap("tab20")
    legend = []
    for i, name in enumerate(shown):
        m = np.rot90(masks[name][:, :, slice_idx].astype(bool))
        if not m.any():
            continue
        color = np.array(cmap(i % 20)[:3])
        rgb[m] = (1 - alpha) * rgb[m] + alpha * color
        legend.append(mpatches.Patch(color=color, label=name))

    fig, ax = plt.subplots(figsize=(7, 7))
    ax.imshow(np.clip(rgb, 0, 1))
    ax.set_title(f"TotalSegmentator — axial slice {slice_idx}  ({len(legend)} organs)")
    ax.axis("off")
    if legend:
        ax.legend(handles=legend, loc="upper right", fontsize=6,
                  framealpha=0.6, ncol=1)
    fig.tight_layout()
    fig.savefig(out_path, dpi=120, bbox_inches="tight")
    plt.close(fig)
    return str(out_path)


def overlay_gt_pred(ct_volume, gt_masks: dict, pred_masks: dict, slice_idx: int,
                    out_path, alpha: float = 0.5, max_organs: int = 20,
                    mean_dice=None) -> str:
    """3 panels on one axial slice: CT | CT+ground-truth | CT+prediction.

    Organs are coloured consistently (same colour in GT and prediction) so a
    doctor can eyeball where the model agrees/disagrees with the reference.
    """
    bg = np.rot90(window_ct(ct_volume[:, :, slice_idx].astype(np.float32)))
    names = sorted(set(list(gt_masks) + list(pred_masks)))[:max_organs]
    cmap = plt.get_cmap("tab20")
    cidx = {n: i % 20 for i, n in enumerate(names)}

    def colorize(masks):
        rgb = np.stack([bg, bg, bg], axis=-1)
        for n in names:
            if n not in masks:
                continue
            ms = np.rot90(masks[n][:, :, slice_idx].astype(bool))
            if ms.any():
                rgb[ms] = (1 - alpha) * rgb[ms] + alpha * np.array(cmap(cidx[n])[:3])
        return np.clip(rgb, 0, 1)

    fig, axs = plt.subplots(1, 3, figsize=(13, 5))
    axs[0].imshow(bg, cmap="gray"); axs[0].set_title("CT")
    axs[1].imshow(colorize(gt_masks)); axs[1].set_title("Ground truth")
    title = "Pretrained prediction" + (f"  (mean Dice {mean_dice:.3f})" if mean_dice is not None else "")
    axs[2].imshow(colorize(pred_masks)); axs[2].set_title(title)
    for a in axs:
        a.axis("off")
    fig.tight_layout()
    fig.savefig(out_path, dpi=120, bbox_inches="tight")
    plt.close(fig)
    return str(out_path)


def panel_3(image, gt, pred, out_path, title=""):
    """Save a 3-panel figure: image | ground truth | prediction (for KiTS)."""
    fig, axs = plt.subplots(1, 3, figsize=(10, 3.6))
    for ax, data, name in zip(axs, [image, gt, pred], ["Image", "GT", "Pred"]):
        ax.imshow(data, cmap="gray" if name == "Image" else "viridis")
        ax.set_title(name)
        ax.axis("off")
    if title:
        fig.suptitle(title)
    fig.tight_layout()
    fig.savefig(out_path, dpi=120, bbox_inches="tight")
    plt.close(fig)
    return str(out_path)
