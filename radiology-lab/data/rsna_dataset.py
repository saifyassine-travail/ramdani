"""RSNA pneumonia chest X-ray dataset for TASK_RSNA_PNEUMONIA.

Labels: <RSNA>/stage_2_train_labels.csv has one row per bounding box, so a patient
is positive (pneumonia) if ANY row has Target==1. We dedup to one label per
patient, build a balanced subset, read each DICOM with pydicom, and feed it to a
torchvision ResNet (3-channel, ImageNet-normalized).
"""
import numpy as np
import pandas as pd
import pydicom
from PIL import Image
from torch.utils.data import Dataset
from torchvision import transforms

from data.paths import get_path

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def load_balanced_index(subset: int = 2000, seed: int = 42):
    """Return a shuffled, class-balanced list of (dicom_path, label)."""
    root = get_path("RSNA_PNEUMONIA")
    df = pd.read_csv(root / "stage_2_train_labels.csv")
    # One label per patient: positive if any box is present.
    lab = df.groupby("patientId")["Target"].max().reset_index()

    n = subset // 2
    pos = lab[lab.Target == 1].sample(min(n, (lab.Target == 1).sum()), random_state=seed)
    neg = lab[lab.Target == 0].sample(min(n, (lab.Target == 0).sum()), random_state=seed)
    sel = pd.concat([pos, neg]).sample(frac=1, random_state=seed)

    img_dir = root / "stage_2_train_images"
    return [(str(img_dir / f"{pid}.dcm"), int(t)) for pid, t in zip(sel.patientId, sel.Target)]


def build_transforms(image_size: int, train: bool):
    aug = [transforms.RandomHorizontalFlip(), transforms.RandomRotation(7)] if train else []
    return transforms.Compose([
        transforms.Resize((image_size, image_size)),
        *aug,
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])


class RsnaXrayDataset(Dataset):
    def __init__(self, index, image_size: int = 224, train: bool = False):
        self.index = index
        self.tf = build_transforms(image_size, train)

    def __len__(self):
        return len(self.index)

    def __getitem__(self, i):
        path, label = self.index[i]
        arr = pydicom.dcmread(path).pixel_array.astype(np.float32)
        arr = (arr - arr.min()) / (arr.max() - arr.min() + 1e-8) * 255.0
        img = Image.fromarray(arr.astype(np.uint8)).convert("RGB")
        return self.tf(img), label
