# -*- coding: utf-8 -*-
"""
EfficientNet-B4 model loader and inference module.
Handles flexible checkpoint formats (plain state_dict, DataParallel, nested dicts).
Supports both single-output binary sigmoid and 2-class softmax heads.
"""

import os
import torch
import torch.nn as nn
import timm
from torchvision import transforms
from PIL import Image
from typing import Tuple

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
IMAGE_SIZE = 380  # EfficientNet-B4 native resolution

# Module-level state shared between load_model() and predict()
_state: dict = {}

# Allow override via environment variable (useful for Colab)
# backend/ -> deepfake-detector/ -> workspace root (where .pth lives)
_default_path = os.path.join(os.path.dirname(__file__), "..", "..", "custom_b4_srm01.pth")
MODEL_PATH = os.environ.get("MODEL_PATH", os.path.abspath(_default_path))

# ImageNet normalisation (standard for timm EfficientNet)
_transform = transforms.Compose(
    [
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
    ]
)


# ---------------------------------------------------------------------------
# Model definition helpers
# ---------------------------------------------------------------------------

def _build_base_model(num_classes: int = 1) -> nn.Module:
    """Create a fresh EfficientNet-B4 with the correct head size."""
    return timm.create_model(
        "efficientnet_b4",
        pretrained=False,
        num_classes=num_classes,
    )


def _strip_prefix(state_dict: dict, prefix: str = "module.") -> dict:
    """Remove DataParallel / DDP 'module.' prefix from keys."""
    return {
        (k[len(prefix):] if k.startswith(prefix) else k): v
        for k, v in state_dict.items()
    }


def _load_state_dict(checkpoint) -> dict:
    """Extract the raw state dict regardless of checkpoint format."""
    if isinstance(checkpoint, dict):
        for key in ("model_state_dict", "state_dict", "model"):
            if key in checkpoint:
                return checkpoint[key]
        return checkpoint
    if isinstance(checkpoint, nn.Module):
        return checkpoint.state_dict()
    return checkpoint


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_model() -> nn.Module:
    """
    Load EfficientNet-B4 from MODEL_PATH.
    Handles plain state_dict, DataParallel, and nested checkpoint formats.
    Auto-detects binary sigmoid vs multi-class softmax head.
    """
    print(f"[model] Loading checkpoint from: {MODEL_PATH}")
    print(f"[model] Using device: {DEVICE}")

    checkpoint = torch.load(MODEL_PATH, map_location=DEVICE, weights_only=False)
    raw_sd = _load_state_dict(checkpoint)
    raw_sd = _strip_prefix(raw_sd)

    # Infer number of output classes from classifier weight shape
    classifier_key = next(
        (k for k in raw_sd if "classifier" in k and "weight" in k), None
    )
    num_classes = 2
    if classifier_key is not None:
        num_classes = raw_sd[classifier_key].shape[0]
        print(f"[model] Detected {num_classes} output class(es) from checkpoint.")

    model = _build_base_model(num_classes=num_classes)

    missing, unexpected = model.load_state_dict(raw_sd, strict=False)
    if missing:
        print(f"[model] WARNING: {len(missing)} missing keys (first 5: {missing[:5]})")
    if unexpected:
        print(f"[model] WARNING: {len(unexpected)} unexpected keys (first 5: {unexpected[:5]})")

    model.to(DEVICE)
    model.eval()

    mode = "sigmoid (binary)" if num_classes == 1 else "softmax (multi-class)"
    print(f"[model] OK: Model ready — num_classes={num_classes}, mode={mode}")

    _state["num_classes"] = num_classes
    return model


def predict(
    model: nn.Module,
    image: Image.Image,
) -> Tuple[str, float, float, float, torch.Tensor]:
    """
    Run inference on a PIL image.

    Returns
    -------
    prediction  : 'REAL' or 'FAKE'
    confidence  : max(real_prob, fake_prob)
    real_prob   : probability for REAL class
    fake_prob   : probability for FAKE class
    tensor      : preprocessed input tensor (for GradCAM)
    """
    tensor = _transform(image).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        logits = model(tensor)  # shape [1, 1] or [1, N]

    num_classes = _state.get("num_classes", logits.shape[-1])

    if num_classes == 1:
        # Binary sigmoid head: high logit => FAKE
        fake_prob = float(torch.sigmoid(logits[0, 0]).item())
        real_prob = 1.0 - fake_prob
    else:
        probs = torch.softmax(logits, dim=1)[0]
        real_prob = float(probs[0].item())
        fake_prob = float(probs[1].item())

    confidence = max(real_prob, fake_prob)
    prediction = "FAKE" if fake_prob > real_prob else "REAL"

    return prediction, confidence, real_prob, fake_prob, tensor
