# DeepScan — Deepfake Detection Web App

> EfficientNet-B4 · GradCAM · SRM Forensics · FastAPI + React

---

## Project Structure

```
deepfake-detector/
├── backend/
│   ├── main.py            # FastAPI app
│   ├── model.py           # EfficientNet-B4 loader & inference
│   ├── gradcam.py         # GradCAM heatmap generator
│   ├── srm.py             # SRM residual analysis
│   ├── explainability.py  # Confidence tag + explanation generator
│   ├── colab_ngrok.py     # Google Colab + ngrok launcher
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── components/    # All UI components
    │   ├── hooks/         # useDetection, useTheme
    │   └── types/
    ├── package.json
    └── vite.config.ts
```

The model checkpoint (`custom_b4_srm01.pth`) lives in the **parent directory** (workspace root).

---

## 🖥️ Local Development

### 1. Backend

```bash
cd deepfake-detector/backend

# Create virtual environment (recommended)
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Start server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at: http://localhost:8000  
Interactive docs: http://localhost:8000/docs

### 2. Frontend

```bash
cd deepfake-detector/frontend

# Copy env file
copy .env.example .env      # Windows
# cp .env.example .env      # Mac/Linux

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open: http://localhost:5173

---

## ☁️ Google Colab + ngrok Deployment

1. Upload `custom_b4_srm01.pth` to **Google Drive**
2. Upload the entire `backend/` folder to your Colab session (or Drive)
3. Get a free ngrok auth token: https://dashboard.ngrok.com
4. In Colab, run `colab_ngrok.py` or copy its printed script into a cell
5. Update your `MODEL_PATH` and `NGROK_AUTH_TOKEN` in the script
6. Copy the printed ngrok URL
7. In `frontend/.env`, set: `VITE_API_URL=https://your-ngrok-url.ngrok-free.app`
8. Run `npm run dev` (or build+host the frontend separately)

---

## 🔌 API Reference

### `GET /health`
Returns `{ "status": "ok", "model_loaded": true }`

### `POST /detect`
Accepts `multipart/form-data` with field `file` (image).

**Response:**
```json
{
  "prediction":         "FAKE",
  "confidence":         0.923,
  "real_prob":          0.077,
  "fake_prob":          0.923,
  "gradcam_image":      "<base64 PNG>",
  "srm_image":          "<base64 PNG>",
  "srm_interpretation": "High noise residuals detected...",
  "confidence_tag":     "High Fake Confidence",
  "explanation":        "The model assigned 92.3%..."
}
```

---

## 🧪 Testing the Backend

```bash
# Health check
curl http://localhost:8000/health

# Detect (replace with actual image path)
curl -X POST http://localhost:8000/detect \
     -F "file=@/path/to/image.jpg"
```

---

## 🎨 UI Features

- **Dark / Light mode** toggle (persisted in localStorage)
- **Drag & drop** image upload with preview
- **GradCAM overlay** with tab toggle (Original ↔ Heatmap)
- **Animated donut chart** + probability bars
- **SRM residual** panel with interpretation
- **Explainability card** with sentence-by-sentence breakdown
- **Full-screen loading overlay** with step indicators
- **Responsive** — works on mobile, tablet, desktop

---

## ⚙️ Environment Variables

| Variable        | Default                   | Description               |
|----------------|---------------------------|---------------------------|
| `VITE_API_URL` | `http://localhost:8000`   | Backend API base URL      |
| `MODEL_PATH`   | `../custom_b4_srm01.pth`  | Path to .pth checkpoint   |
