"""
Google Colab + ngrok deployment launcher for Deepfake Detector API.

HOW TO USE
----------
1. Upload this file (and the entire backend/ folder) to your Colab session,
   OR copy the printed script into Colab cells manually.
2. Run: !python colab_ngrok.py
3. Copy the printed public URL into your frontend .env as VITE_API_URL.

Alternatively, paste the COLAB_SETUP_SCRIPT string below directly into
a Colab code cell.
"""

COLAB_SETUP_SCRIPT = r"""
# ╔══════════════════════════════════════════════════════════════╗
# ║       DEEPFAKE DETECTOR — COLAB + NGROK SETUP               ║
# ╚══════════════════════════════════════════════════════════════╝

# ── Step 1: Install Python dependencies ──────────────────────────
!pip install -q fastapi==0.111.0 uvicorn[standard]==0.29.0 \
    python-multipart==0.0.9 timm==0.9.16 \
    Pillow numpy opencv-python-headless scipy pyngrok

# ── Step 2: Mount Google Drive ───────────────────────────────────
from google.colab import drive
drive.mount("/content/drive")

# ── Step 3: Set model path ───────────────────────────────────────
# Adjust to wherever you uploaded custom_b4_srm01.pth in your Drive
import os
os.environ["MODEL_PATH"] = "/content/drive/MyDrive/custom_b4_srm01.pth"

# ── Step 4: Upload backend source files ──────────────────────────
# Option A — copy from Drive (if you uploaded the folder there):
#   !cp -r "/content/drive/MyDrive/deepfake-detector/backend" /content/

# Option B — upload via Colab file panel, then set:
BACKEND_DIR = "/content/backend"   # adjust if needed

# ── Step 5: Start ngrok tunnel ───────────────────────────────────
from pyngrok import ngrok

NGROK_AUTH_TOKEN = "PASTE_YOUR_NGROK_TOKEN_HERE"   # ← replace this
ngrok.set_auth_token(NGROK_AUTH_TOKEN)

tunnel = ngrok.connect(8000)
public_url = tunnel.public_url
print(f"\n🌐 Public API URL : {public_url}")
print(f"   Set this as VITE_API_URL in your frontend .env file\n")

# ── Step 6: Launch FastAPI server (non-blocking thread) ──────────
import subprocess, threading, time

def _run():
    subprocess.run(
        ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
        cwd=BACKEND_DIR,
    )

server_thread = threading.Thread(target=_run, daemon=True)
server_thread.start()
time.sleep(3)   # Let the server warm up

print("🚀 FastAPI server is running on port 8000")
print(f"📡 Health check → {public_url}/health")
print(f"🔍 Detect endpoint → {public_url}/detect  (POST multipart/form-data)")
"""

if __name__ == "__main__":
    print("=" * 66)
    print("  DEEPFAKE DETECTOR — COLAB SETUP SCRIPT")
    print("=" * 66)
    print()
    print("Copy the following script into a Google Colab code cell:")
    print()
    print(COLAB_SETUP_SCRIPT)
    print()
    print("=" * 66)
    print("CHECKLIST:")
    print("  1. Upload custom_b4_srm01.pth to Google Drive")
    print("  2. Update MODEL_PATH to match its Drive location")
    print("  3. Get a free ngrok token from https://dashboard.ngrok.com")
    print("  4. Paste your token into NGROK_AUTH_TOKEN")
    print("  5. Upload backend/ files to /content/backend/")
    print("  6. Paste the printed ngrok URL into frontend/.env as VITE_API_URL")
    print("=" * 66)
