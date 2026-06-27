"""
Core radiology analysis engine.
Pipeline: TorchXRayVision → Grad-CAM → MedSAM2 (optional)
"""

import os
import io
import base64
import warnings
from typing import Optional

import cv2
import numpy as np
import torch
import torch.nn.functional as F
import torchxrayvision as xrv
import torchvision.transforms as T
from PIL import Image, ImageDraw, ImageFont

warnings.filterwarnings("ignore")


# ---------------------------------------------------------------------------
# Grad-CAM — localises which region triggered each pathology
# ---------------------------------------------------------------------------

class GradCAM:
    def __init__(self, model: torch.nn.Module):
        self.model = model
        self._grads: Optional[torch.Tensor] = None
        self._acts: Optional[torch.Tensor] = None

        # Hook on DenseNet's last dense block
        target = model.features.denseblock4
        target.register_forward_hook(self._fwd_hook)
        target.register_full_backward_hook(self._bwd_hook)

    def _fwd_hook(self, module, inp, out):
        self._acts = out

    def _bwd_hook(self, module, grad_in, grad_out):
        self._grads = grad_out[0]

    def generate(self, tensor: torch.Tensor, class_idx: int) -> Optional[np.ndarray]:
        self.model.zero_grad()
        out = self.model(tensor)

        one_hot = torch.zeros_like(out)
        one_hot[0, class_idx] = 1.0
        out.backward(gradient=one_hot, retain_graph=True)

        if self._grads is None or self._acts is None:
            return None

        weights = self._grads.mean(dim=[2, 3], keepdim=True)
        cam = (weights * self._acts).sum(dim=1, keepdim=True)
        cam = F.relu(cam).squeeze().cpu().detach().numpy()

        if cam.max() > 0:
            cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)

        return cam


# ---------------------------------------------------------------------------
# MedSAM2 wrapper — precise mask around the detected region
# ---------------------------------------------------------------------------

class MedSAM2Wrapper:
    """
    Loads SAM2 with MedSAM2 fine-tuned weights.
    Falls back gracefully if weights are not present.
    """

    CHECKPOINT = os.path.join(os.path.dirname(__file__), "weights", "MedSAM2_pretrain.pth")

    def __init__(self, device: torch.device):
        self.device = device
        self.predictor = None
        self._load()

    def _load(self):
        if not os.path.exists(self.CHECKPOINT):
            print(f"[MedSAM2] Weights not found at {self.CHECKPOINT}. Run setup_weights.py first.")
            return

        try:
            from sam2.build_sam import build_sam2
            from sam2.sam2_image_predictor import SAM2ImagePredictor

            cfg = os.path.join(os.path.dirname(__file__), "configs", "sam2_hiera_s.yaml")
            if not os.path.exists(cfg):
                cfg = "sam2_hiera_s"          # installed as package

            sam2 = build_sam2(cfg, self.CHECKPOINT, device=self.device)
            self.predictor = SAM2ImagePredictor(sam2)
            print("[MedSAM2] Loaded successfully.")
        except ImportError:
            print("[MedSAM2] sam2 package not installed. pip install git+https://github.com/facebookresearch/sam2.git")
        except Exception as exc:
            print(f"[MedSAM2] Load failed: {exc}")

    @property
    def available(self) -> bool:
        return self.predictor is not None

    def predict(self, image_rgb: np.ndarray, bbox: np.ndarray) -> Optional[np.ndarray]:
        """Returns a binary mask (H×W) or None."""
        if not self.available:
            return None
        try:
            self.predictor.set_image(image_rgb)
            masks, scores, _ = self.predictor.predict(
                box=bbox,
                multimask_output=True,
            )
            # Pick the highest-confidence mask
            best = masks[scores.argmax()]
            return best.astype(np.uint8)
        except Exception as exc:
            print(f"[MedSAM2] Inference error: {exc}")
            return None


# ---------------------------------------------------------------------------
# Main analyser
# ---------------------------------------------------------------------------

