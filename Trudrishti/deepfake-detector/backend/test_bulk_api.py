import os
import time
import requests

BASE_URL = "http://localhost:8000"
IMAGE_PATH = "../../test_face.jpg"  # Path relative to backend folder

def run_tests():
    print("==================================================")
    print("Starting Deepfake Detector Bulk API Tests")
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
    print("[OK] Login successful. Token obtained.")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }

    # Verify if test image exists
    if not os.path.exists(IMAGE_PATH):
        print(f"[ERROR] Test image not found at {IMAGE_PATH}!")
        return
    print(f"[OK] Found test image at: {IMAGE_PATH} ({os.path.getsize(IMAGE_PATH)} bytes)")

    # 2. Test /detect (single image) to measure baseline single image time
    print("\n[Test 2] Running single image detection (/detect) as baseline...")
    start_time = time.time()
    with open(IMAGE_PATH, "rb") as f:
        files = {"file": ("test_face.jpg", f, "image/jpeg")}
        resp = requests.post(f"{BASE_URL}/detect", headers=headers, files=files)
    single_duration = time.time() - start_time
    
    if resp.status_code != 200:
        print(f"[ERROR] Single image detection failed! Status: {resp.status_code}, Body: {resp.text}")
        return
    
    single_res = resp.json()
    print(f"[OK] Single image response: {single_res['prediction']} (Real Prob: {single_res['real_probability']}%, Fake Prob: {single_res['fake_probability']}%)")
    print(f"[TIME] Single image duration: {single_duration:.2f} seconds")

    # 3. Test /detect-bulk (3 images) and verify they run concurrently (duration should not be 3x)
    print("\n[Test 3] Running bulk detection (/detect-bulk) with 3 images concurrently...")
    start_time = time.time()
    
    # We must open independent file descriptors to send multiple files in one request
    f1 = open(IMAGE_PATH, "rb")
    f2 = open(IMAGE_PATH, "rb")
    f3 = open(IMAGE_PATH, "rb")
    
    files_payload = [
        ("files", ("face1.jpg", f1, "image/jpeg")),
        ("files", ("face2.jpg", f2, "image/jpeg")),
        ("files", ("face3.jpg", f3, "image/jpeg")),
    ]
    
    bulk_resp = requests.post(f"{BASE_URL}/detect-bulk", headers=headers, files=files_payload)
    bulk_duration = time.time() - start_time
    
    f1.close()
    f2.close()
    f3.close()
 
    if bulk_resp.status_code != 200:
        print(f"[ERROR] Bulk detection failed! Status: {bulk_resp.status_code}, Body: {bulk_resp.text}")
        return

    bulk_res = bulk_resp.json()
    results = bulk_res.get("results", [])
    print(f"[OK] Received {len(results)} results in bulk response.")
    for res in results:
        print(f"   - {res.get('filename')}: status={res.get('status')}, prediction={res.get('prediction')}, real_prob={res.get('real_probability')}, fake_prob={res.get('fake_probability')}, error_detail={res.get('error_detail')}")
        # Verify schema fields are present
        assert "prediction" in res or res.get("status") == "error"
        assert "real_probability" in res or res.get("status") == "error"
        assert "forensic_signals" in res or res.get("status") == "error"

    print(f"[TIME] Bulk (3 images) duration: {bulk_duration:.2f} seconds")
    print(f"[INFO] Concurrency verification: Single = {single_duration:.2f}s, Bulk (3) = {bulk_duration:.2f}s")
    if bulk_duration < (single_duration * 2):
        print("[OK] Concurrency is working as expected! Bulk duration is significantly lower than sequential (3x).")
    else:
        print("[WARNING] Bulk duration is close to or higher than 2x single duration. Verify offloading.")

    # 4. Test /detect-bulk with 11 images (should return 400 Bad Request)
    print("\n[Test 4] Running bulk detection with 11 images (exceeding limit of 10)...")
    handles = [open(IMAGE_PATH, "rb") for _ in range(11)]
    files_payload = [
        ("files", (f"face_{i}.jpg", handle, "image/jpeg")) for i, handle in enumerate(handles)
    ]
    
    limit_resp = requests.post(f"{BASE_URL}/detect-bulk", headers=headers, files=files_payload)
    for handle in handles:
        handle.close()
        
    print(f"Status returned: {limit_resp.status_code}")
    print(f"Response body: {limit_resp.text}")
    if limit_resp.status_code == 400:
        print("[OK] Correctly rejected: 400 Bad Request received for 11 files limit!")
    else:
        print("[ERROR] Limit rejection failed! Expected 400 Bad Request.")

    # 5. Test error isolation (2 valid images, 1 invalid txt file)
    print("\n[Test 5] Running bulk detection with mixed files (2 images, 1 text file)...")
    
    # Create a temporary txt file
    temp_txt_path = "temp_test.txt"
    with open(temp_txt_path, "w") as tf:
        tf.write("This is not an image.")
        
    f1 = open(IMAGE_PATH, "rb")
    f2 = open(IMAGE_PATH, "rb")
    f3 = open(temp_txt_path, "rb")
    
    files_payload = [
        ("files", ("face1.jpg", f1, "image/jpeg")),
        ("files", ("face2.jpg", f2, "image/jpeg")),
        ("files", ("bad_file.txt", f3, "text/plain")),
    ]
    
    mixed_resp = requests.post(f"{BASE_URL}/detect-bulk", headers=headers, files=files_payload)
    
    f1.close()
    f2.close()
    f3.close()
    if os.path.exists(temp_txt_path):
        os.remove(temp_txt_path)
        
    if mixed_resp.status_code != 200:
        print(f"[ERROR] Mixed files request failed with status: {mixed_resp.status_code}, Body: {mixed_resp.text}")
        return
        
    mixed_res = mixed_resp.json()
    results = mixed_res.get("results", [])
    print(f"[OK] Received {len(results)} results in mixed bulk response:")
    for res in results:
        status = res.get("status")
        filename = res.get("filename")
        if status == "success":
            print(f"   - {filename}: SUCCESS (prediction={res.get('prediction')})")
        else:
            print(f"   - {filename}: FAILED (error_detail='{res.get('error_detail')}')")
            
    # Verify exact status per file
    success_count = sum(1 for r in results if r.get("status") == "success")
    error_count = sum(1 for r in results if r.get("status") == "error")
    if success_count == 2 and error_count == 1:
        print("[OK] Error isolation is working perfectly! Valid images succeeded, invalid text file failed gracefully.")
    else:
        print(f"[ERROR] Error isolation verification failed. Successes: {success_count}, Errors: {error_count}")

    print("\n==================================================")
    print("All tests completed.")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
