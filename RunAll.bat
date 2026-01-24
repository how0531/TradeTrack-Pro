@echo off
title TradeTrack Pro - Global Launcher
echo ========================================
echo TradeTrack Pro: Starting All Services...
echo ========================================
echo.

:: 啟動後端
echo [1/2] Launching Python Backend...
start "TradeTrack Backend" cmd /c "cd /d %~dp0backend && start.bat"

echo.
:: 啟動前端
echo [2/2] Launching Frontend (Vite)...
start "TradeTrack Frontend" cmd /c "cd /d %~dp0 && npm run dev"

echo.
echo ========================================
echo All services are starting in separate windows.
echo You can minimize them and enjoy!
echo ========================================
timeout /t 5
exit
