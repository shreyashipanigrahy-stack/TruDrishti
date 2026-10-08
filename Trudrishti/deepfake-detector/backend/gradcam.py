"""
GradCAM implementation for EfficientNet-B4.
Hooks into the last convolutional block to produce a class-discriminative
heatmap, then blends it with the original image.
"""

import torch
import torch.nn.functional as F
import numpy as np
from PIL import Image
from typing import Optional

try:
    import cv2
    _CV2 = True
except ImportError:
    _CV2 = False

from torchvision import transforms

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
IMAGE_SIZE = 380

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
# Layer selection helpers
# ---------------------------------------------------------------------------

def _get_target_layer(model: torch.nn.Module) -> Optional[torch.nn.Module]:
    """
    Return the best convolutional layer for GradCAM on EfficientNet-B4.
    Tries several common attribute paths.
    """
    candidates = [
        lambda m: m.blocks[-1],          # timm EfficientNet
        lambda m: m.features[-1],        # torchvision EfficientNet
        lambda m: m.conv_head,           # timm head conv
        lambda m: list(m.children())[-3],# generic fallback
    ]
    for fn in candidates:
        try:
            layer = fn(model)
            if layer is not None:
                return layer
        except (AttributeError, IndexError, TypeError):
            continue
    return None


# ---------------------------------------------------------------------------
# GradCAM core
# ---------------------------------------------------------------------------

def generate_gradcam(model: torch.nn.Module, image: Image.Image) -> Image.Image:
    """
    Generate a GradCAM heatmap blended onto *image*.

    If hook registration or backward pass fails, the original image is
    returned unchanged so the rest of the pipeline is not disrupted.
    """
    orig_w, orig_h = image.size

    target_layer = _get_target_layer(model)
    if target_layer is None:
        return image.copy()

    tensor = _transform(image).unsqueeze(0).to(DEVICE)
    tensor.requires_grad_(True)

    _gradients: list = []
    _activations: list = []

    def _fwd_hook(module, inp, out):
        _activations.append(out)
        out.register_hook(_gradients.append)

    handle = target_layer.register_forward_hook(_fwd_hook)

    try:
        model.zero_grad()
        logits = model(tensor)
        # Support both binary sigmoid (shape [1,1]) and multi-class (shape [1,N])
        if logits.shape[-1] == 1:
            score = torch.sigmoid(logits[0, 0])
        else:
            pred_class = int(logits.argmax(dim=1).item())
            score = logits[0, pred_class]
        score.backward()
    except Exception as exc:
        print(f"[gradcam] Backward pass failed: {exc}")
        handle.remove()
        return image.copy()
    finally:
        handle.remove()

    if not _gradients or not _activations:
        return image.copy()

    grad = _gradients[0].detach().cpu()   # [1, C, H, W]
    act  = _activations[0].detach().cpu() # [1, C, H, W]

    weights = grad.mean(dim=[2, 3], keepdim=True)  # Global-avg-pool gradients
    cam = (weights * act).sum(dim=1).squeeze(0)    # [H, W]
    cam = F.relu(cam).numpy()

    # Normalise
    cam -= cam.min()
    if cam.max() > 1e-8:
        cam /= cam.max()

    return _build_overlay(cam, image, orig_w, orig_h)


# ---------------------------------------------------------------------------
# Overlay rendering
# ---------------------------------------------------------------------------

def _build_overlay(cam: np.ndarray, image: Image.Image, w: int, h: int) -> Image.Image:
    if _CV2:
        cam_u8    = np.uint8(255 * cam)
        cam_sized = cv2.resize(cam_u8, (w, h), interpolation=cv2.INTER_LINEAR)
        heatmap   = cv2.applyColorMap(cam_sized, cv2.COLORMAP_JET)
        heatmap   = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)
        orig_np   = np.array(image.resize((w, h)))
        overlay   = cv2.addWeighted(orig_np, 0.55, heatmap, 0.45, 0)
        return Image.fromarray(overlay)
    else:
        # Pure-NumPy JET approximation
        cam_h = _numpy_jet(cam)                       # [H_cam, W_cam, 3] float32
        cam_resized = _resize_numpy(cam_h, h, w)      # [h, w, 3]
        orig_np = np.array(image.resize((w, h))).astype(np.float32)
        overlay = np.clip(orig_np * 0.55 + cam_resized * 255 * 0.45, 0, 255).astype(np.uint8)
        return Image.fromarray(overlay)


def _numpy_jet(cam: np.ndarray) -> np.ndarray:
    """Approximate JET colormap without OpenCV."""
    r = np.clip(1.5 - np.abs(4 * cam - 3), 0, 1)
    g = np.clip(1.5 - np.abs(4 * cam - 2), 0, 1)
    b = np.clip(1.5 - np.abs(4 * cam - 1), 0, 1)
    return np.stack([r, g, b], axis=-1).astype(np.float32)


def _resize_numpy(arr: np.ndarray, h: int, w: int) -> np.ndarray:
    """Nearest-neighbour resize without cv2."""
    src_h, src_w = arr.shape[:2]
    y_idx = (np.arange(h) * src_h / h).astype(int)
    x_idx = (np.arange(w) * src_w / w).astype(int)
    return arr[np.ix_(y_idx, x_idx)]
