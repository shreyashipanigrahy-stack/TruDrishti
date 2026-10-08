import os
import requests
import zipfile
import io
import time

BASE_URL = "http://localhost:8000"

def run_mlflow_tests():
    print("==================================================")
    print("Starting MLflow Integration Tests")
    print("==================================================")

    # 1. Login to obtain JWT Token
    print("\n[Test 1] Logging in as admin...")
    login_url = f"{BASE_URL}/auth/login"
    login_payload = {
        "email": "admin@trudrishti.com",
        "password": "admin123"
    }
    response = requests.post(login_url, json=login_payload)
    if response.status_code != 200:
        print(f"[ERROR] Login failed! Status: {response.status_code}, Body: {response.text}")
        return
    
    token = response.json().get("token")
    headers = {
        "Authorization": f"Bearer {token}"
    }
    print("[OK] Login successful.")

    # 2. Prepare mock ZIP containing baseline images
    print("\n[Test 2] Preparing ZIP file payload with fake and real folder subdirectories...")
    zip_filename = "test_mlflow_batch.zip"
    logo_path = "../frontend/src/assets/logo.jpg"
    if not os.path.exists(logo_path):
        img_bytes = b"mock_image_bytes"
    else:
        with open(logo_path, "rb") as f:
            img_bytes = f.read()

    with zipfile.ZipFile(zip_filename, "w") as z:
        # Evidently ClassificationPreset needs enough rows of both REAL and FAKE
        z.writestr("real/img1.jpg", img_bytes)
        z.writestr("real/img2.jpg", img_bytes)
        z.writestr("real/img3.jpg", img_bytes)
        z.writestr("real/img4.jpg", img_bytes)
        z.writestr("real/img5.jpg", img_bytes)
        z.writestr("fake/img6.jpg", img_bytes)
        z.writestr("fake/img7.jpg", img_bytes)
        z.writestr("fake/img8.jpg", img_bytes)
        z.writestr("fake/img9.jpg", img_bytes)
        z.writestr("fake/img10.jpg", img_bytes)

    print("[OK] ZIP file created with 10 images.")

    # 3. Test POST /batch-evaluate
    print("\n[Test 3] Calling POST /batch-evaluate...")
    with open(zip_filename, "rb") as f:
        files_payload = {
            "zip_file": (zip_filename, f, "application/zip")
        }
        eval_resp = requests.post(
            f"{BASE_URL}/batch-evaluate",
            headers=headers,
            files=files_payload
        )
    
    # Clean up local zip file
    if os.path.exists(zip_filename):
        os.remove(zip_filename)

    if eval_resp.status_code != 200:
        print(f"[ERROR] POST /batch-evaluate failed! Status: {eval_resp.status_code}, Body: {eval_resp.text}")
        return

    eval_json = eval_resp.json()
    batch_id = eval_json.get("batch_id")
    print(f"[OK] POST /batch-evaluate succeeded. Batch ID: {batch_id}")
    print(f"Metrics computed: {eval_json.get('metrics')}")
    assert batch_id is not None

    # Wait a moment for async thread logging to finish
    print("\nWaiting 3 seconds for async MLflow thread to finish writing run data...")
    time.sleep(3.0)

    # 4. Verify GET /mlflow/experiments
    print("\n[Test 4] Calling GET /mlflow/experiments...")
    exps_resp = requests.get(f"{BASE_URL}/mlflow/experiments", headers=headers)
    assert exps_resp.status_code == 200, f"Expected 200, got {exps_resp.status_code}"
    exps = exps_resp.json()
    print(f"[OK] Received experiments list: {exps}")
    assert len(exps) > 0
    found_exp = any(e["name"] == "TruDrishti Deepfake Detection" for e in exps)
    assert found_exp, "Could not find experiment 'TruDrishti Deepfake Detection'!"

    # 5. Verify GET /mlflow/runs
    print("\n[Test 5] Calling GET /mlflow/runs...")
    runs_resp = requests.get(f"{BASE_URL}/mlflow/runs", headers=headers)
    assert runs_resp.status_code == 200, f"Expected 200, got {runs_resp.status_code}"
    runs = runs_resp.json()
    print(f"[OK] Received runs count: {len(runs)}")
    assert len(runs) > 0
    
    # Check that our run is logged
    logged_run = None
    for r in runs:
        if r["params"].get("batch_id") == batch_id:
            logged_run = r
            break
            
    assert logged_run is not None, f"Expected to find logged run with batch_id = {batch_id}"
    print(f"[OK] Found logged run in MLflow:")
    print(f"  Run ID: {logged_run['run_id']}")
    print(f"  Metrics: {logged_run['metrics']}")
    print(f"  Parameters: {logged_run['params']}")
    print(f"  Tags: {logged_run['tags']}")
    
    # Verify exact metrics exist
    metrics = logged_run["metrics"]
    assert "accuracy" in metrics, "Missing accuracy metric"
    assert "precision" in metrics, "Missing precision metric"
    assert "recall" in metrics, "Missing recall metric"
    assert "f1_score" in metrics, "Missing f1_score metric"
    assert "roc_auc" in metrics, "Missing roc_auc metric"
    assert "total_images" in metrics, "Missing total_images metric"
    assert "false_positive_count" in metrics, "Missing false_positive_count metric"
    assert "false_negative_count" in metrics, "Missing false_negative_count metric"
    
    print("[OK] All required metrics verified in MLflow run data.")

    # 6. Verify GET /mlflow/best-run
    print("\n[Test 6] Calling GET /mlflow/best-run...")
    best_resp = requests.get(f"{BASE_URL}/mlflow/best-run", headers=headers)
    assert best_resp.status_code == 200, f"Expected 200, got {best_resp.status_code}"
    best = best_resp.json()
    print(f"[OK] Best run data: {best}")
    assert best is not None
    assert "run_id" in best
    assert "accuracy" in best["metrics"]

    print("\n==================================================")
    print("All MLflow Integration Tests Passed Successfully!")
    print("==================================================")

if __name__ == "__main__":
    run_mlflow_tests()
