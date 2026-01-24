@echo off
echo ========================================
echo TradeTrack Pro - Backend Service Launcher
echo ========================================
echo.

cd /d "%~dp0"

echo Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org/
    pause
    exit /b 1
)

echo.
echo Installing dependencies...
pip install -r requirements.txt

if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

:start
echo Starting Flask backend service...
echo (Press Ctrl+C to stop)
echo.
python app.py

echo.
echo [WARNING] Backend service exited. Restarting in 5 seconds...
timeout /t 5
goto start
