@echo off
title MediAssist - Auto Starter

echo ===========================================
echo        Starting MediAssist Project
echo ===========================================

:: --- STEP 0: Setup WSL portproxy (localhost only — LAN traffic goes via Next.js now) ---
echo.
echo [0/4] Setting up WSL port forwarding (admin required)...
powershell -Command "Start-Process powershell -Verb RunAs -Wait -ArgumentList '-ExecutionPolicy Bypass -File ""C:\Users\dell\Desktop\ramdani\refresh-portproxy.ps1""'"

:: --- Kill any leftover processes on ports 3000 and 8000 ---
echo.
echo [0/4] Cleaning up leftover processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 " ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
timeout /t 1 >nul

:: --- STEP 1: Start PostgreSQL ---
echo.
echo [1/4] Starting PostgreSQL service...
net start postgresql-x64-18 >nul 2>&1
timeout /t 2 >nul

:: --- STEP 2: Start Laravel backend (Octane via WSL) ---
echo.
echo [2/4] Starting Laravel backend (Octane via WSL)...
start "" powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\Users\dell\Desktop\ramdani\fast-backend.ps1"

:: --- STEP 3: Build Next.js frontend ---
:: (The build takes ~2 min which gives Octane plenty of time to start)
echo.
echo [3/4] Building Next.js frontend (please wait ~2 min)...
cd /d "C:\Users\dell\Desktop\ramdani\Frontend"
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo BUILD FAILED. Check errors above.
    pause
    exit /b 1
)

:: --- STEP 4: Start Next.js frontend ---
echo.
echo [4/4] Starting Next.js frontend...
start "" powershell -WindowStyle Hidden -Command "Set-Location 'C:\Users\dell\Desktop\ramdani\Frontend'; npm start"
timeout /t 12 >nul

:: --- Open browser ---
echo.
echo Opening MediAssist in browser...
start "" "http://192.168.1.3:3000"

echo.
echo ===========================================
echo  All systems running! MediAssist is live
echo ===========================================

pause
