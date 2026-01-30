@echo off
cd /d "%~dp0"
echo ========================================
echo TradeTrack Pro - Frontend Launcher
echo ========================================
echo.

echo Checking for node_modules...
if not exist "node_modules" (
    echo node_modules not found. Installing dependencies...
    echo This may take a few minutes...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed. Please check your Node.js installation.
        pause
        exit /b 1
    )
)

echo.
echo Starting Vite Development Server...
call npm run dev

pause
