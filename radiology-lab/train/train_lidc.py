"""TASK_LIDC_NODULE_CLS — nodule vs non-nodule CNN on LIDC-IDRI.  [PHASE 2]

Skeleton with full CLI wiring. Implementation (pylidc patch mining, class-weighted
CE, 10 epochs, accuracy/AUC/confusion-matrix, metrics.json + sample PNG) lands in
the next phase — verify the environment with TASK_TOTALSEG_INFER first.

    python -m train.train_lidc --config configs/lidc_nodule_cls.yaml --subset 20
"""
import argparse
import sys

from train.common import load_config, set_seed


def main():
    ap = argparse.ArgumentParser(description="TASK_LIDC_NODULE_CLS")
    ap.add_argument("--config", default="configs/lidc_nodule_cls.yaml")
    ap.add_argument("--subset", type=int, default=None, help="limit number of patients")
    args = ap.parse_args()

    cfg = load_config(args.config)
    set_seed(cfg.get("seed", 42))
    if args.subset:
        cfg["patients"] = min(cfg["patients"], args.subset)

    print("=" * 64)
    print("TASK_LIDC_NODULE_CLS — scaffolded. Full training implemented next phase.")
    print("Run `make totalseg-infer` first to verify the setup.")
    print("=" * 64)
    return 0


if __name__ == "__main__":
    sys.exit(main())
