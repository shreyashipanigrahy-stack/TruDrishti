"""
monitoring.py — Evidently AI Monitoring Router for TruDrishti
==============================================================
Mounts at /monitoring/* via FastAPI router.

Endpoints:
  GET /monitoring/summary      — lightweight dashboard JSON
  GET /monitoring/report       — full Evidently metrics as JSON
  GET /monitoring/report/html  — Evidently HTML report (embeddable)

Design constraints honoured:
  - Reads from PostgreSQL only (via existing get_db_session / DbInference)
  - Does NOT modify any existing API, model, or inference logic
  - Does NOT write anything to the database
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Optional, Any

import pandas as pd
import os
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from db import (
    get_db_session, DbInference, DbEvidentlyReport,
    get_evidently_report_metadata, list_evidently_reports_metadata,
    get_misclassified_images_by_batch, get_false_positives_by_batch, get_false_negatives_by_batch,
    get_misclassified_image_by_id
)
from auth import verify_jwt_token

log = logging.getLogger("deepfake-api.monitoring")

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

monitoring_router = APIRouter()

# ---------------------------------------------------------------------------
# Auth (reuse same pattern as main.py)
# ---------------------------------------------------------------------------

_security = HTTPBearer()


def _get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
) -> dict:
    token = credentials.credentials
    payload = verify_jwt_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token has expired or is invalid.")
    return payload


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Minimum rows required in each slice to run a meaningful Evidently report
_MIN_ROWS = 5


def _load_inferences_df(user_email: str) -> pd.DataFrame:
    """
    Query the inferences table for the given user and return a cleaned DataFrame.
    Columns: filename, prediction, confidence, real_prob, fake_prob,
             ground_truth (always None for now), batch_id, created_at
    """
    db = get_db_session()
    try:
        rows = (
            db.query(DbInference)
            .filter(DbInference.user_email == user_email)
            .order_by(DbInference.created_at.asc())
            .all()
        )
    finally:
        db.close()

    if not rows:
        return pd.DataFrame()

    records = []
    for r in rows:
        records.append(
            {
                "filename": r.filename or "",
                "prediction": r.prediction or "UNKNOWN",
                "confidence": float(r.confidence * 100) if r.confidence is not None else None,
                "real_probability": float(r.real_prob * 100) if r.real_prob is not None else None,
                "fake_probability": float(r.fake_prob * 100) if r.fake_prob is not None else None,
                "batch_id": r.batch_id,
                "created_at": r.created_at,
                # Evidently classification preset needs target + prediction columns
                # We use 'prediction' as a categorical distribution signal only
                "pred_numeric": 1 if r.prediction == "FAKE" else 0,
            }
        )

    df = pd.DataFrame(records)
    df["created_at"] = pd.to_datetime(df["created_at"], utc=True)
    return df


def _split_reference_current(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Split chronologically: oldest 50 % → reference, newest 50 % → current.
    If fewer than 2*MIN_ROWS rows, raise so caller can return a graceful error.
    """
    n = len(df)
    split = n // 2
    reference = df.iloc[:split].copy()
    current = df.iloc[split:].copy()
    return reference, current


def _safe_float(val: Any) -> Optional[float]:
    """Return a Python float or None — avoids NaN in JSON serialisation."""
    try:
        f = float(val)
        return None if (f != f) else round(f, 4)  # NaN check
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Evidently report builder
# ---------------------------------------------------------------------------

def _build_evidently_report(reference: pd.DataFrame, current: pd.DataFrame) -> tuple[dict, str]:
    """
    Build an Evidently Report and return (metrics_dict, html_string).
    Uses evidently 0.7.x via the evidently.legacy.* namespace.
    Falls back gracefully if Evidently is not importable.
    """
    try:
        from evidently.legacy.report import Report
        from evidently.legacy.metric_preset import DataDriftPreset, DataQualityPreset
        from evidently.legacy.metrics.data_drift.column_drift_metric import ColumnDriftMetric
        from evidently.legacy.metrics.data_drift.dataset_drift_metric import DatasetDriftMetric
    except ImportError:
        log.error("Evidently is not installed or incompatible. Run: pip install evidently>=0.4.30")
        raise HTTPException(
            status_code=503,
            detail="Evidently AI library is not installed on the server. "
                   "Run `pip install evidently>=0.4.30` in the backend virtual environment.",
        )

    # Select only numeric columns that Evidently can analyse
    numeric_cols = ["confidence", "real_probability", "fake_probability", "pred_numeric"]
    ref_ev = reference[numeric_cols].dropna()
    cur_ev = current[numeric_cols].dropna()

    report = Report(
        metrics=[
            DatasetDriftMetric(),
            DataQualityPreset(),
            ColumnDriftMetric(column_name="confidence"),
            ColumnDriftMetric(column_name="real_probability"),
            ColumnDriftMetric(column_name="fake_probability"),
            ColumnDriftMetric(column_name="pred_numeric"),
        ]
    )

    report.run(reference_data=ref_ev, current_data=cur_ev)

    # Extract JSON metrics
    report_dict: dict = json.loads(report.json())

    # Generate HTML
    html_str: str = report.get_html()

    return report_dict, html_str


