@echo off
title TruDrishti - Starting All Servers
color 0A

echo.
echo  ████████╗██████╗ ██╗   ██╗██████╗ ██████╗ ██╗███████╗██╗  ██╗████████╗██╗
echo  ╚══██╔══╝██╔══██╗██║   ██║██╔══██╗██╔══██╗██║██╔════╝██║  ██║╚══██╔══╝██║
echo     ██║   ██████╔╝██║   ██║██║  ██║██████╔╝██║███████╗███████║   ██║   ██║
echo     ██║   ██╔══██╗██║   ██║██║  ██║██╔══██╗██║╚════██║██╔══██║   ██║   ██║
echo     ██║   ██║  ██║╚██████╔╝██████╔╝██║  ██║██║███████║██║  ██║   ██║   ██║
echo     ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝   ╚═╝
echo.
echo  AI Deepfake Detection System - Server Launcher
echo  ================================================
echo.

:: ── Backend (FastAPI) ──────────────────────────────────────────────────────
echo  [1/3] Starting FastAPI Backend on http://localhost:8000 ...
start "TruDrishti - FastAPI Backend" cmd /k "cd /d "%~dp0backend" && .venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"
timeout /t 3 /nobreak >nul

:: ── Frontend (Vite / React) ────────────────────────────────────────────────
echo  [2/3] Starting React Frontend on http://localhost:5173 ...
start "TruDrishti - React Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
timeout /t 3 /nobreak >nul

:: ── MLflow UI ──────────────────────────────────────────────────────────────
echo  [3/3] Starting MLflow UI on http://localhost:5000 ...
start "TruDrishti - MLflow UI" cmd /k "cd /d "%~dp0backend" && set "MLFLOW_ALLOW_FILE_STORE=true" && .venv\Scripts\mlflow ui --host 127.0.0.1 --port 5000"
timeout /t 4 /nobreak >nul

echo.
echo  ✅  All servers are starting up!
echo.
echo  ┌─────────────────────────────────────────────────────┐
echo  │  🖥️  TruDrishti App  →  http://localhost:5173        │
echo  │  ⚙️  Swagger API    →  http://localhost:8000/docs    │
echo  │  📊  MLflow UI      →  http://localhost:5000         │
echo  └─────────────────────────────────────────────────────┘
echo.
echo  Servers are running in separate windows.
echo  Close those windows to stop the servers.
echo.
pause