PATHOLOGY_FR = {
    "Atelectasis":              "Atélectasie",
    "Cardiomegaly":             "Cardiomégalie",
    "Effusion":                 "Épanchement pleural",
    "Infiltration":             "Infiltrat",
    "Mass":                     "Masse",
    "Nodule":                   "Nodule",
    "Pneumonia":                "Pneumonie",
    "Pneumothorax":             "Pneumothorax",
    "Consolidation":            "Consolidation",
    "Edema":                    "Œdème",
    "Emphysema":                "Emphysème",
    "Fibrosis":                 "Fibrose",
    "Pleural_Thickening":       "Épaississement pleural",
    "Hernia":                   "Hernie diaphragmatique",
    "Lung Lesion":              "Lésion pulmonaire",
    "Lung Opacity":             "Opacité pulmonaire",
    "Enlarged Cardiomediastinum": "Élargissement médiastinal",
    "Fracture":                 "Fracture",
}

# The densenet121-res224-all model outputs sigmoid probabilities that hover
# around 0.5 for uncertain/normal images. Thresholds must be well above that
# baseline to avoid flagging normal lungs as pathological.
THRESHOLDS = {p: 0.65 for p in PATHOLOGY_FR}
THRESHOLDS.update({
    "Mass":                     0.60,
    "Nodule":                   0.60,
    "Emphysema":                0.60,
    "Fibrosis":                 0.60,
    "Hernia":                   0.55,
    "Pneumothorax":             0.62,
    "Lung Opacity":             0.62,
    "Enlarged Cardiomediastinum": 0.62,
})


def _severity(score: float) -> str:
    if score < 0.70:
        return "faible"
    if score < 0.85:
        return "modéré"
    return "élevé"


def _img_to_b64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


