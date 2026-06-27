@echo off
echo ================================================
echo   MediAssist Radiology AI Server
echo ================================================
echo.
echo Starting on http://localhost:8001
echo Press Ctrl+C to stop.
echo.
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"
python main.py
pause
