import os
import requests
import zipfile
import io
import csv

BASE_URL = "http://localhost:8000"
ERROR_ANALYSIS_DIR = "error_analysis"
RETRAINING_DIR = "retraining_dataset"

def run_error_analysis_tests():
    print("==================================================")
    print("Starting Integration Tests: Error Analysis Module")
    print("==================================================")

    # 1. Login
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

    # 2. Prepare zip payload
    print("\n[Test 2] Preparing ZIP file payload with fake/real folders...")
    zip_filename = "test_error_analysis.zip"
    logo_path = "../frontend/src/assets/logo.jpg"
    if not os.path.exists(logo_path):
        img_bytes = b"mock_image_bytes"
    else:
        with open(logo_path, "rb") as f:
            img_bytes = f.read()

    with zipfile.ZipFile(zip_filename, "w") as z:
        # Write 5 real and 5 fake to guarantee 5 misclassifications
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

    # 3. Call POST /batch-evaluate
    print("\n[Test 3] Submitting batch evaluation to POST /batch-evaluate...")
    with open(zip_filename, "rb") as f:
        files_payload = {
            "zip_file": (zip_filename, f, "application/zip")
        }
        eval_resp = requests.post(
            f"{BASE_URL}/batch-evaluate",
            headers=headers,
            files=files_payload
        )
    
    # Clean up local zip
    if os.path.exists(zip_filename):
        os.remove(zip_filename)

    assert eval_resp.status_code == 200, f"Batch eval failed: {eval_resp.text}"
    eval_json = eval_resp.json()
    batch_id = eval_json.get("batch_id")
    print(f"[OK] Evaluation completed. Batch ID: {batch_id}")

    # 4. Verify local directory structures
    print("\n[Test 4] Verifying folder structure and files on disk...")
    batch_folder = os.path.join(ERROR_ANALYSIS_DIR, f"batch_{batch_id}")
    assert os.path.exists(batch_folder), "Batch error folder does not exist!"
    assert os.path.exists(os.path.join(batch_folder, "false_positive")) or os.path.exists(os.path.join(batch_folder, "false_negative")), "No error subfolders found!"
    
    # Verify CSV file
    csv_path = os.path.join(batch_folder, "reports", "misclassified_images.csv")
    assert os.path.exists(csv_path), "CSV report file is missing!"
    
    # Read CSV and count rows
    with open(csv_path, "r", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        rows = list(reader)
        print(f"[OK] CSV file contains {len(rows)} misclassified images.")
        assert len(rows) > 0, "CSV file is empty!"
        
    print("[OK] Disk directory structure and CSV content validated.")

    # 5. Test GET /batch/{batch_id}/misclassified
    print(f"\n[Test 5] Calling GET /batch/{batch_id}/misclassified...")
    misc_resp = requests.get(f"{BASE_URL}/batch/{batch_id}/misclassified", headers=headers)
    assert misc_resp.status_code == 200, misc_resp.text
    misc_json = misc_resp.json()
    print(f"[OK] Received misclassified count details: {misc_json}")
    assert "false_positive_count" in misc_json
    assert "false_negative_count" in misc_json
    assert "total_misclassified" in misc_json
    assert len(misc_json["images"]) == misc_json["total_misclassified"]

    # 6. Test GET /batch/{batch_id}/false-positives and /false-negatives
    print(f"\n[Test 6] Calling GET /batch/{batch_id}/false-positives & /false-negatives...")
    fp_resp = requests.get(f"{BASE_URL}/batch/{batch_id}/false-positives", headers=headers)
    fn_resp = requests.get(f"{BASE_URL}/batch/{batch_id}/false-negatives", headers=headers)
    assert fp_resp.status_code == 200
    assert fn_resp.status_code == 200
    
    fps = fp_resp.json()
    fns = fn_resp.json()
    print(f"[OK] Found {len(fps)} False Positives and {len(fns)} False Negatives.")
    assert len(fps) + len(fns) == misc_json["total_misclassified"]

    # 7. Test GET /batch/{batch_id}/summary and /analytics
    print(f"\n[Test 7] Calling GET /batch/{batch_id}/summary & /analytics...")
    sum_resp = requests.get(f"{BASE_URL}/batch/{batch_id}/summary", headers=headers)
    ana_resp = requests.get(f"{BASE_URL}/batch/{batch_id}/analytics", headers=headers)
    assert sum_resp.status_code == 200
    assert ana_resp.status_code == 200
    
    sum_json = sum_resp.json()
    print(f"[OK] Received Summary: {sum_json}")
    assert sum_json["batch_id"] == batch_id
    assert sum_json["accuracy"] == 50.0
    assert "hardest_images" in sum_json
    
    # Verify hardest_images sorting (confidence descending)
    hardest = sum_json["hardest_images"]
    confidences = [h["confidence"] for h in hardest]
    assert confidences == sorted(confidences, reverse=True), "Hardest images not sorted by confidence descending!"
    print("[OK] Hardest images confidence sorting verified.")

    # 8. Test POST /batch/{batch_id}/export
    print(f"\n[Test 8] Calling POST /batch/{batch_id}/export...")
    exp_resp = requests.post(f"{BASE_URL}/batch/{batch_id}/export", headers=headers)
    assert exp_resp.status_code == 200, exp_resp.text
    exp_json = exp_resp.json()
    print(f"[OK] Received export response: {exp_json}")
    assert exp_json["status"] == "success"
    assert exp_json["export_path"] == RETRAINING_DIR
    assert exp_json["exported_count"] == misc_json["total_misclassified"]
    
    # Check disk existence of retraining dataset
    assert os.path.exists(RETRAINING_DIR), "Retraining dataset folder is missing!"
    meta_csv = os.path.join(RETRAINING_DIR, "metadata.csv")
    assert os.path.exists(meta_csv), "Retraining metadata.csv is missing!"
    
    # Verify metadata contents
    with open(meta_csv, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        meta_rows = list(reader)
        print(f"[OK] Retraining metadata CSV contains {len(meta_rows)} rows.")
        assert len(meta_rows) >= misc_json["total_misclassified"]
        
    print("[OK] Retraining dataset export verified on disk.")

    print("\n==================================================")
    print("All Error Analysis Integration Tests Passed Successfully!")
    print("==================================================")

if __name__ == "__main__":
    run_error_analysis_tests()