class RadiologyAnalyzer:

    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"[Analyzer] Device: {self.device}")

        # ── TorchXRayVision ──────────────────────────────────────────────
        print("[Analyzer] Loading TorchXRayVision DenseNet-121…")
        self.xrv_model = xrv.models.DenseNet(weights="densenet121-res224-all")
        self.xrv_model.to(self.device).eval()
        self.gradcam = GradCAM(self.xrv_model)
        print("[Analyzer] TorchXRayVision ready.")

        # ── MedSAM2 (optional) ───────────────────────────────────────────
        self.sam = MedSAM2Wrapper(self.device)

    # ------------------------------------------------------------------
    # Pre-processing
    # ------------------------------------------------------------------

    def _preprocess_xrv(self, pil_img: Image.Image):
        """Returns (tensor [1,1,224,224], numpy_gray [224,224])."""
        gray = np.array(pil_img.convert("L")).astype(np.float32)
        gray = xrv.datasets.normalize(gray, maxval=255, reshape=True)  # → [1,H,W]

        pipeline = T.Compose([
            xrv.datasets.XRayCenterCrop(),
            xrv.datasets.XRayResizer(224),
        ])
        gray = pipeline(gray)                                   # [1,224,224]
        tensor = torch.from_numpy(gray).unsqueeze(0).to(self.device)  # [1,1,224,224]
        return tensor, gray[0]                                  # tensor, 2-D array

    # ------------------------------------------------------------------
    # Grad-CAM heatmap overlay
    # ------------------------------------------------------------------

    def _heatmap_overlay(self, cam: np.ndarray, orig: Image.Image) -> Image.Image:
        w, h = orig.size
        cam_up = cv2.resize(cam, (w, h))
        heat = cv2.applyColorMap((cam_up * 255).astype(np.uint8), cv2.COLORMAP_JET)
        heat = cv2.cvtColor(heat, cv2.COLOR_BGR2RGB)
        orig_np = np.array(orig.convert("RGB"))
        blended = cv2.addWeighted(orig_np, 0.55, heat, 0.45, 0)
        return Image.fromarray(blended)

    # ------------------------------------------------------------------
    # MedSAM2 segmentation overlay
    # ------------------------------------------------------------------

    def _sam_overlay(self, orig: Image.Image, cam: np.ndarray) -> Optional[Image.Image]:
        if not self.sam.available:
            return None

        w, h = orig.size
        cam_up = cv2.resize(cam, (w, h))

        # Derive bounding box from high-attention zone (threshold 55%)
        thresh = 0.55
        ys, xs = np.where(cam_up > thresh)
        if len(ys) == 0:
            return None

        margin = 15
        x1 = max(0,     int(xs.min()) - margin)
        y1 = max(0,     int(ys.min()) - margin)
        x2 = min(w - 1, int(xs.max()) + margin)
        y2 = min(h - 1, int(ys.max()) + margin)
        bbox = np.array([[x1, y1, x2, y2]], dtype=np.float32)

        img_rgb = np.array(orig.convert("RGB"))
        mask = self.sam.predict(img_rgb, bbox)

        if mask is None:
            return None

        # Red translucent overlay + red contour
        overlay = img_rgb.copy().astype(np.float32)
        overlay[mask == 1] = overlay[mask == 1] * 0.45 + np.array([255, 60, 60]) * 0.55
        overlay = overlay.clip(0, 255).astype(np.uint8)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(overlay, contours, -1, (255, 40, 40), 2)

        return Image.fromarray(overlay)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def analyze(self, image_bytes: bytes) -> dict:
        pil_orig = Image.open(io.BytesIO(image_bytes))
        pil_rgb  = pil_orig.convert("RGB")

        # ── 1. Pathology detection ───────────────────────────────────────
        tensor, _ = self._preprocess_xrv(pil_orig)
        tensor_grad = tensor.clone().detach().requires_grad_(True)

        with torch.set_grad_enabled(True):
            raw_out = self.xrv_model(tensor_grad)
        scores = torch.sigmoid(raw_out[0]).cpu().detach().numpy()

        findings = []
        top_idx, top_score = None, 0.0

        for i, pathology in enumerate(self.xrv_model.pathologies):
            score = float(scores[i])
            threshold = THRESHOLDS.get(pathology, 0.30)
            if score >= threshold:
                findings.append({
                    "pathologie":    PATHOLOGY_FR.get(pathology, pathology),
                    "code":          pathology,
                    "confiance":     round(score, 3),
                    "pourcentage":   f"{score * 100:.1f}%",
                    "severite":      _severity(score),
                })
            if score > top_score:
                top_score  = score
                top_idx    = i

        findings.sort(key=lambda x: x["confiance"], reverse=True)

        # ── 2. Grad-CAM for top pathology ────────────────────────────────
        heatmap_b64 = None
        sam_b64     = None
        cam         = None

        if top_idx is not None:
            try:
                cam = self.gradcam.generate(tensor_grad, top_idx)
            except Exception as exc:
                print(f"[GradCAM] {exc}")

        if cam is not None:
            try:
                heat_img    = self._heatmap_overlay(cam, pil_rgb)
                heatmap_b64 = _img_to_b64(heat_img)
            except Exception as exc:
                print(f"[Heatmap] {exc}")

            # ── 3. MedSAM2 segmentation ──────────────────────────────────
            try:
                sam_img = self._sam_overlay(pil_rgb, cam)
                if sam_img:
                    sam_b64 = _img_to_b64(sam_img)
            except Exception as exc:
                print(f"[SAM] {exc}")

        status = "anomalie_detectee" if findings else "normal"

        return {
            "status":               status,
            "total_anomalies":      len(findings),
            "findings":             findings,
            "original_image":       _img_to_b64(pil_rgb),
            "heatmap_image":        heatmap_b64,
            "segmentation_image":   sam_b64,
            "medsam2_available":    self.sam.available,
            "device":               str(self.device),
            "disclaimer": (
                "Analyse IA à titre indicatif uniquement. "
                "Ne remplace pas le diagnostic d'un radiologue qualifié."
            ),
        }
