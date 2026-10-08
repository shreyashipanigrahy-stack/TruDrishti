import os
import time
import requests
import zipfile
import io

BASE_URL = "http://localhost:8000"
IMAGE_PATH = "../frontend/src/assets/logo.jpg"  # Path relative to backend folder

def run_evaluation_tests():
    print("==================================================")
    print("Starting Model Evaluation API Tests")
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
    if not token:
        print("[ERROR] Login succeeded but no token returned!")
        return
    print("[OK] Login successful.")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }

    # 2. Test GET /model-metrics
    print("\n[Test 2] Testing GET /model-metrics...")
    metrics_resp = requests.get(f"{BASE_URL}/model-metrics", headers=headers)
    if metrics_resp.status_code != 200:
        print(f"[ERROR] GET /model-metrics failed! Status: {metrics_resp.status_code}, Body: {metrics_resp.text}")
        return
    
    metrics_res = metrics_resp.json()
    print("[OK] GET /model-metrics succeeded.")
    print("Response payload:")
    print(metrics_res)
    
    # Assert model metrics format
    assert metrics_res["model_name"] == "EfficientNet-B4 + SRM"
    assert "accuracy" in metrics_res
    assert "confusion_matrix" in metrics_res
    assert "tp" in metrics_res["confusion_matrix"]
    print("[OK] Checked model metrics schema successfully.")

    # Verify if baseline test image exists
    if not os.path.exists(IMAGE_PATH):
        print(f"[ERROR] Test image not found at {IMAGE_PATH}! Cannot run POST /evaluate-bulk tests.")
        return

    # 3. Create test ZIP and CSV files
    print("\n[Test 3] Creating temporary zip and csv files...")
    
    # Read image bytes
    with open(IMAGE_PATH, "rb") as f:
        img_bytes = f.read()

    # Create ZIP in memory/file
    zip_filename = "temp_test_eval.zip"
    with zipfile.ZipFile(zip_filename, "w") as z:
        z.writestr("img1.jpg", img_bytes)
        z.writestr("img2.jpg", img_bytes)
        z.writestr("img3.jpg", img_bytes)
        z.writestr("img4.jpg", img_bytes)  # Unlabeled image
        
    # Create CSV
    csv_filename = "temp_test_eval.csv"
    csv_content = (
        "image,label\n"
        "img1.jpg,REAL\n"
        "img2.jpg,FAKE\n"
        "img3.jpg,REAL\n"
    )
    with open(csv_filename, "w", encoding="utf-8") as f:
        f.write(csv_content)

    print(f"[OK] Temporary ZIP and CSV created. ZIP contains 4 files. CSV contains labels for 3 files.")

    # 4. Test POST /evaluate-bulk
    print("\n[Test 4] Testing POST /evaluate-bulk...")
    
    f_zip = open(zip_filename, "rb")
    f_csv = open(csv_filename, "rb")
    
    files_payload = {
        "zip_file": (zip_filename, f_zip, "application/zip"),
        "csv_file": (csv_filename, f_csv, "text/csv")
    }
    
    start_time = time.time()
    eval_resp = requests.post(f"{BASE_URL}/evaluate-bulk", headers=headers, files=files_payload)
    duration = time.time() - start_time
    
    f_zip.close()
    f_csv.close()
    
    # Clean up files
    if os.path.exists(zip_filename):
        os.remove(zip_filename)
    if os.path.exists(csv_filename):
        os.remove(csv_filename)

    if eval_resp.status_code != 200:
        print(f"[ERROR] POST /evaluate-bulk failed! Status: {eval_resp.status_code}, Body: {eval_resp.text}")
        return
        
    eval_res = eval_resp.json()
    print(f"[OK] POST /evaluate-bulk succeeded in {duration:.2f} seconds.")
    print("Aggregate Metrics:")
    print(eval_res.get("metrics"))
    print("\nIndividual Predictions:")
    for pred in eval_res.get("predictions", []):
        print(f"  - {pred['filename']}: prediction={pred['prediction']}, ground_truth={pred['ground_truth']}, status={pred['status']}")

    # Validation assertions
    predictions = eval_res.get("predictions", [])
    metrics = eval_res.get("metrics")
    
    assert len(predictions) == 4, f"Expected 4 predictions, got {len(predictions)}"
    
    # Check that img4.jpg is unlabeled
    img4_pred = next((p for p in predictions if p["filename"] == "img4.jpg"), None)
    assert img4_pred is not None
    assert img4_pred["ground_truth"] is None, "Expected ground_truth to be null for img4.jpg"
    print("[OK] Unlabeled image correctly excluded from ground truth mapping.")
    
    # Check metrics
    assert metrics is not None, "Expected metrics block to be present"
    cm = metrics.get("confusion_matrix")
    assert cm is not None
    
    # Total samples in confusion matrix should be 3
    total_cm_samples = cm["tp"] + cm["tn"] + cm["fp"] + cm["fn"]
    assert total_cm_samples == 3, f"Expected 3 samples in confusion matrix, got {total_cm_samples}"
    print("[OK] Confusion matrix computed only for labeled images.")
    
    accuracy = metrics.get("accuracy")
    assert accuracy is not None
    print(f"[OK] Evaluation metrics checked successfully (Accuracy: {accuracy}%).")

    print("\n==================================================")
    print("All Model Evaluation API Tests Passed Successfully!")
    print("==================================================")

if __name__ == "__main__":
    run_evaluation_tests()