# ---------------------------------------------------------------------------
# Parse Evidently output into a friendly summary
# ---------------------------------------------------------------------------

def _parse_summary(report_dict: dict, reference: pd.DataFrame, current: pd.DataFrame) -> dict:
    """Flatten Evidently metric results into a simple dashboard summary dict."""
    metrics = report_dict.get("metrics", [])

    dataset_drift_detected = False
    drifted_columns: list[str] = []
    column_drift: dict[str, bool] = {}

    for m in metrics:
        metric_id = m.get("metric", "")
        result = m.get("result", {})

        if metric_id == "DatasetDriftMetric":
            dataset_drift_detected = result.get("dataset_drift", False)
            drifted_columns = result.get("drift_by_columns", {})
            if isinstance(drifted_columns, dict):
                drifted_columns = [
                    col for col, info in drifted_columns.items()
                    if isinstance(info, dict) and info.get("drift_detected", False)
                ]

        if metric_id == "ColumnDriftMetric":
            col = result.get("column_name", "")
            col_drift = result.get("drift_detected", False)
            if col:
                column_drift[col] = col_drift

    # Prediction distribution
    fake_rate_ref = (reference["prediction"] == "FAKE").mean() if not reference.empty else None
    fake_rate_cur = (current["prediction"] == "FAKE").mean() if not current.empty else None

    avg_conf_ref = _safe_float(reference["confidence"].mean()) if "confidence" in reference else None
    avg_conf_cur = _safe_float(current["confidence"].mean()) if "confidence" in current else None

    avg_real_ref = _safe_float(reference["real_probability"].mean()) if "real_probability" in reference else None
    avg_real_cur = _safe_float(current["real_probability"].mean()) if "real_probability" in current else None

    # Alert level
    if dataset_drift_detected and len(drifted_columns) >= 2:
        alert_level = "critical"
    elif dataset_drift_detected:
        alert_level = "warning"
    else:
        alert_level = "ok"

    return {
        "total_inferences": len(reference) + len(current),
        "reference_size": len(reference),
        "current_size": len(current),
        "drift_detected": dataset_drift_detected,
        "drifted_columns": drifted_columns,
        "column_drift": column_drift,
        "fake_rate_reference": _safe_float(fake_rate_ref),
        "fake_rate_current": _safe_float(fake_rate_cur),
        "avg_confidence_reference": avg_conf_ref,
        "avg_confidence_current": avg_conf_cur,
        "avg_real_prob_reference": avg_real_ref,
        "avg_real_prob_current": avg_real_cur,
        "alert_level": alert_level,
        "last_report_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@monitoring_router.get("/summary", summary="Monitoring dashboard summary")
async def monitoring_summary(current_user: dict = Depends(_get_current_user)):
    """
    Returns a lightweight JSON summary for the monitoring dashboard:
    drift status, prediction distribution shift, confidence trends.
    Does NOT run a full Evidently report (fast).
    """
    email = current_user.get("sub")
    df = _load_inferences_df(email)

    if df.empty or len(df) < 2:
        return JSONResponse(
            {
                "total_inferences": len(df),
                "reference_size": 0,
                "current_size": 0,
                "drift_detected": False,
                "drifted_columns": [],
                "column_drift": {},
                "fake_rate_reference": None,
                "fake_rate_current": None,
                "avg_confidence_reference": None,
                "avg_confidence_current": None,
                "avg_real_prob_reference": None,
                "avg_real_prob_current": None,
                "alert_level": "insufficient_data",
                "last_report_at": datetime.now(timezone.utc).isoformat(),
                "message": "Not enough inference data to compute monitoring metrics. "
                           "Run at least a few detections first.",
            }
        )

    reference, current = _split_reference_current(df)

    if len(reference) < _MIN_ROWS or len(current) < _MIN_ROWS:
        return JSONResponse(
            {
                "total_inferences": len(df),
                "reference_size": len(reference),
                "current_size": len(current),
                "drift_detected": False,
                "drifted_columns": [],
                "column_drift": {},
                "fake_rate_reference": _safe_float((reference["prediction"] == "FAKE").mean()),
                "fake_rate_current": _safe_float((current["prediction"] == "FAKE").mean()),
                "avg_confidence_reference": _safe_float(reference["confidence"].mean()),
                "avg_confidence_current": _safe_float(current["confidence"].mean()),
                "avg_real_prob_reference": _safe_float(reference["real_probability"].mean()),
                "avg_real_prob_current": _safe_float(current["real_probability"].mean()),
                "alert_level": "insufficient_data",
                "last_report_at": datetime.now(timezone.utc).isoformat(),
                "message": f"Need at least {_MIN_ROWS * 2} inferences for drift analysis. "
                           f"Currently have {len(df)}.",
            }
        )

    try:
        report_dict, _ = _build_evidently_report(reference, current)
        summary = _parse_summary(report_dict, reference, current)
    except HTTPException:
        raise
    except Exception as exc:
        log.error(f"Evidently report build failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Monitoring report failed: {str(exc)}")

    return JSONResponse(summary)


@monitoring_router.get("/report", summary="Full Evidently monitoring metrics (JSON)")
async def monitoring_report(current_user: dict = Depends(_get_current_user)):
    """
    Runs a full Evidently Report and returns the raw metrics JSON.
    Use /monitoring/summary for the lighter dashboard view.
    """
    email = current_user.get("sub")
    df = _load_inferences_df(email)

    if len(df) < _MIN_ROWS * 2:
        raise HTTPException(
            status_code=422,
            detail=f"Not enough data for a full Evidently report. "
                   f"Need at least {_MIN_ROWS * 2} inferences, found {len(df)}.",
        )

    reference, current = _split_reference_current(df)

    try:
        report_dict, _ = _build_evidently_report(reference, current)
    except HTTPException:
        raise
    except Exception as exc:
        log.error(f"Evidently full report failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(exc)}")

    summary = _parse_summary(report_dict, reference, current)
    return JSONResponse({"summary": summary, "evidently_report": report_dict})


@monitoring_router.get(
    "/report/html",
    response_class=HTMLResponse,
    summary="Full Evidently monitoring report (HTML)",
)
async def monitoring_report_html(current_user: dict = Depends(_get_current_user)):
    """
    Generates a full Evidently HTML report and returns it as an HTML page.
    Suitable for embedding in an <iframe> on the frontend dashboard.
    """
    email = current_user.get("sub")
    df = _load_inferences_df(email)

    if len(df) < _MIN_ROWS * 2:
        return HTMLResponse(
            content=f"""
            <html><body style="font-family:sans-serif;padding:2rem;background:#050a14;color:#94a3b8;">
              <h2>Not enough data</h2>
              <p>Need at least {_MIN_ROWS * 2} inferences to generate an Evidently report.</p>
              <p>Currently: <strong style="color:#00b4e6">{len(df)}</strong> inference(s) found.</p>
            </body></html>
            """,
            status_code=200,
        )

    reference, current = _split_reference_current(df)

    try:
        _, html_str = _build_evidently_report(reference, current)
    except HTTPException as he:
        return HTMLResponse(
            content=f"""
            <html><body style="font-family:sans-serif;padding:2rem;background:#050a14;color:#94a3b8;">
              <h2>Error generating report</h2><p>{he.detail}</p>
            </body></html>
            """,
            status_code=200,
        )
    return HTMLResponse(content=html_str)


# ---------------------------------------------------------------------------
# Reports Router & Batch Report Retrieval
# ---------------------------------------------------------------------------

reports_router = APIRouter(tags=["Monitoring"])


def _load_batch_and_reference_df(user_email: str, batch_id: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Query inferences for the current user.
    - Current: Inferences with batch_id == target batch_id (or eval_{batch_id}).
    - Reference: Inferences with batch_id != target batch_id.
    """
    db = get_db_session()
    try:
        rows = (
            db.query(DbInference)
            .filter(DbInference.user_email == user_email)
            .order_by(DbInference.created_at.asc())
            .all()
        )
    finally:
        db.close()

    if not rows:
        return pd.DataFrame(), pd.DataFrame()

    # Determine matched batch ID with tolerance for missing eval_ prefix
    matched_batch_id = batch_id
    for r in rows:
        if r.batch_id == batch_id:
            matched_batch_id = batch_id
            break
        elif r.batch_id == f"eval_{batch_id}":
            matched_batch_id = f"eval_{batch_id}"
            break

    current_records = []
    reference_records = []

    for r in rows:
        record = {
            "filename": r.filename or "",
            "prediction": r.prediction or "UNKNOWN",
            "confidence": float(r.confidence * 100) if r.confidence is not None else None,
            "real_probability": float(r.real_prob * 100) if r.real_prob is not None else None,
            "fake_probability": float(r.fake_prob * 100) if r.fake_prob is not None else None,
            "batch_id": r.batch_id,
            "created_at": r.created_at,
            "pred_numeric": 1 if r.prediction == "FAKE" else 0,
        }
        if r.batch_id == matched_batch_id:
            current_records.append(record)
        else:
            reference_records.append(record)

    current_df = pd.DataFrame(current_records)
    reference_df = pd.DataFrame(reference_records)

    # Convert timestamps
    if not current_df.empty:
        current_df["created_at"] = pd.to_datetime(current_df["created_at"], utc=True)
    if not reference_df.empty:
        reference_df["created_at"] = pd.to_datetime(reference_df["created_at"], utc=True)

    # Graceful fallback: if reference is empty/too small, use history or split current
    if reference_df.empty or len(reference_df) < _MIN_ROWS:
        if len(current_df) >= _MIN_ROWS * 2:
            n = len(current_df)
            split = n // 2
            reference_df = current_df.iloc[:split].copy()
            current_df = current_df.iloc[split:].copy()

    return reference_df, current_df


@reports_router.get("/reports", summary="List Reports")
async def list_reports(current_user: dict = Depends(_get_current_user)):
    """
    List saved Evidently reports history.
    """
    db = get_db_session()
    try:
        results = list_evidently_reports_metadata(db)
        reports = []
        for r in results:
            reports.append({
                "batch_id": r.batch_id,
                "report_url": f"/reports/{r.batch_id}/download",
                "created_at": r.created_at.isoformat() if r.created_at else None
            })
        return JSONResponse(reports)
    finally:
        db.close()


@reports_router.get("/reports/{batch_id}", summary="Get Report Metadata")
async def get_report(batch_id: str, current_user: dict = Depends(_get_current_user)):
    """
    Get report metadata (batch_id, report_url, created_at) for a specific batch.
    """
    db = get_db_session()
    try:
        report = get_evidently_report_metadata(db, batch_id)
        if not report and not batch_id.startswith("eval_"):
            report = get_evidently_report_metadata(db, f"eval_{batch_id}")
            
        if not report:
            raise HTTPException(
                status_code=404,
                detail=f"Report for Batch ID '{batch_id}' not found."
            )
            
        return JSONResponse({
            "batch_id": report.batch_id,
            "report_url": f"/reports/{report.batch_id}/download",
            "created_at": report.created_at.isoformat() if report.created_at else None
        })
    finally:
        db.close()


@reports_router.get("/reports/{batch_id}/download", summary="Download Evidently HTML report")
async def download_report_html(batch_id: str):
    """
    Download the Evidently AI HTML report for a specific batch.
    Serves the static file saved on disk under reports/ folder.
    """
    db = get_db_session()
    try:
        report = get_evidently_report_metadata(db, batch_id)
        if not report and not batch_id.startswith("eval_"):
            report = get_evidently_report_metadata(db, f"eval_{batch_id}")
            
        if not report:
            raise HTTPException(
                status_code=404,
                detail=f"Report metadata for Batch ID '{batch_id}' not found."
            )
            
        report_path = report.report_path
        if not os.path.exists(report_path):
            alt_path = os.path.join(os.path.dirname(__file__), report_path)
            if os.path.exists(alt_path):
                report_path = alt_path
            else:
                raise HTTPException(
                    status_code=404,
                    detail=f"HTML report file not found on disk at path '{report.report_path}'."
                )
                
        return FileResponse(
            path=report_path,
            filename=f"batch_{report.batch_id}.html",
            media_type="text/html"
        )
    finally:
        db.close()


@reports_router.get("/reports/{batch_id}/preview", response_class=HTMLResponse, summary="Preview Evidently HTML report")
async def preview_report_html(batch_id: str):
    """
    Preview the Evidently AI HTML report for a specific batch in the browser / iframe.
    Does not trigger file download.
    """
    db = get_db_session()
    try:
        report = get_evidently_report_metadata(db, batch_id)
        if not report and not batch_id.startswith("eval_"):
            report = get_evidently_report_metadata(db, f"eval_{batch_id}")
            
        if not report:
            return HTMLResponse(
                content=f"""
                <html><body style="font-family:sans-serif;padding:2rem;background:#050a14;color:#94a3b8;">
                  <h2>Report not found</h2>
                  <p>Report metadata for Batch ID '{batch_id}' not found.</p>
                </body></html>
                """,
                status_code=404
            )
            
        report_path = report.report_path
        if not os.path.exists(report_path):
            alt_path = os.path.join(os.path.dirname(__file__), report_path)
            if os.path.exists(alt_path):
                report_path = alt_path
            else:
                return HTMLResponse(
                    content=f"""
                    <html><body style="font-family:sans-serif;padding:2rem;background:#050a14;color:#94a3b8;">
                      <h2>HTML File not found</h2>
                      <p>Report file is missing from disk.</p>
                    </body></html>
                    """,
                    status_code=404
                )
                
        with open(report_path, "r", encoding="utf-8") as f:
            html_content = f.read()
            
        return HTMLResponse(content=html_content)
    finally:
        db.close()


@reports_router.get("/batch/{batch_id}/misclassified", summary="Get Misclassified Images")
async def get_misclassified_images(batch_id: str, current_user: dict = Depends(_get_current_user)):
    """
    Get counts and details of all misclassified images for a specific batch.
    """
    db = get_db_session()
    try:
        matched_batch_id = batch_id
        fps = get_false_positives_by_batch(db, batch_id)
        fns = get_false_negatives_by_batch(db, batch_id)
        if not fps and not fns and not batch_id.startswith("eval_"):
            matched_batch_id = f"eval_{batch_id}"
            fps = get_false_positives_by_batch(db, matched_batch_id)
            fns = get_false_negatives_by_batch(db, matched_batch_id)
            
        all_imgs = fps + fns
        all_imgs.sort(key=lambda x: x.confidence or 0.0, reverse=True)
        
        images_json = []
        for img in all_imgs:
            image_url = f"/batch/{matched_batch_id}/image/{img.image_id}"
            images_json.append({
                "id": img.image_id,
                "image_id": img.image_id,
                "batch_id": img.batch_id,
                "timestamp": img.timestamp.isoformat() if img.timestamp else None,
                "filename": img.filename,
                "ground_truth": img.ground_truth,
                "prediction": img.prediction,
                "confidence": round(img.confidence, 4) if img.confidence is not None else 0.0,
                "error_type": img.error_type,
                "image_url": image_url,
                "download_url": image_url,
                "thumbnail_url": image_url
            })
            
        return JSONResponse({
            "false_positive_count": len(fps),
            "false_negative_count": len(fns),
            "total_misclassified": len(all_imgs),
            "images": images_json
        })
    finally:
        db.close()


@reports_router.get("/batch/{batch_id}/false-positives", summary="Get False Positive Images")
async def get_false_positives(batch_id: str, current_user: dict = Depends(_get_current_user)):
    """
    Get all false positive images for a specific batch.
    """
    db = get_db_session()
    try:
        matched_batch_id = batch_id
        fps = get_false_positives_by_batch(db, batch_id)
        if not fps and not batch_id.startswith("eval_"):
            matched_batch_id = f"eval_{batch_id}"
            fps = get_false_positives_by_batch(db, matched_batch_id)
            
        images_json = []
        for img in fps:
            image_url = f"/batch/{matched_batch_id}/image/{img.image_id}"
            images_json.append({
                "id": img.image_id,
                "image_id": img.image_id,
                "batch_id": img.batch_id,
                "timestamp": img.timestamp.isoformat() if img.timestamp else None,
                "filename": img.filename,
                "ground_truth": img.ground_truth,
                "prediction": img.prediction,
                "confidence": round(img.confidence, 4) if img.confidence is not None else 0.0,
                "error_type": img.error_type,
                "image_url": image_url,
                "download_url": image_url,
                "thumbnail_url": image_url
            })
            
        return JSONResponse(images_json)
    finally:
        db.close()


@reports_router.get("/batch/{batch_id}/false-negatives", summary="Get False Negative Images")
async def get_false_negatives(batch_id: str, current_user: dict = Depends(_get_current_user)):
    """
    Get all false negative images for a specific batch.
    """
    db = get_db_session()
    try:
        matched_batch_id = batch_id
        fns = get_false_negatives_by_batch(db, batch_id)
        if not fns and not batch_id.startswith("eval_"):
            matched_batch_id = f"eval_{batch_id}"
            fns = get_false_negatives_by_batch(db, matched_batch_id)
            
        images_json = []
        for img in fns:
            image_url = f"/batch/{matched_batch_id}/image/{img.image_id}"
            images_json.append({
                "id": img.image_id,
                "image_id": img.image_id,
                "batch_id": img.batch_id,
                "timestamp": img.timestamp.isoformat() if img.timestamp else None,
                "filename": img.filename,
                "ground_truth": img.ground_truth,
                "prediction": img.prediction,
                "confidence": round(img.confidence, 4) if img.confidence is not None else 0.0,
                "error_type": img.error_type,
                "image_url": image_url,
                "download_url": image_url,
                "thumbnail_url": image_url
            })
            
        return JSONResponse(images_json)
    finally:
        db.close()


@reports_router.get("/batch/{batch_id}/summary", summary="Get Evaluation Batch Summary")
@reports_router.get("/batch/{batch_id}/analytics", summary="Get Evaluation Batch Analytics")
async def get_batch_summary(batch_id: str, current_user: dict = Depends(_get_current_user)):
    """
    Get a summary of target batch including accuracy, FP/FN count, and hardest images.
    """
    db = get_db_session()
    try:
        matched_batch_id = batch_id
        rows = db.query(DbInference).filter(
            (DbInference.batch_id == batch_id) | (DbInference.batch_id == f"eval_{batch_id}")
        ).all()
        
        if not rows:
            raise HTTPException(
                status_code=404,
                detail=f"No inferences found for Batch ID '{batch_id}'."
            )
            
        if not batch_id.startswith("eval_") and rows[0].batch_id.startswith("eval_"):
            matched_batch_id = f"eval_{batch_id}"

        total = len(rows)
        eval_rows = [r for r in rows if r.ground_truth is not None]
        correct = sum(1 for r in eval_rows if r.prediction == r.ground_truth)
        
        accuracy_val = round((correct / len(eval_rows)) * 100.0, 1) if eval_rows else 0.0
        
        fps = get_false_positives_by_batch(db, matched_batch_id)
        fns = get_false_negatives_by_batch(db, matched_batch_id)
        
        all_misclassified = fps + fns
        all_misclassified.sort(key=lambda x: x.confidence or 0.0, reverse=True)
        
        hardest_images_json = []
        for img in all_misclassified:
            image_url = f"/batch/{matched_batch_id}/image/{img.image_id}"
            hardest_images_json.append({
                "id": img.image_id,
                "image_id": img.image_id,
                "batch_id": img.batch_id,
                "timestamp": img.timestamp.isoformat() if img.timestamp else None,
                "filename": img.filename,
                "ground_truth": img.ground_truth,
                "prediction": img.prediction,
                "confidence": round(img.confidence, 4) if img.confidence is not None else 0.0,
                "error_type": img.error_type,
                "image_url": image_url,
                "download_url": image_url,
                "thumbnail_url": image_url
            })
            
        return JSONResponse({
            "batch_id": batch_id,
            "accuracy": accuracy_val,
            "false_positive_count": len(fps),
            "false_negative_count": len(fns),
            "hardest_images": hardest_images_json
        })
    finally:
        db.close()


@reports_router.post("/batch/{batch_id}/export", summary="Export Retraining Dataset")
async def export_retraining(batch_id: str, current_user: dict = Depends(_get_current_user)):
    """
    Triggers export of misclassified images to retraining_dataset/ staging folder.
    """
    db = get_db_session()
    try:
        matched_batch_id = batch_id
        from db import get_misclassified_images_by_batch
        records = get_misclassified_images_by_batch(db, batch_id)
        if not records and not batch_id.startswith("eval_"):
            matched_batch_id = f"eval_{batch_id}"
            records = get_misclassified_images_by_batch(db, matched_batch_id)
            
        if not records:
            raise HTTPException(
                status_code=404,
                detail=f"No misclassified images found for Batch ID '{batch_id}' to export."
            )
            
        from error_analysis import export_retraining_dataset
        export_path = export_retraining_dataset(db, matched_batch_id)
        
        return JSONResponse({
            "status": "success",
            "message": f"Successfully exported retraining dataset for batch {batch_id}",
            "export_path": export_path,
            "exported_count": len(records)
        })
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Additional Advanced Error Analysis & Evidently Endpoints
# ---------------------------------------------------------------------------

@reports_router.get("/reports/{batch_id}/view", response_class=HTMLResponse, summary="View Evidently HTML report inline")
async def view_report_html(batch_id: str):
    """
    Renders the report HTML inline in the browser.
    """
    return await preview_report_html(batch_id)


@reports_router.get("/reports/{batch_id}/pdf", summary="Download Evidently report as PDF")
async def download_report_pdf(batch_id: str):
    """
    Generates Evidently PDF report using Playwright and downloads it.
    """
    db = get_db_session()
    try:
        report = get_evidently_report_metadata(db, batch_id)
        if not report and not batch_id.startswith("eval_"):
            report = get_evidently_report_metadata(db, f"eval_{batch_id}")
            
        if not report:
            raise HTTPException(
                status_code=404,
                detail=f"Report metadata for Batch ID '{batch_id}' not found."
            )
            
        report_path = report.report_path
        if not os.path.exists(report_path):
            alt_path = os.path.join(os.path.dirname(__file__), report_path)
            if os.path.exists(alt_path):
                report_path = alt_path
            else:
                raise HTTPException(
                    status_code=404,
                    detail=f"HTML report file not found on disk at path '{report.report_path}'."
                )
        
        # Define PDF path in the same directory as HTML report
        pdf_path = os.path.splitext(report_path)[0] + ".pdf"
        
        # Convert HTML to PDF using Playwright (cached if exists)
        if not os.path.exists(pdf_path):
            from pdf_utils import convert_html_to_pdf
            try:
                convert_html_to_pdf(report_path, pdf_path)
            except Exception as e:
                log.error(f"Failed to convert report to PDF: {e}", exc_info=True)
                raise HTTPException(
                    status_code=500,
                    detail=f"PDF conversion failed: {str(e)}"
                )
                
        if not os.path.exists(pdf_path):
            raise HTTPException(
                status_code=500,
                detail="PDF report file was not generated successfully."
            )
            
        return FileResponse(
            path=pdf_path,
            filename=f"report_{batch_id}.pdf",
            media_type="application/pdf"
        )
    finally:
        db.close()


@reports_router.get("/reports/{batch_id}/info", summary="Get Report Info")
async def get_report_info(batch_id: str):
    """
    Returns JSON status of HTML/PDF availability.
    """
    db = get_db_session()
    try:
        report = get_evidently_report_metadata(db, batch_id)
        if not report and not batch_id.startswith("eval_"):
            report = get_evidently_report_metadata(db, f"eval_{batch_id}")
            
        if not report:
            return JSONResponse({
                "batch_id": batch_id,
                "html_available": False,
                "pdf_available": False,
                "created_at": None
            })
            
        html_exists = os.path.exists(report.report_path) or os.path.exists(os.path.join(os.path.dirname(__file__), report.report_path))
        pdf_path = os.path.splitext(report.report_path)[0] + ".pdf"
        pdf_exists = os.path.exists(pdf_path) or os.path.exists(os.path.join(os.path.dirname(__file__), pdf_path))
        
        return JSONResponse({
            "batch_id": report.batch_id,
            "html_available": html_exists,
            "pdf_available": pdf_exists,
            "created_at": report.created_at.isoformat() if report.created_at else None
        })
    finally:
        db.close()


@reports_router.get("/batch/{batch_id}/image/{image_id}", summary="Get Raw Image file")
async def get_raw_image(batch_id: str, image_id: int):
    """
    Serves the actual image file inline using FileResponse.
    """
    db = get_db_session()
    try:
        img = get_misclassified_image_by_id(db, image_id)
        if not img:
            raise HTTPException(status_code=404, detail=f"Image record with ID {image_id} not found.")
            
        # Check if the image path exists
        if not img.image_path or not os.path.exists(img.image_path):
            raise HTTPException(status_code=404, detail=f"Image file not found on disk at {img.image_path}.")
            
        # Determine media type based on filename extension
        ext = os.path.splitext(img.filename)[1].lower()
        media_type = "image/jpeg"
        if ext in (".png", ".png"):
            media_type = "image/png"
        elif ext == ".webp":
            media_type = "image/webp"
        elif ext == ".bmp":
            media_type = "image/bmp"
            
        return FileResponse(path=img.image_path, media_type=media_type)
    finally:
        db.close()


@reports_router.get("/batch/{batch_id}/false-positives/download", summary="Download False Positive Images ZIP")
async def download_false_positives_zip(batch_id: str, current_user: dict = Depends(_get_current_user)):
    """
    Serves dynamic ZIP containing False Positive images.
    """
    db = get_db_session()
    try:
        matched_batch_id = batch_id
        fps = get_false_positives_by_batch(db, batch_id)
        if not fps and not batch_id.startswith("eval_"):
            matched_batch_id = f"eval_{batch_id}"
            fps = get_false_positives_by_batch(db, matched_batch_id)
            
        if not fps:
            raise HTTPException(status_code=404, detail=f"No False Positive images found for batch '{batch_id}'.")
            
        from error_analysis import generate_misclassified_zip
        zip_bytes = generate_misclassified_zip(fps, error_type_filter="FALSE_POSITIVE")
        
        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=false_positives_{batch_id}.zip"}
        )
    finally:
        db.close()


@reports_router.get("/batch/{batch_id}/false-negatives/download", summary="Download False Negative Images ZIP")
async def download_false_negatives_zip(batch_id: str, current_user: dict = Depends(_get_current_user)):
    """
    Serves dynamic ZIP containing False Negative images.
    """
    db = get_db_session()
    try:
        matched_batch_id = batch_id
        fns = get_false_negatives_by_batch(db, batch_id)
        if not fns and not batch_id.startswith("eval_"):
            matched_batch_id = f"eval_{batch_id}"
            fns = get_false_negatives_by_batch(db, matched_batch_id)
            
        if not fns:
            raise HTTPException(status_code=404, detail=f"No False Negative images found for batch '{batch_id}'.")
            
        from error_analysis import generate_misclassified_zip
        zip_bytes = generate_misclassified_zip(fns, error_type_filter="FALSE_NEGATIVE")
        
        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=false_negatives_{batch_id}.zip"}
        )
    finally:
        db.close()


@reports_router.get("/batch/{batch_id}/misclassified/download", summary="Download All Misclassified Images ZIP")
async def download_misclassified_zip(batch_id: str, current_user: dict = Depends(_get_current_user)):
    """
    Serves dynamic ZIP containing all misclassified images (FP + FN).
    """
    db = get_db_session()
    try:
        matched_batch_id = batch_id
        fps = get_false_positives_by_batch(db, batch_id)
        fns = get_false_negatives_by_batch(db, batch_id)
        if not fps and not fns and not batch_id.startswith("eval_"):
            matched_batch_id = f"eval_{batch_id}"
            fps = get_false_positives_by_batch(db, matched_batch_id)
            fns = get_false_negatives_by_batch(db, matched_batch_id)
            
        all_imgs = fps + fns
        if not all_imgs:
            raise HTTPException(status_code=404, detail=f"No misclassified images found for batch '{batch_id}'.")
            
        from error_analysis import generate_misclassified_zip
        zip_bytes = generate_misclassified_zip(all_imgs)
        
        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=misclassified_{batch_id}.zip"}
        )
    finally:
        db.close()


@reports_router.get("/batch/{batch_id}/gallery", response_class=HTMLResponse, summary="View HTML Error Gallery")
async def get_error_gallery(batch_id: str):
    """
    Serves the HTML gallery page.
    """
    db = get_db_session()
    try:
        matched_batch_id = batch_id
        fps = get_false_positives_by_batch(db, batch_id)
        fns = get_false_negatives_by_batch(db, batch_id)
        if not fps and not fns and not batch_id.startswith("eval_"):
            matched_batch_id = f"eval_{batch_id}"
            fps = get_false_positives_by_batch(db, matched_batch_id)
            fns = get_false_negatives_by_batch(db, matched_batch_id)
            
        from error_analysis import generate_gallery_html
        html_content = generate_gallery_html(matched_batch_id, fps, fns)
        return HTMLResponse(content=html_content)
    finally:
        db.close()


@reports_router.post("/batch/{batch_id}/retraining-export", summary="Export Retraining Dataset to Disk")
async def export_retraining_dataset_endpoint(batch_id: str, current_user: dict = Depends(_get_current_user)):
    """
    Triggers export of misclassified images to retraining_dataset/ staging folder on disk.
    """
    return await export_retraining(batch_id, current_user)


@reports_router.get("/batch/{batch_id}/retraining-export/download", summary="Download Retraining Dataset ZIP")
async def download_retraining_dataset_zip(batch_id: str, current_user: dict = Depends(_get_current_user)):
    """
    Compiles the retraining dataset into a ZIP file and downloads it.
    """
    db = get_db_session()
    try:
        matched_batch_id = batch_id
        from db import get_misclassified_images_by_batch
        records = get_misclassified_images_by_batch(db, batch_id)
        if not records and not batch_id.startswith("eval_"):
            matched_batch_id = f"eval_{batch_id}"
            records = get_misclassified_images_by_batch(db, matched_batch_id)
            
        if not records:
            raise HTTPException(
                status_code=404,
                detail=f"No misclassified images found for Batch ID '{batch_id}' to export."
            )
            
        from error_analysis import generate_retraining_dataset_zip
        zip_bytes = generate_retraining_dataset_zip(records)
        
        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=retraining_dataset_{batch_id}.zip"}
        )
    finally:
        db.close()

