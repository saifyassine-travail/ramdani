"""TASK_KITS_2D — train a small 2D U-Net on KiTS23 kidney slices.

DiceCELoss, ~5 epochs, best checkpoint, metrics.json, and a 3-panel
(image | ground-truth | prediction) PNG for up to 5 validation cases.

    python -m train.train_kits --config configs/kits_2d.yaml --subset 4
"""
import argparse
import sys

import numpy as np
import torch
from monai.losses import DiceCELoss
from monai.metrics import DiceMetric
from torch.utils.data import DataLoader
from tqdm import tqdm

from data.kits_dataset import KitsSliceDataset, extract_slices, list_kits_cases
from infer.viz import panel_3
from models.unet2d import build_unet2d
from train.common import (ensure_dir, get_device, load_config, save_checkpoint,
                          save_metrics, set_seed)


def main():
    ap = argparse.ArgumentParser(description="TASK_KITS_2D")
    ap.add_argument("--config", default="configs/kits_2d.yaml")
    ap.add_argument("--subset", type=int, default=None, help="limit number of train cases")
    args = ap.parse_args()

    cfg = load_config(args.config)
    set_seed(cfg.get("seed", 42))
    device = get_device()
    out = ensure_dir(cfg["output_dir"])

    n_train = min(cfg["train_patients"], args.subset) if args.subset else cfg["train_patients"]
    n_val = cfg["val_patients"]

    cases = list_kits_cases()
    if len(cases) < n_train + n_val:
        # shrink val first, then train, to whatever is available
        n_val = max(1, min(n_val, len(cases) - 1))
        n_train = max(1, len(cases) - n_val)
    train_cases = cases[:n_train]
    val_cases = cases[n_train:n_train + n_val]
    print(f"[kits] {len(train_cases)} train / {len(val_cases)} val cases", flush=True)

    fg = tuple(cfg.get("kidney_labels", [1, 2, 3]))
    stride = cfg.get("slice_stride", 1)
    num_classes = cfg.get("num_classes", 2)            # 2=binary kidney, 3=bg/kidney/tumor
    label_mode = "classes" if num_classes > 2 else "binary"
    class_names = ["kidney", "tumor"][: num_classes - 1]
    print(f"[kits] mode: {num_classes}-class ({', '.join(class_names)})", flush=True)
    print("[kits] extracting slices (loads each volume once)…", flush=True)
    tr_imgs, tr_msks = extract_slices(train_cases, cfg["image_size"], fg,
                                      cfg["only_slices_with_kidney"], stride, label_mode)
    va_imgs, va_msks = extract_slices(val_cases, cfg["image_size"], fg,
                                      cfg["only_slices_with_kidney"], stride, label_mode)
    print(f"[kits] slices: train={len(tr_imgs)} val={len(va_imgs)}", flush=True)

    train_dl = DataLoader(KitsSliceDataset(tr_imgs, tr_msks), batch_size=cfg["batch_size"],
                          shuffle=True, num_workers=cfg["num_workers"])
    val_dl = DataLoader(KitsSliceDataset(va_imgs, va_msks), batch_size=cfg["batch_size"],
                        shuffle=False, num_workers=cfg["num_workers"])

    model = build_unet2d(cfg["channels"], cfg["strides"], in_channels=1, out_channels=num_classes).to(device)
    n_params = sum(p.numel() for p in model.parameters())
    print(f"[kits] UNet params: {n_params/1e6:.2f}M", flush=True)

    loss_fn = DiceCELoss(to_onehot_y=True, softmax=True)
    opt = torch.optim.Adam(model.parameters(), lr=cfg["lr"])
    dice_metric = DiceMetric(include_background=False, reduction="mean_batch")  # per-class

    best_dice, best_class_dice, history = 0.0, {}, []
    for epoch in range(cfg["epochs"]):
        model.train()
        running = 0.0
        for batch in tqdm(train_dl, desc=f"epoch {epoch+1}/{cfg['epochs']}"):
            x = batch["image"].to(device)
            y = batch["label"].to(device)
            opt.zero_grad()
            logits = model(x)
            loss = loss_fn(logits, y)
            loss.backward()
            opt.step()
            running += loss.item() * x.size(0)

        # validation Dice
        model.eval()
        dice_metric.reset()
        with torch.no_grad():
            for batch in val_dl:
                x = batch["image"].to(device)
                y = batch["label"].to(device)
                pred = torch.argmax(model(x), dim=1, keepdim=True)
                dice_metric(y_pred=torch.nn.functional.one_hot(pred[:, 0], num_classes).permute(0, 3, 1, 2).float(),
                            y=torch.nn.functional.one_hot(y[:, 0], num_classes).permute(0, 3, 1, 2).float())
        per_class = dice_metric.aggregate()  # tensor [num_classes-1]
        class_dice = {name: round(float(per_class[i]), 4) for i, name in enumerate(class_names)}
        val_dice = float(per_class.mean().item())  # mean foreground Dice (model selection)
        history.append({"epoch": epoch + 1, "train_loss": round(running / max(1, len(tr_imgs)), 4),
                        "val_dice": round(val_dice, 4), **{f"dice_{k}": v for k, v in class_dice.items()}})
        dice_str = "  ".join(f"{k}={v:.3f}" for k, v in class_dice.items())
        print(f"[kits] epoch {epoch+1}: train_loss={running/max(1,len(tr_imgs)):.4f}  val_Dice={val_dice:.4f}  ({dice_str})", flush=True)
        if val_dice > best_dice:
            best_dice = val_dice
            best_class_dice = class_dice
            save_checkpoint(model, out, "best.pth")

    # --- Sample 3-panel PNGs for up to 5 val slices ---
    model.eval()
    with torch.no_grad():
        for i in range(min(5, len(va_imgs))):
            x = torch.from_numpy(va_imgs[i][None, None]).float().to(device)
            pred = torch.argmax(model(x), dim=1)[0].cpu().numpy()
            panel_3(va_imgs[i], va_msks[i], pred, out / f"val_sample_{i}.png",
                    title=f"KiTS val sample {i}")

    save_metrics(out, {
        "task": "TASK_KITS_2D",
        "num_classes": num_classes,
        "classes": class_names,
        "best_val_dice_mean": round(best_dice, 4),
        "best_val_dice_per_class": best_class_dice,
        "n_train_cases": len(train_cases), "n_val_cases": len(val_cases),
        "n_train_slices": int(len(tr_imgs)), "n_val_slices": int(len(va_imgs)),
        "unet_params_millions": round(n_params / 1e6, 2),
        "epochs": cfg["epochs"],
        "history": history,
    })
    print(f"[kits] BEST mean Dice = {best_dice:.4f}  per-class={best_class_dice} | -> {out}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
