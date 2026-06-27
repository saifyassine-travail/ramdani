"""TASK_RSNA_PNEUMONIA — ResNet18 (ImageNet) chest X-ray pneumonia classifier.

Balanced subset, backbone frozen except layer4 + head, AdamW, CPU-friendly.
Saves best checkpoint, metrics.json, and a ROC-curve PNG.

    python -m train.train_rsna --config configs/rsna_pneumonia.yaml --subset 500
"""
import argparse
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import torch  # noqa: E402
import torch.nn as nn  # noqa: E402
from sklearn.metrics import (accuracy_score, confusion_matrix,  # noqa: E402
                             roc_auc_score, roc_curve)
from sklearn.model_selection import train_test_split  # noqa: E402
from torch.utils.data import DataLoader  # noqa: E402
from tqdm import tqdm  # noqa: E402

from data.rsna_dataset import RsnaXrayDataset, load_balanced_index  # noqa: E402
from models.rsna_resnet import build_rsna_resnet  # noqa: E402
from train.common import (ensure_dir, get_device, load_config,  # noqa: E402
                          save_checkpoint, save_metrics, set_seed)


@torch.no_grad()
def evaluate(model, loader, device):
    model.eval()
    probs, ys = [], []
    for x, y in loader:
        p = torch.softmax(model(x.to(device)), dim=1)[:, 1].cpu().numpy()
        probs.extend(p.tolist())
        ys.extend(y.tolist())
    return ys, probs


def main():
    ap = argparse.ArgumentParser(description="TASK_RSNA_PNEUMONIA")
    ap.add_argument("--config", default="configs/rsna_pneumonia.yaml")
    ap.add_argument("--subset", type=int, default=None, help="limit number of images")
    args = ap.parse_args()

    cfg = load_config(args.config)
    set_seed(cfg.get("seed", 42))
    device = get_device()
    out = ensure_dir(cfg["output_dir"])
    subset = args.subset or cfg["subset"]

    # --- Data (balanced, stratified split) ---
    index = load_balanced_index(subset, cfg["seed"])
    labels = [lab for _, lab in index]
    tr, va = train_test_split(index, test_size=cfg["val_split"], stratify=labels,
                              random_state=cfg["seed"])
    print(f"[rsna] train={len(tr)}  val={len(va)}  (balanced subset of {len(index)})", flush=True)

    train_dl = DataLoader(RsnaXrayDataset(tr, cfg["image_size"], train=True),
                          batch_size=cfg["batch_size"], shuffle=True, num_workers=cfg["num_workers"])
    val_dl = DataLoader(RsnaXrayDataset(va, cfg["image_size"], train=False),
                        batch_size=cfg["batch_size"], shuffle=False, num_workers=cfg["num_workers"])

    # --- Model / optim ---
    model = build_rsna_resnet(num_classes=2, freeze_backbone=cfg["freeze_backbone"]).to(device)
    trainable = [p for p in model.parameters() if p.requires_grad]
    opt = torch.optim.AdamW(trainable, lr=cfg["lr"], weight_decay=cfg["weight_decay"])
    criterion = nn.CrossEntropyLoss()

    best_auc, best = 0.0, None
    history = []
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
        auc = roc_auc_score(ys, probs)
        preds = [1 if p >= 0.5 else 0 for p in probs]
        acc = accuracy_score(ys, preds)
        history.append({"epoch": epoch + 1, "train_loss": round(running / len(tr), 4),
                        "val_auc": round(auc, 4), "val_acc": round(acc, 4)})
        print(f"[rsna] epoch {epoch+1}: train_loss={running/len(tr):.4f}  val_AUC={auc:.4f}  val_acc={acc:.4f}", flush=True)

        if auc > best_auc:
            best_auc = auc
            save_checkpoint(model, out, "best.pth")
            best = (ys, probs)

    # --- ROC curve + confusion matrix from the best epoch ---
    ys, probs = best if best else (ys, probs)
    fpr, tpr, _ = roc_curve(ys, probs)
    plt.figure(figsize=(5, 5))
    plt.plot(fpr, tpr, label=f"AUC = {best_auc:.3f}")
    plt.plot([0, 1], [0, 1], "--", color="gray")
    plt.xlabel("False positive rate")
    plt.ylabel("True positive rate")
    plt.title("RSNA pneumonia — ROC")
    plt.legend(loc="lower right")
    plt.savefig(out / "roc_curve.png", dpi=120, bbox_inches="tight")
    plt.close()

    cm = confusion_matrix(ys, [1 if p >= 0.5 else 0 for p in probs]).tolist()
    save_metrics(out, {
        "task": "TASK_RSNA_PNEUMONIA",
        "best_val_auc": round(best_auc, 4),
        "n_train": len(tr), "n_val": len(va),
        "epochs": cfg["epochs"],
        "history": history,
        "confusion_matrix": cm,  # [[TN, FP], [FN, TP]]
        "roc_png": str(out / "roc_curve.png"),
    })
    print(f"[rsna] BEST val AUC = {best_auc:.4f} | checkpoint + roc_curve.png -> {out}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
