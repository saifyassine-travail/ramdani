"""Shared helpers: config loading, deterministic seeding, CPU device, I/O."""
import json
import os
import random
from pathlib import Path

import numpy as np
import torch
import yaml


def load_config(path: str) -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def set_seed(seed: int = 42) -> None:
    """Make a run reproducible across random / numpy / torch."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)
    # CPU determinism: keep cudnn flags harmless even though we're CPU-only.
    torch.backends.cudnn.benchmark = False


def get_device() -> torch.device:
    """This lab is CPU-only by design (see README)."""
    return torch.device("cpu")


def ensure_dir(path) -> Path:
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


def save_metrics(out_dir, metrics: dict) -> Path:
    out = ensure_dir(out_dir) / "metrics.json"
    with open(out, "w") as f:
        json.dump(metrics, f, indent=2, default=str)
    return out


def save_checkpoint(model: torch.nn.Module, out_dir, name: str = "best.pth") -> Path:
    out = ensure_dir(out_dir) / name
    torch.save(model.state_dict(), out)
    return out
