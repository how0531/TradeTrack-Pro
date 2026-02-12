@echo off
echo =======================================================
echo   TradeTrack-Pro 股票清單一鍵更新工具
echo =======================================================
echo.

:: 檢查 Python 是否安裝
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [錯誤] 找不到 Python，請確保已安裝 Python 並加入 PATH 環境變數。
    pause
    exit /b 1
)

:: 執行爬蟲腳本
echo [1/2] 正在從 TWSE 抓取最新股票清單...
python scripts\fetchStockList.py

if %errorlevel% neq 0 (
    echo [錯誤] 抓取失敗，請檢查網路連線或 TWSE 網站狀態。
    pause
    exit /b 1
)

echo.
echo [2/2] 更新完成！
echo 檔案已儲存至：
echo   - scripts\stockList.json
echo   - src\utils\stockMap.ts
echo.
echo =======================================================
echo 更新成功！按任意鍵結束...
pause >nul
