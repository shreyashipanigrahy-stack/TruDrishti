import os
import requests
import zipfile
import io

BASE_URL = "http://localhost:8000"
REPORTS_DIR = "reports"

def run_integration_tests():
    print("==================================================")
    print("Starting Integration Tests: Evidently AI Batch Eval")
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

    # 2. Prepare mock ZIP containing a baseline image
    print("\n[Test 2] Preparing ZIP file payload with fake and real folder subdirectories...")
    zip_filename = "test_batch_eval.zip"
    logo_path = "../frontend/src/assets/logo.jpg"
    if not os.path.exists(logo_path):
        # Fallback: check other paths or write raw bytes
        img_bytes = b"mock_image_bytes"
    else:
        with open(logo_path, "rb") as f:
            img_bytes = f.read()

    with zipfile.ZipFile(zip_filename, "w") as z:
        # Evidently ClassificationPreset needs enough rows of both REAL and FAKE to evaluate binary classification
        # We write 5 real images and 5 fake images to meet the minimum slice requirements
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
    assert eval_json.get("report_url") == f"/reports/{batch_id}/download"

    # 4. Check if HTML Report file was written to disk
    print("\n[Test 4] Verifying HTML report existence on disk...")
    expected_file = os.path.join(REPORTS_DIR, f"batch_{batch_id}.html")
    if os.path.exists(expected_file):
        print(f"[OK] HTML report file found on disk at: {expected_file} (Size: {os.path.getsize(expected_file)} bytes)")
    else:
        # In Docker context, it might be inside the container. We check via download API.
        print(f"[INFO] Local file check not found at {expected_file} (might be inside running container). Will verify via HTTP.")

    # 5. Test GET /reports (History)
    print("\n[Test 5] Calling GET /reports (List History)...")
    history_resp = requests.get(f"{BASE_URL}/reports", headers=headers)
    assert history_resp.status_code == 200
    history = history_resp.json()
    print(f"[OK] Found {len(history)} reports in history.")
    
    # Ensure our batch_id is in history
    found = False
    for r in history:
        if r["batch_id"] == batch_id:
            found = True
            assert r["report_url"] == f"/reports/{batch_id}/download"
            print(f"  -> Match found in metadata history. Created At: {r['created_at']}")
            break
    assert found, f"Batch ID {batch_id} not found in /reports list!"

    # 6. Test GET /reports/{batch_id}
    print(f"\n[Test 6] Calling GET /reports/{batch_id}...")
    meta_resp = requests.get(f"{BASE_URL}/reports/{batch_id}", headers=headers)
    assert meta_resp.status_code == 200
    meta_json = meta_resp.json()
    print(f"[OK] Received metadata: {meta_json}")
    assert meta_json["batch_id"] == batch_id
    assert meta_json["report_url"] == f"/reports/{batch_id}/download"
    assert "created_at" in meta_json

    # 7. Test GET /reports/{batch_id}/download
    print(f"\n[Test 7] Calling GET /reports/{batch_id}/download...")
    dl_resp = requests.get(f"{BASE_URL}/reports/{batch_id}/download")
    assert dl_resp.status_code == 200
    print("[OK] Download succeeded.")
    assert "text/html" in dl_resp.headers.get("content-type", "")
    assert "attachment" in dl_resp.headers.get("content-disposition", "")
    assert f"batch_{batch_id}.html" in dl_resp.headers.get("content-disposition", "")
    html_content = dl_resp.text
    assert "evidently" in html_content.lower() or "html" in html_content.lower()
    print("[OK] Report HTML content verified.")

    # 8. Test GET /reports/{batch_id}/preview
    print(f"\n[Test 8] Calling GET /reports/{batch_id}/preview...")
    prev_resp = requests.get(f"{BASE_URL}/reports/{batch_id}/preview")
    assert prev_resp.status_code == 200
    print("[OK] Preview succeeded.")
    assert "text/html" in prev_resp.headers.get("content-type", "")
    assert "attachment" not in prev_resp.headers.get("content-disposition", "")
    print("[OK] Preview headers validated (no attachment header present).")

    print("\n==================================================")
    print("All Integration Tests Passed Successfully!")
    print("==================================================")

if __name__ == "__main__":
    run_integration_tests()
