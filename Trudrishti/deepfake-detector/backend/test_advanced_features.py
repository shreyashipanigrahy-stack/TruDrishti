import os
import requests
import zipfile
import io
import csv

BASE_URL = "http://localhost:8000"

def test_advanced_features():
    print("==================================================")
    print("Starting Integration Tests: Advanced Features")
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
    zip_filename = "test_adv.zip"
    logo_path = "../frontend/src/assets/logo.jpg"
    if not os.path.exists(logo_path):
        img_bytes = b"mock_image_bytes"
    else:
        with open(logo_path, "rb") as f:
            img_bytes = f.read()

    with zipfile.ZipFile(zip_filename, "w") as z:
        # Guarantee misclassifications
        z.writestr("real/img1.jpg", img_bytes)
        z.writestr("real/img2.jpg", img_bytes)
        z.writestr("fake/img3.jpg", img_bytes)
        z.writestr("fake/img4.jpg", img_bytes)

    print("[OK] ZIP file created with 4 images.")

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
    
    if os.path.exists(zip_filename):
        os.remove(zip_filename)

    assert eval_resp.status_code == 200, f"Batch eval failed: {eval_resp.text}"
    eval_json = eval_resp.json()
    batch_id = eval_json.get("batch_id")
    print(f"[OK] Evaluation completed. Batch ID: {batch_id}")

    # 4. Wait for Evidently report metadata to sync in DB (it is created during evaluate)
    # Let's verify GET /reports/{batch_id} metadata
    print(f"\n[Test 4] Calling GET /reports/{batch_id}...")
    rep_resp = requests.get(f"{BASE_URL}/reports/{batch_id}", headers=headers)
    assert rep_resp.status_code == 200, f"Get report metadata failed: {rep_resp.text}"
    rep_json = rep_resp.json()
    print(f"[OK] Report metadata: {rep_json}")

    # 5. Test GET /reports/{batch_id}/view (Preview)
    print(f"\n[Test 5] Calling GET /reports/{batch_id}/view (Inline HTML)...")
    view_resp = requests.get(f"{BASE_URL}/reports/{batch_id}/view", headers=headers)
    assert view_resp.status_code == 200
    assert "text/html" in view_resp.headers.get("content-type", "")
    print("[OK] Inline HTML view works.")

    # 6. Test GET /reports/{batch_id}/pdf (PDF download)
    print(f"\n[Test 6] Calling GET /reports/{batch_id}/pdf...")
    pdf_resp = requests.get(f"{BASE_URL}/reports/{batch_id}/pdf", headers=headers)
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers.get("content-type") == "application/pdf"
    assert len(pdf_resp.content) > 0
    print(f"[OK] PDF report download works. Size: {len(pdf_resp.content)} bytes.")

    # 7. Test GET /reports/{batch_id}/info
    print(f"\n[Test 7] Calling GET /reports/{batch_id}/info...")
    info_resp = requests.get(f"{BASE_URL}/reports/{batch_id}/info", headers=headers)
    assert info_resp.status_code == 200
    info_json = info_resp.json()
    print(f"[OK] Report info: {info_json}")
    assert info_json["html_available"] is True
    assert info_json["pdf_available"] is True

    # 8. Test GET /batch/{batch_id}/misclassified (Get image IDs)
    print(f"\n[Test 8] Calling GET /batch/{batch_id}/misclassified to retrieve image IDs...")
    misc_resp = requests.get(f"{BASE_URL}/batch/{batch_id}/misclassified", headers=headers)
    assert misc_resp.status_code == 200
    misc_json = misc_resp.json()
    images = misc_json.get("images", [])
    assert len(images) > 0, "No misclassified images logged!"
    
    first_img = images[0]
    image_id = first_img["id"]
    print(f"[OK] Found misclassified image: {first_img['filename']} with image_id {image_id}")
    assert "image_url" in first_img
    assert "download_url" in first_img
    assert "thumbnail_url" in first_img

    # 9. Test GET /batch/{batch_id}/image/{image_id} (serving image)
    print(f"\n[Test 9] Serving raw image for image_id {image_id}...")
    img_resp = requests.get(f"{BASE_URL}{first_img['image_url']}")
    assert img_resp.status_code == 200
    assert "image/" in img_resp.headers.get("content-type", "")
    print(f"[OK] Image served successfully. Content type: {img_resp.headers.get('content-type')}")

    # 10. Test ZIP Downloads (FPs, FNs, All)
    print(f"\n[Test 10] Calling GET /batch/{batch_id}/misclassified/download...")
    zip_all_resp = requests.get(f"{BASE_URL}/batch/{batch_id}/misclassified/download", headers=headers)
    assert zip_all_resp.status_code == 200
    assert "application/zip" in zip_all_resp.headers.get("content-type", "")
    
    # Verify zip content
    with zipfile.ZipFile(io.BytesIO(zip_all_resp.content)) as zf:
        namelist = zf.namelist()
        print(f"[OK] Downloaded misclassified ZIP contents: {namelist}")
        assert len(namelist) > 0

    # 11. Test HTML Gallery
    print(f"\n[Test 11] Calling GET /batch/{batch_id}/gallery...")
    gal_resp = requests.get(f"{BASE_URL}/batch/{batch_id}/gallery")
    assert gal_resp.status_code == 200
    assert "text/html" in gal_resp.headers.get("content-type", "")
    html_text = gal_resp.text
    assert "Outfit" in html_text
    assert "False Positive" in html_text or "False Negative" in html_text
    print("[OK] HTML Gallery rendering verified successfully.")

    # 12. Test Retraining export and download
    print(f"\n[Test 12] Calling GET /batch/{batch_id}/retraining-export/download...")
    zip_retrain_resp = requests.get(f"{BASE_URL}/batch/{batch_id}/retraining-export/download", headers=headers)
    assert zip_retrain_resp.status_code == 200
    assert "application/zip" in zip_retrain_resp.headers.get("content-type", "")
    
    with zipfile.ZipFile(io.BytesIO(zip_retrain_resp.content)) as zf:
        namelist = zf.namelist()
        print(f"[OK] Downloaded retraining dataset ZIP contents: {namelist}")
        assert "metadata.csv" in namelist
        
        # Verify CSV format
        metadata_bytes = zf.read("metadata.csv")
        csv_reader = csv.DictReader(io.StringIO(metadata_bytes.decode("utf-8")))
        rows = list(csv_reader)
        print(f"[OK] CSV header: {csv_reader.fieldnames}")
        assert csv_reader.fieldnames == ["filename", "ground_truth", "prediction", "confidence", "error_type", "batch_id"]
        assert len(rows) > 0
        print(f"[OK] Verified CSV rows count: {len(rows)}")

    print("\n==================================================")
    print("All Advanced Features Integration Tests Passed Successfully!")
    print("==================================================")

if __name__ == "__main__":
    test_advanced_features()
