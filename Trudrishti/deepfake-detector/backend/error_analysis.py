import os
import zipfile
import io
import csv
import shutil
from datetime import datetime
from sqlalchemy.orm import Session
from db import create_misclassified_image

ERROR_ANALYSIS_DIR = "error_analysis"
RETRAINING_DIR = "retraining_dataset"

def process_error_analysis(
    db: Session,
    batch_id: str,
    predictions: list,
    zip_file_bytes: bytes,
    timestamp_str: str = None
):
    """
    Examines bulk predictions, extracts misclassified files (FPs and FNs)
    from ZIP binary payload, writes them to organized disk subdirectories,
    logs metadata records to the database, and compiles a CSV report.
    """
    # Create target directories
    batch_dir = os.path.join(ERROR_ANALYSIS_DIR, f"batch_{batch_id}")
    fp_dir = os.path.join(batch_dir, "false_positive")
    fn_dir = os.path.join(batch_dir, "false_negative")
    reports_dir = os.path.join(batch_dir, "reports")

    os.makedirs(fp_dir, exist_ok=True)
    os.makedirs(fn_dir, exist_ok=True)
    os.makedirs(reports_dir, exist_ok=True)

    try:
        z = zipfile.ZipFile(io.BytesIO(zip_file_bytes))
    except Exception as exc:
        print(f"[Error Analysis] Failed to parse zip bytes: {exc}")
        return

    misclassified_list = []
    ts = None
    if timestamp_str:
        try:
            ts = datetime.fromisoformat(timestamp_str)
        except ValueError:
            pass
    if not ts:
        ts = datetime.utcnow()

    for item in predictions:
        is_dict = isinstance(item, dict)
        status = item.get("status") if is_dict else getattr(item, "status", None)
        if status != "success":
            continue

        filename = item.get("filename") if is_dict else getattr(item, "filename", None)
        gt = item.get("ground_truth") if is_dict else getattr(item, "ground_truth", None)
        pred = item.get("prediction") if is_dict else getattr(item, "prediction", None)
        conf = item.get("confidence") if is_dict else getattr(item, "confidence", 0.0)

        if not gt or not pred:
            continue

        gt_upper = gt.upper()
        pred_upper = pred.upper()

        if gt_upper in ("REAL", "FAKE") and pred_upper in ("REAL", "FAKE") and gt_upper != pred_upper:
            # Detect False Positive / False Negative
            # FP = Ground Truth REAL, Predicted FAKE
            # FN = Ground Truth FAKE, Predicted REAL
            if gt_upper == "REAL" and pred_upper == "FAKE":
                err_type = "FALSE_POSITIVE"
            elif gt_upper == "FAKE" and pred_upper == "REAL":
                err_type = "FALSE_NEGATIVE"
            else:
                continue

            try:
                # Extract original image bytes
                img_bytes = z.read(filename)
                target_folder = fp_dir if err_type == "FALSE_POSITIVE" else fn_dir
                target_filename = os.path.basename(filename)
                target_path = os.path.join(target_folder, target_filename)

                with open(target_path, "wb") as img_file:
                    img_file.write(img_bytes)

                # Persist to database
                # In db.py, confidence is stored as float between 0 and 1,
                # but predictions has round(conf*100, 2). Let's convert back to 0-1 scale.
                confidence_val = float(conf)
                if confidence_val > 1.0:
                    confidence_val = confidence_val / 100.0

                abs_path = os.path.abspath(target_path)
                create_misclassified_image(
                    db=db,
                    batch_id=batch_id,
                    filename=filename,
                    image_path=abs_path,
                    ground_truth=gt_upper,
                    prediction=pred_upper,
                    confidence=confidence_val,
                    error_type=err_type,
                    timestamp=ts
                )

                misclassified_list.append({
                    "batch_id": batch_id,
                    "timestamp": ts.isoformat(),
                    "filename": filename,
                    "ground_truth": gt_upper,
                    "prediction": pred_upper,
                    "confidence": round(confidence_val, 4),
                    "error_type": err_type
                })
            except Exception as err:
                print(f"[Error Analysis] Failed to process file {filename}: {err}")

    # Write CSV report
    csv_path = os.path.join(reports_dir, "misclassified_images.csv")
    try:
        with open(csv_path, "w", newline="", encoding="utf-8") as csv_file:
            fieldnames = ["batch_id", "timestamp", "filename", "ground_truth", "prediction", "confidence", "error_type"]
            writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
            writer.writeheader()
            for row in misclassified_list:
                writer.writerow(row)
    except Exception as csv_err:
        print(f"[Error Analysis] Failed to write CSV report: {csv_err}")


