"""ResNet18 (ImageNet-pretrained) for RSNA pneumonia, backbone mostly frozen."""
import torch.nn as nn
from torchvision.models import ResNet18_Weights, resnet18


def build_rsna_resnet(num_classes: int = 2, freeze_backbone: bool = True) -> nn.Module:
    model = resnet18(weights=ResNet18_Weights.IMAGENET1K_V1)

    if freeze_backbone:
        for p in model.parameters():
            p.requires_grad = False
        # Keep the last residual block trainable (cheap on CPU, big accuracy win).
        for p in model.layer4.parameters():
            p.requires_grad = True

    # Fresh classifier head (always trainable). X-rays are fed as 3 channels.
    model.fc = nn.Linear(model.fc.in_features, num_classes)
    return model
