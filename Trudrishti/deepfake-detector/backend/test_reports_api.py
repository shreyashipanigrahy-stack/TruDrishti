import os
import requests

BASE_URL = "http://localhost:8000"

def run_reports_tests():
    print("==================================================")
    print("Starting Monitoring Reports API Tests")
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

    # 2. Test GET /reports (List Reports)
    print("\n[Test 2] Testing GET /reports (List Reports)...")
    reports_resp = requests.get(f"{BASE_URL}/reports", headers=headers)
    if reports_resp.status_code != 200:
        print(f"[ERROR] GET /reports failed! Status: {reports_resp.status_code}, Body: {reports_resp.text}")
        return
    
    reports = reports_resp.json()
    print(f"[OK] GET /reports succeeded. Found {len(reports)} batch report(s).")
    print("Latest reports list preview:")
    for r in reports[:3]:
        print(f"  - Batch ID: {r['batch_id']}, Created At: {r['created_at']}, Image Count: {r['count']}")

    if not reports:
        print("[INFO] No reports found. Running a quick evaluate-bulk to generate one...")
        # Create temp zip
        import zipfile
        zip_filename = "temp_reports_test.zip"
        image_path = "../frontend/src/assets/logo.jpg"
        if not os.path.exists(image_path):
            print(f"[ERROR] Baseline image not found at {image_path}. Cannot generate a report batch.")
            return

        with open(image_path, "rb") as f:
            img_bytes = f.read()

        with zipfile.ZipFile(zip_filename, "w") as z:
            z.writestr("real/img1.jpg", img_bytes)
            z.writestr("real/img2.jpg", img_bytes)
            z.writestr("fake/img3.jpg", img_bytes)
            z.writestr("fake/img4.jpg", img_bytes)
            z.writestr("real/img5.jpg", img_bytes)
            z.writestr("fake/img6.jpg", img_bytes)
            z.writestr("real/img7.jpg", img_bytes)
            z.writestr("fake/img8.jpg", img_bytes)
            z.writestr("real/img9.jpg", img_bytes)
            z.writestr("fake/img10.jpg", img_bytes)

        files_payload = {
            "zip_file": (zip_filename, open(zip_filename, "rb"), "application/zip")
        }
        eval_resp = requests.post(f"{BASE_URL}/evaluate-bulk", headers=headers, files=files_payload)
        
        # Clean up zip
        if os.path.exists(zip_filename):
            os.remove(zip_filename)
            
        if eval_resp.status_code != 200:
            print(f"[ERROR] POST /evaluate-bulk failed! Status: {eval_resp.status_code}, Body: {eval_resp.text}")
            return
        
        eval_res = eval_resp.json()
        print(f"[OK] Generated new batch ID: {eval_res['batch_id']}")
        
        # Query list again
        reports_resp = requests.get(f"{BASE_URL}/reports", headers=headers)
        reports = reports_resp.json()

    if not reports:
        print("[ERROR] Still no reports found after generation!")
        return

    target_batch = reports[0]
    batch_id = target_batch["batch_id"]

    # 3. Test GET /reports/{batch_id} (Get Report Detail JSON)
    print(f"\n[Test 3] Testing GET /reports/{{batch_id}} for batch: {batch_id}...")
    detail_resp = requests.get(f"{BASE_URL}/reports/{batch_id}", headers=headers)
    print(f"Detail API Status: {detail_resp.status_code}")
    if detail_resp.status_code == 422:
        print(f"[INFO] Received 422 (Insufficient Data) which is schema-compliant. Detail: {detail_resp.json().get('detail')}")
    elif detail_resp.status_code == 200:
        detail_json = detail_resp.json()
        assert "summary" in detail_json
        assert "evidently_report" in detail_json
        print("[OK] Successfully retrieved data drift JSON report.")
        print(f"Summary metrics fake rates: ref={detail_json['summary']['fake_rate_reference']}, cur={detail_json['summary']['fake_rate_current']}")
    else:
        print(f"[ERROR] GET /reports/{{batch_id}} failed! Status: {detail_resp.status_code}, Body: {detail_resp.text}")
        return

    # 4. Test GET /reports/{batch_id}/download (Download HTML report - public)
    print(f"\n[Test 4] Testing public GET /reports/{{batch_id}}/download for batch: {batch_id}...")
    download_resp = requests.get(f"{BASE_URL}/reports/{batch_id}/download")
    if download_resp.status_code != 200:
        print(f"[ERROR] Public HTML download failed! Status: {download_resp.status_code}, Body: {download_resp.text}")
        return
        
    print("[OK] Download HTML succeeded.")
    content_type = download_resp.headers.get("content-type", "")
    content_disp = download_resp.headers.get("content-disposition", "")
    print(f"Response Content-Type: {content_type}")
    print(f"Response Content-Disposition: {content_disp}")
    
    assert "text/html" in content_type
    assert "attachment" in content_disp
    assert f"{batch_id}.html" in content_disp
    print("[OK] Download attachment headers and HTML content validated successfully!")

    print("\n==================================================")
    print("All Monitoring Reports API Tests Passed Successfully!")
    print("==================================================")

if __name__ == "__main__":
    run_reports_tests()