def export_retraining_dataset(db: Session, batch_id: str) -> str:
    """
    Exports all misclassified files of a target batch into the retraining_dataset/ staging folder
    and updates/creates retraining_dataset/metadata.csv listing all exported images.
    """
    fp_export_dir = os.path.join(RETRAINING_DIR, "false_positive")
    fn_export_dir = os.path.join(RETRAINING_DIR, "false_negative")
    os.makedirs(fp_export_dir, exist_ok=True)
    os.makedirs(fn_export_dir, exist_ok=True)

    from db import get_misclassified_images_by_batch
    records = get_misclassified_images_by_batch(db, batch_id)

    batch_dir = os.path.join(ERROR_ANALYSIS_DIR, f"batch_{batch_id}")
    export_metadata = []

    for r in records:
        source_folder = "false_positive" if r.error_type == "FALSE_POSITIVE" else "false_negative"
        dest_folder = fp_export_dir if r.error_type == "FALSE_POSITIVE" else fn_export_dir

        r_basename = os.path.basename(r.filename)
        source_path = os.path.join(batch_dir, source_folder, r_basename)
        dest_path = os.path.join(dest_folder, r_basename)

        if os.path.exists(source_path):
            shutil.copy2(source_path, dest_path)

        export_metadata.append({
            "batch_id": r.batch_id,
            "timestamp": r.timestamp.isoformat() if r.timestamp else "",
            "filename": r.filename,  # Keep the original full relative path
            "ground_truth": r.ground_truth,
            "prediction": r.prediction,
            "confidence": round(r.confidence, 4) if r.confidence is not None else 0.0,
            "error_type": r.error_type
        })

    metadata_csv_path = os.path.join(RETRAINING_DIR, "metadata.csv")
    file_exists = os.path.exists(metadata_csv_path)

    try:
        with open(metadata_csv_path, "a" if file_exists else "w", newline="", encoding="utf-8") as csv_file:
            fieldnames = ["batch_id", "timestamp", "filename", "ground_truth", "prediction", "confidence", "error_type"]
            writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
            if not file_exists:
                writer.writeheader()
            for row in export_metadata:
                writer.writerow(row)
    except Exception as csv_err:
        print(f"[Error Analysis] Failed to write retraining dataset metadata CSV: {csv_err}")

    return RETRAINING_DIR


def generate_misclassified_zip(records, error_type_filter=None) -> bytes:
    """
    Compresses misclassified images of the target batch into a ZIP archive in memory.
    """
    if error_type_filter:
        records = [r for r in records if r.error_type == error_type_filter]
        
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for r in records:
            if r.image_path and os.path.exists(r.image_path):
                subfolder = "false_positive" if r.error_type == "FALSE_POSITIVE" else "false_negative"
                zf.write(r.image_path, arcname=f"{subfolder}/{os.path.basename(r.filename)}")
    return zip_buffer.getvalue()


def generate_retraining_dataset_zip(records) -> bytes:
    """
    Packages compiled retraining dataset into a ZIP file in memory containing
    images and a metadata.csv conforming to required columns.
    """
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        csv_buffer = io.StringIO()
        fieldnames = ["filename", "ground_truth", "prediction", "confidence", "error_type", "batch_id"]
        writer = csv.DictWriter(csv_buffer, fieldnames=fieldnames)
        writer.writeheader()
        
        for r in records:
            if r.image_path and os.path.exists(r.image_path):
                subfolder = "false_positive" if r.error_type == "FALSE_POSITIVE" else "false_negative"
                arcname = f"{subfolder}/{os.path.basename(r.filename)}"
                zf.write(r.image_path, arcname=arcname)
                
                writer.writerow({
                    "filename": r.filename,  # Original path
                    "ground_truth": r.ground_truth,
                    "prediction": r.prediction,
                    "confidence": round(r.confidence, 4) if r.confidence is not None else 0.0,
                    "error_type": r.error_type,
                    "batch_id": r.batch_id
                })
                
        zf.writestr("metadata.csv", csv_buffer.getvalue())
    return zip_buffer.getvalue()


