"""NIH ChestX-ray14 multi-label dataset (TASK_NIH_CXR14).

112k frontal chest X-rays (PNG) with 14 disease labels. These 14 labels are
exactly what radiology-ai already serves, so a model trained here can upgrade /
re-validate that service. Labels come from Data_Entry_2017.csv ("Finding Labels",
pipe-separated). Images live under images*/images/*.png on the Kaggle release.
"""
import glob
import os

import numpy as np
import pandas as pd
from PIL import Image
from torch.utils.data import Dataset
from torchvision import transforms

from data.paths import get_path

CLASSES = [
    "Atelectasis", "Cardiomegaly", "Effusion", "Infiltration", "Mass", "Nodule",
    "Pneumonia", "Pneumothorax", "Consolidation", "Edema", "Emphysema",
    "Fibrosis", "Pleural_Thickening", "Hernia",
]
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def _index_images(root: str) -> dict:
    """filename -> full path (NIH ships images split across images_001.. folders)."""
    paths = {}
    for p in (glob.glob(os.path.join(root, "images*", "images", "*.png"))
              + glob.glob(os.path.join(root, "images", "*.png"))
              + glob.glob(os.path.join(root, "*.png"))):
        paths[os.path.basename(p)] = p
    return paths


def load_index(subset: int = 4000, seed: int = 42):
    """Return a list of (png_path, 14-dim multi-hot label vector)."""
    root = get_path("NIH_CXR14")
    csv = root / "Data_Entry_2017.csv"
    if not csv.exists():
        csv = root / "Data_Entry_2017_v2020.csv"
    df = pd.read_csv(csv)
    imgs = _index_images(str(root))
    df = df[df["Image Index"].isin(imgs)]
    if subset and len(df) > subset:
        df = df.sample(subset, random_state=seed)

    items = []
    for _, r in df.iterrows():
        labels = set(str(r["Finding Labels"]).split("|"))
        vec = np.array([1.0 if c in labels else 0.0 for c in CLASSES], dtype=np.float32)
        items.append((imgs[r["Image Index"]], vec))
    return items


def build_transforms(image_size: int, train: bool):
    aug = [transforms.RandomHorizontalFlip()] if train else []
    return transforms.Compose([
        transforms.Resize((image_size, image_size)),
        *aug,
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])


class NihCxrDataset(Dataset):
    def __init__(self, index, image_size: int = 224, train: bool = False):
        self.index = index
        self.tf = build_transforms(image_size, train)

    def __len__(self):
        return len(self.index)

    def __getitem__(self, i):
        path, vec = self.index[i]
        img = Image.open(path).convert("RGB")
        return self.tf(img), vec
