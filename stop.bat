@echo off
title Stop Auto-Fill
echo ====================================================
echo          DANG DUNG AUTO-FILL (BE & FE)
echo ====================================================
echo.

echo Dang tat Backend (port 8000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000.*LISTENING"') do (
    taskkill /F /PID %%a 2>nul
)

echo Dang tat Frontend (port 5173)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173.*LISTENING"') do (
    taskkill /F /PID %%a 2>nul
)

echo.
echo Da dung tat ca cac tien trinh!
timeout /t 2 >nul
