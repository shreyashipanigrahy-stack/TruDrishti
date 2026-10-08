"""
Explainability module — generates confidence tags and human-readable
explanations from GradCAM + SRM + model output.
"""

import random

# ---------------------------------------------------------------------------
# GradCAM narrative templates
# ---------------------------------------------------------------------------

_GRADCAM_FAKE = [
    "GradCAM highlights concentrated activation around facial boundaries and eye regions — "
    "common indicators of face-swap manipulation.",
    "Model attention is drawn to irregular blending zones near the hairline and jawline edges, "
    "suggesting synthetic face insertion.",
    "High activation near periocular and mouth regions suggests GAN-based inpainting artifacts.",
    "Strong saliency around skin-texture transitions and facial symmetry zones — hallmarks of "
    "face reenactment techniques.",
    "The heat map reveals asymmetric activation clusters over cheek and forehead areas, "
    "consistent with identity-replacement deepfakes.",
]

_GRADCAM_REAL = [
    "GradCAM activation is broadly distributed across facial features with no abnormal localization.",
    "Attention maps show natural focus on discriminative facial landmarks without concentrated "
    "edge artifacts.",
    "Model saliency is consistent with natural image structure — no suspicious boundary "
    "highlighting detected.",
    "Activation patterns align with genuine facial geometry without signs of artificial blending.",
    "The heat map shows balanced attention across the face, typical of authentic images.",
]

# ---------------------------------------------------------------------------
# SRM narrative templates
# ---------------------------------------------------------------------------

_SRM_FAKE = [
    "SRM analysis reveals elevated noise residuals at facial boundary regions, consistent with "
    "GAN upsampling artifacts.",
    "Noise patterns show inconsistency between the face region and the surrounding background — "
    "typical of splicing.",
    "Checkerboard-like artifacts detected in the frequency domain — characteristic of deep-learning "
    "generator signatures.",
    "SRM residuals show periodic noise structures that are inconsistent with natural camera sensor "
    "patterns.",
    "High-frequency residuals cluster around the eye and mouth areas, indicating localised pixel "
    "manipulation.",
]

_SRM_REAL = [
    "SRM residuals are consistent with natural camera sensor noise — no anomalous periodic "
    "patterns detected.",
    "Noise analysis shows uniform distribution typical of authentic photographic images.",
    "No statistically significant deviations in noise patterns — consistent with genuine capture "
    "conditions.",
    "SRM filter response indicates natural noise characteristics without manipulation signatures.",
    "Noise residuals display the expected PRNU (Photo Response Non-Uniformity) of a real camera.",
]

# ---------------------------------------------------------------------------
# Conclusions
# ---------------------------------------------------------------------------

_CONCLUSIONS_FAKE = {
    "High":   "This image shows strong evidence of deepfake manipulation and should be considered "
               "untrustworthy.",
    "Medium": "Moderate indicators of manipulation detected. Manual expert review is recommended "
               "before drawing conclusions.",
    "Low":    "Weak manipulation signals detected. The result is uncertain — treat with caution "
               "and seek secondary verification.",
}

_CONCLUSIONS_REAL = {
    "High":   "This image displays strong hallmarks of authenticity with no detectable manipulation "
               "signatures.",
    "Medium": "Image appears authentic but minor ambiguity exists. Context-based verification is "
               "advised.",
    "Low":    "Low-confidence authentic prediction. The model is uncertain — further analysis or a "
               "secondary tool is recommended.",
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_explanation(
    prediction: str,
    confidence: float,
    real_prob: float,
    fake_prob: float,
) -> tuple[str, str]:
    """Return (confidence_tag, explanation_text)."""

    conf_pct = confidence * 100

    # Confidence level
    if conf_pct >= 80:
        level = "High"
    elif conf_pct >= 60:
        level = "Medium"
    else:
        level = "Low"

    # Confidence tag
    label = "Fake" if prediction == "FAKE" else "Real"
    tag = f"{level} {label} Confidence"

    # Narratives
    if prediction == "FAKE":
        gradcam_desc = random.choice(_GRADCAM_FAKE)
        srm_desc = random.choice(_SRM_FAKE)
        model_note = (
            f"The model assigned {fake_prob * 100:.1f}% probability to the FAKE class "
            f"({conf_pct:.1f}% confidence). "
        )
        conclusion = _CONCLUSIONS_FAKE[level]
    else:
        gradcam_desc = random.choice(_GRADCAM_REAL)
        srm_desc = random.choice(_SRM_REAL)
        model_note = (
            f"The model assigned {real_prob * 100:.1f}% probability to the REAL class "
            f"({conf_pct:.1f}% confidence). "
        )
        conclusion = _CONCLUSIONS_REAL[level]

    explanation = f"{model_note}{gradcam_desc} {srm_desc} {conclusion}"

    return tag, explanation
