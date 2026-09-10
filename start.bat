@echo off
title Auto-Fill App Launcher
cd /d "%~dp0"

echo ====================================================
echo          KHOI DONG AUTO-FILL (BE & FE)
echo ====================================================
echo.

echo [1/2] Dang khoi dong Backend (FastAPI :8000)...
start "Backend - AutoFill API" cmd /k "cd /d "%~dp0BE-auto-fill" && call .venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"

echo [2/2] Dang khoi dong Frontend (React Vite :5173)...
start "Frontend - AutoFill React" cmd /k "cd /d "%~dp0FE-auto-fill\my-react-app" && npm run dev"

echo.
echo Dang cho server san sang va mo trinh duyet...
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo ====================================================
echo   Da khoi chay thanh cong!
echo   - Frontend: http://localhost:5173
echo   - Backend API Docs: http://127.0.0.1:8000/docs
echo ====================================================
echo.
echo Ban co the dong cua so nay (2 cua so BE/FE van se chay).
timeout /t 5 >nul