def generate_gallery_html(batch_id: str, false_positives: list, false_negatives: list) -> str:
    # Build FP card HTML
    fp_cards = ""
    for img in false_positives:
        confidence_pct = round((img.confidence or 0.0) * 100, 1)
        fp_basename = os.path.basename(img.filename)
        fp_cards += f"""
        <div class="card">
            <div class="card-image-container">
                <img src="/batch/{batch_id}/image/{img.image_id}" alt="{fp_basename}" loading="lazy"/>
                <div class="error-badge fp">False Positive</div>
            </div>
            <div class="card-body">
                <div class="filename" title="{img.filename}">{fp_basename}</div>
                <div class="metrics-grid">
                    <div>
                        <span class="metric-label">Ground Truth</span>
                        <span class="metric-val gt-real">{img.ground_truth}</span>
                    </div>
                    <div>
                        <span class="metric-label">Prediction</span>
                        <span class="metric-val pred-fake">{img.prediction}</span>
                    </div>
                </div>
                <div class="confidence-section">
                    <div class="confidence-header">
                        <span>Confidence</span>
                        <span class="confidence-value">{confidence_pct}%</span>
                    </div>
                    <div class="confidence-bar-bg">
                        <div class="confidence-bar-fill" style="width: {confidence_pct}%"></div>
                    </div>
                </div>
                <a href="/batch/{batch_id}/image/{img.image_id}" download class="card-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                      <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                    </svg>
                    Download Image
                </a>
            </div>
        </div>
        """

    # Build FN card HTML
    fn_cards = ""
    for img in false_negatives:
        confidence_pct = round((img.confidence or 0.0) * 100, 1)
        fn_basename = os.path.basename(img.filename)
        fn_cards += f"""
        <div class="card">
            <div class="card-image-container">
                <img src="/batch/{batch_id}/image/{img.image_id}" alt="{fn_basename}" loading="lazy"/>
                <div class="error-badge fn">False Negative</div>
            </div>
            <div class="card-body">
                <div class="filename" title="{img.filename}">{fn_basename}</div>
                <div class="metrics-grid">
                    <div>
                        <span class="metric-label">Ground Truth</span>
                        <span class="metric-val gt-fake">{img.ground_truth}</span>
                    </div>
                    <div>
                        <span class="metric-label">Prediction</span>
                        <span class="metric-val pred-real">{img.prediction}</span>
                    </div>
                </div>
                <div class="confidence-section">
                    <div class="confidence-header">
                        <span>Confidence</span>
                        <span class="confidence-value">{confidence_pct}%</span>
                    </div>
                    <div class="confidence-bar-bg">
                        <div class="confidence-bar-fill" style="width: {confidence_pct}%"></div>
                    </div>
                </div>
                <a href="/batch/{batch_id}/image/{img.image_id}" download class="card-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                      <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                    </svg>
                    Download Image
                </a>
            </div>
        </div>
        """

    total_errors = len(false_positives) + len(false_negatives)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TruDrishti Error Gallery — Batch {batch_id}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {{
            --bg-color: #030712;
            --card-bg: rgba(17, 24, 39, 0.7);
            --card-border: rgba(255, 255, 255, 0.08);
            --text-primary: #f3f4f6;
            --text-secondary: #9ca3af;
            --fp-color: #ef4444;
            --fn-color: #ec4899;
            --real-color: #10b981;
            --accent-glow: rgba(59, 130, 246, 0.5);
            --font-outfit: 'Outfit', sans-serif;
            --font-inter: 'Inter', sans-serif;
        }}
        
        * {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}
        
        body {{
            background-color: var(--bg-color);
            background-image: 
                radial-gradient(at 0% 0%, rgba(31, 41, 55, 0.5) 0px, transparent 50%),
                radial-gradient(at 100% 100%, rgba(17, 24, 39, 0.8) 0px, transparent 50%),
                radial-gradient(at 50% 0%, rgba(29, 78, 216, 0.15) 0px, transparent 50%);
            color: var(--text-primary);
            font-family: var(--font-inter);
            min-height: 100vh;
            padding-bottom: 5rem;
        }}

        header {{
            position: sticky;
            top: 0;
            z-index: 100;
            background: rgba(3, 7, 18, 0.7);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--card-border);
            padding: 1.25rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}

        .brand {{
            font-family: var(--font-outfit);
            font-weight: 800;
            font-size: 1.5rem;
            background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }}

        .batch-badge {{
            background: rgba(59, 130, 246, 0.1);
            border: 1px solid rgba(59, 130, 246, 0.3);
            color: #60a5fa;
            font-size: 0.85rem;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-family: var(--font-outfit);
            font-weight: 500;
        }}

        .actions {{
            display: flex;
            gap: 1rem;
        }}

        .btn {{
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            font-family: var(--font-outfit);
            font-weight: 500;
            font-size: 0.9rem;
            text-decoration: none;
            cursor: pointer;
            transition: all 0.2s ease;
        }}

        .btn-primary {{
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white;
            border: none;
            box-shadow: 0 4px 12px rgba(29, 78, 216, 0.3);
        }}

        .btn-primary:hover {{
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(29, 78, 216, 0.4);
        }}

        .btn-secondary {{
            background: rgba(255, 255, 255, 0.05);
            color: var(--text-primary);
            border: 1px solid var(--card-border);
        }}

        .btn-secondary:hover {{
            background: rgba(255, 255, 255, 0.1);
        }}

        .container {{
            max-width: 1400px;
            margin: 0 auto;
            padding: 2.5rem 2rem;
        }}

        .overview-panel {{
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 12px;
            padding: 1.5rem 2rem;
            margin-bottom: 3rem;
            display: flex;
            justify-content: space-around;
            text-align: center;
            backdrop-filter: blur(8px);
        }}

        .stat-item {{
            padding: 0.5rem 1rem;
        }}

        .stat-item .val {{
            font-family: var(--font-outfit);
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 0.25rem;
        }}

        .stat-item .label {{
            color: var(--text-secondary);
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}

        .stat-item.fp-stat .val {{ color: var(--fp-color); }}
        .stat-item.fn-stat .val {{ color: var(--fn-color); }}
        .stat-item.total-stat .val {{ color: #60a5fa; }}

        .section-title {{
            font-family: var(--font-outfit);
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 1.5rem;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            border-left: 4px solid transparent;
            padding-left: 0.75rem;
        }}

        .fp-section-title {{
            border-left-color: var(--fp-color);
        }}

        .fn-section-title {{
            border-left-color: var(--fn-color);
        }}

        .section-count {{
            font-size: 0.9rem;
            padding: 0.1rem 0.5rem;
            border-radius: 9999px;
            font-weight: 600;
        }}

        .fp-section-title .section-count {{
            background: rgba(239, 68, 68, 0.1);
            color: var(--fp-color);
            border: 1px solid rgba(239, 68, 68, 0.2);
        }}

        .fn-section-title .section-count {{
            background: rgba(236, 72, 153, 0.1);
            color: var(--fn-color);
            border: 1px solid rgba(236, 72, 153, 0.2);
        }}

        .grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 2rem;
            margin-bottom: 4rem;
        }}

        .card {{
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 12px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(4px);
        }}

        .card:hover {{
            transform: translateY(-8px);
            border-color: rgba(59, 130, 246, 0.4);
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(59, 130, 246, 0.15);
        }}

        .card-image-container {{
            position: relative;
            width: 100%;
            height: 220px;
            background: #111827;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }}

        .card-image-container img {{
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.5s ease;
        }}

        .card:hover .card-image-container img {{
            transform: scale(1.05);
        }}

        .error-badge {{
            position: absolute;
            top: 0.75rem;
            right: 0.75rem;
            padding: 0.25rem 0.6rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 600;
            font-family: var(--font-outfit);
            text-transform: uppercase;
        }}

        .error-badge.fp {{
            background: rgba(239, 68, 68, 0.9);
            color: white;
            box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
        }}

        .error-badge.fn {{
            background: rgba(236, 72, 153, 0.9);
            color: white;
            box-shadow: 0 2px 8px rgba(236, 72, 153, 0.4);
        }}

        .card-body {{
            padding: 1.25rem;
            display: flex;
            flex-direction: column;
            flex-grow: 1;
        }}

        .filename {{
            font-family: var(--font-outfit);
            font-weight: 600;
            font-size: 1rem;
            margin-bottom: 1rem;
            color: var(--text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }}

        .metrics-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
            margin-bottom: 1.25rem;
            background: rgba(255, 255, 255, 0.02);
            padding: 0.75rem;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.04);
        }}

        .metric-label {{
            display: block;
            font-size: 0.75rem;
            color: var(--text-secondary);
            margin-bottom: 0.25rem;
        }}

        .metric-val {{
            font-weight: 700;
            font-size: 0.9rem;
            font-family: var(--font-outfit);
        }}

        .metric-val.gt-real {{ color: var(--real-color); }}
        .metric-val.gt-fake {{ color: var(--fp-color); }}
        .metric-val.pred-real {{ color: var(--real-color); }}
        .metric-val.pred-fake {{ color: var(--fp-color); }}

        .confidence-section {{
            margin-bottom: 1.5rem;
        }}

        .confidence-header {{
            display: flex;
            justify-content: space-between;
            font-size: 0.8rem;
            color: var(--text-secondary);
            margin-bottom: 0.35rem;
        }}

        .confidence-value {{
            font-weight: 600;
            color: var(--text-primary);
        }}

        .confidence-bar-bg {{
            width: 100%;
            height: 6px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 9999px;
            overflow: hidden;
        }}

        .confidence-bar-fill {{
            height: 100%;
            background: linear-gradient(90deg, #3b82f6, #60a5fa);
            border-radius: 9999px;
        }}

        .card-btn {{
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            width: 100%;
            padding: 0.6rem;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--card-border);
            border-radius: 6px;
            color: var(--text-primary);
            text-decoration: none;
            font-size: 0.85rem;
            font-weight: 500;
            font-family: var(--font-outfit);
            transition: all 0.2s ease;
            margin-top: auto;
        }}

        .card-btn:hover {{
            background: #3b82f6;
            color: white;
            border-color: #3b82f6;
        }}

        .empty-state {{
            grid-column: 1 / -1;
            text-align: center;
            padding: 4rem 2rem;
            background: var(--card-bg);
            border: 1px dashed var(--card-border);
            border-radius: 12px;
            color: var(--text-secondary);
        }}
    </style>
</head>
<body>
    <header>
        <div class="brand">
            TruDrishti <span class="batch-badge">Batch {batch_id}</span>
        </div>
        <div class="actions">
            <a href="/batch/{batch_id}/misclassified/download" class="btn btn-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                  <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                </svg>
                Download All Errors (ZIP)
            </a>
            <a href="/reports/{batch_id}/preview" class="btn btn-secondary">
                View Evidently Report
            </a>
        </div>
    </header>

    <div class="container">
        <div class="overview-panel">
            <div class="stat-item total-stat">
                <div class="val">{total_errors}</div>
                <div class="label">Total Misclassified</div>
            </div>
            <div class="stat-item fp-stat">
                <div class="val">{len(false_positives)}</div>
                <div class="label">False Positives</div>
            </div>
            <div class="stat-item fn-stat">
                <div class="val">{len(false_negatives)}</div>
                <div class="label">False Negatives</div>
            </div>
        </div>

        <h2 class="section-title fp-section-title">
            False Positives <span class="section-count">{len(false_positives)}</span>
        </h2>
        <div class="grid">
            {fp_cards if false_positives else '<div class="empty-state">No False Positives detected in this batch.</div>'}
        </div>

        <h2 class="section-title fn-section-title">
            False Negatives <span class="section-count">{len(false_negatives)}</span>
        </h2>
        <div class="grid">
            {fn_cards if false_negatives else '<div class="empty-state">No False Negatives detected in this batch.</div>'}
        </div>
    </div>
</body>
</html>
"""
    return html
