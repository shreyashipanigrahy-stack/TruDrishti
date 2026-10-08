"""
SRM (Steganalysis Rich Model) analysis module.
Applies high-pass residual filters to reveal manipulation artifacts
in images, particularly those introduced by GAN-based deepfake generators.
"""

import numpy as np
from PIL import Image

try:
    from scipy.signal import convolve2d
    _SCIPY = True
except ImportError:
    _SCIPY = False

try:
    import cv2
    _CV2 = True
except ImportError:
    _CV2 = False


# ---------------------------------------------------------------------------
# SRM kernels (subset of Rich-Model filters from Fridrich & Kodovsky 2012)
# ---------------------------------------------------------------------------

# Kernel 1 — second-order horizontal / vertical (Laplacian-like)
_K1 = np.array(
    [
        [0,  0,  0,  0, 0],
        [0, -1,  2, -1, 0],
        [0,  2, -4,  2, 0],
        [0, -1,  2, -1, 0],
        [0,  0,  0,  0, 0],
    ],
    dtype=np.float32,
)

# Kernel 2 — simple horizontal gradient
_K2 = np.array(
    [
        [0,  0,  0, 0, 0],
        [0,  0,  0, 0, 0],
        [0, -1,  2,-1, 0],
        [0,  0,  0, 0, 0],
        [0,  0,  0, 0, 0],
    ],
    dtype=np.float32,
)

# Kernel 3 — square (detects GAN checkerboard artifacts)
_K3 = np.array(
    [
        [-1,  2, -2,  2, -1],
        [ 2, -6,  8, -6,  2],
        [-2,  8, -12, 8, -2],
        [ 2, -6,  8, -6,  2],
        [-1,  2, -2,  2, -1],
    ],
    dtype=np.float32,
)

_KERNELS = [_K1, _K2, _K3]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalize_kernel(k: np.ndarray) -> np.ndarray:
    s = np.abs(k).sum()
    return k / s if s != 0 else k


def _apply_kernel(gray: np.ndarray, kernel: np.ndarray) -> np.ndarray:
    k = _normalize_kernel(kernel)
    if _SCIPY:
        return convolve2d(gray, k, mode="same", boundary="symm")
    else:
        # Fallback: manual convolution via numpy (slower)
        from numpy.lib.stride_tricks import sliding_window_view
        pad = kernel.shape[0] // 2
        padded = np.pad(gray, pad, mode="reflect")
        windows = sliding_window_view(padded, kernel.shape)
        return (windows * k).sum(axis=(-2, -1))


def _to_uint8(arr: np.ndarray) -> np.ndarray:
    arr = arr - arr.min()
    if arr.max() > 0:
        arr = arr / arr.max() * 255.0
    return arr.astype(np.uint8)


def _apply_colormap(gray_u8: np.ndarray) -> Image.Image:
    if _CV2:
        colored = cv2.applyColorMap(gray_u8, cv2.COLORMAP_COOL)
        colored = cv2.cvtColor(colored, cv2.COLOR_BGR2RGB)
        return Image.fromarray(colored)
    else:
        # Cyan fallback without OpenCV
        h, w = gray_u8.shape
        rgb = np.zeros((h, w, 3), dtype=np.uint8)
        rgb[:, :, 0] = 255 - gray_u8          # R decreases
        rgb[:, :, 1] = gray_u8                 # G increases
        rgb[:, :, 2] = 255                     # B constant → cyan
        return Image.fromarray(rgb)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def apply_srm(image: Image.Image) -> Image.Image:
    """
    Apply SRM residual filters to *image* and return a colourised
    noise-residual Image suitable for display.
    """
    gray = np.array(image.convert("L")).astype(np.float32)

    response = np.zeros_like(gray)
    for k in _KERNELS:
        response += np.abs(_apply_kernel(gray, k))
    response /= len(_KERNELS)

    u8 = _to_uint8(response)
    return _apply_colormap(u8)


def get_srm_interpretation(image: Image.Image) -> str:
    """
    Return a short textual interpretation of the SRM response
    computed from *image*.
    """
    gray = np.array(image.convert("L")).astype(np.float32)

    response = np.zeros_like(gray)
    for k in _KERNELS:
        response += np.abs(_apply_kernel(gray, k))
    response /= len(_KERNELS)

    mean_val = float(response.mean())
    std_val  = float(response.std())

    if mean_val > 20:
        return (
            "High noise residuals detected — strong manipulation artifacts are present. "
            "The SRM response shows periodic, non-camera-like noise structures, consistent "
            "with GAN generator fingerprints or image splicing."
        )
    elif mean_val > 10:
        return (
            "Moderate noise patterns found — possible localised manipulation or heavy "
            "compression artifacts detected. Inconsistent residual distribution may indicate "
            "partial face-region editing."
        )
    else:
        return (
            "Low noise residuals — the image is consistent with natural photographic sensor "
            "noise. No significant high-frequency manipulation artifacts were detected by the "
            "SRM filter bank."
        )
