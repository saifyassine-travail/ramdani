"""TASK_NIH_CXR14 — multi-label (14-pathology) chest X-ray classifier.

ResNet18 (ImageNet) with a 14-way sigmoid head, BCEWithLogitsLoss. Reports
per-class AUC + macro-mean AUC. Plugs into radiology-ai's 14-pathology space.

    python -m train.train_nih --config configs/nih_cxr14.yaml --subset 1000
"""
import argparse
import sys

import numpy as np
import torch
import torch.nn as nn
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader
from tqdm import tqdm

from data.nih_dataset import CLASSES, NihCxrDataset, load_index
from models.rsna_resnet import build_rsna_resnet
from train.common import (ensure_dir, get_device, load_config, save_checkpoint,
                          save_metrics, set_seed)


@torch.no_grad()
def evaluate(model, loader, device):
    model.eval()
    probs, ys = [], []
    for x, y in loader:
        p = torch.sigmoid(model(x.to(device))).cpu().numpy()
        probs.append(p)
        ys.append(y.numpy())
    return np.concatenate(ys), np.concatenate(probs)


def macro_auc(ys, probs):
    """Mean AUC over classes that have both positives and negatives in val."""
    aucs = {}
    for i, c in enumerate(CLASSES):
        col = ys[:, i]
        if 0 < col.sum() < len(col):
            aucs[c] = round(float(roc_auc_score(col, probs[:, i])), 4)
    mean = round(float(np.mean(list(aucs.values()))), 4) if aucs else 0.0
    return mean, aucs


def main():
    ap = argparse.ArgumentParser(description="TASK_NIH_CXR14")
    ap.add_argument("--config", default="configs/nih_cxr14.yaml")
    ap.add_argument("--subset", type=int, default=None, help="limit number of images")
    args = ap.parse_args()

    cfg = load_config(args.config)
    set_seed(cfg.get("seed", 42))
    device = get_device()
    out = ensure_dir(cfg["output_dir"])
    subset = args.subset or cfg["subset"]

    index = load_index(subset, cfg["seed"])
    tr, va = train_test_split(index, test_size=cfg["val_split"], random_state=cfg["seed"])
    print(f"[nih] train={len(tr)} val={len(va)} | {len(CLASSES)} labels", flush=True)

    train_dl = DataLoader(NihCxrDataset(tr, cfg["image_size"], train=True),
                          batch_size=cfg["batch_size"], shuffle=True, num_workers=cfg["num_workers"])
    val_dl = DataLoader(NihCxrDataset(va, cfg["image_size"], train=False),
                        batch_size=cfg["batch_size"], shuffle=False, num_workers=cfg["num_workers"])

    model = build_rsna_resnet(num_classes=len(CLASSES), freeze_backbone=cfg["freeze_backbone"]).to(device)
    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad],
                            lr=cfg["lr"], weight_decay=cfg["weight_decay"])
    criterion = nn.BCEWithLogitsLoss()

    best_auc, best_per_class, history = 0.0, {}, []
    for epoch in range(cfg["epochs"]):
        model.train()
        running = 0.0
        for x, y in tqdm(train_dl, desc=f"epoch {epoch+1}/{cfg['epochs']}"):
            x, y = x.to(device), y.to(device)
            opt.zero_grad()
            loss = criterion(model(x), y)
            loss.backward()
            opt.step()
            running += loss.item() * x.size(0)

        ys, probs = evaluate(model, val_dl, device)
        mean_auc, per_class = macro_auc(ys, probs)
        history.append({"epoch": epoch + 1, "train_loss": round(running / len(tr), 4),
                        "val_macro_auc": mean_auc})
        print(f"[nih] epoch {epoch+1}: loss={running/len(tr):.4f}  macro-AUC={mean_auc:.4f}", flush=True)
        if mean_auc > best_auc:
            best_auc, best_per_class = mean_auc, per_class
            save_checkpoint(model, out, "best.pth")

    save_metrics(out, {
        "task": "TASK_NIH_CXR14",
        "classes": CLASSES,
        "best_val_macro_auc": best_auc,
        "best_val_per_class_auc": best_per_class,
        "n_train": len(tr), "n_val": len(va),
        "epochs": cfg["epochs"],
        "history": history,
    })
    print(f"[nih] BEST macro-AUC = {best_auc:.4f} | per-class={best_per_class} -> {out}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
