@echo off
chcp 65001 > nul
title 商管どん ＆ 仕入れ監視システム 自動起動

echo ========================================================
echo   🚀 商管どん ＆ 仕入れ監視システム を起動しています...
echo ========================================================
echo.

:: 1. 仕入れ監視システム（バックエンド: ポート8000）の起動確認
netstat -ano | findstr ":8000" > nul
if %errorlevel% neq 0 (
    echo [1/2] 仕入れ監視システム (Port 8000) を起動中...
    start /min "StockMonitorBackend" cmd /c "cd /d C:\Users\akata\.gemini\antigravity\scratch\ebay-stock-monitor\backend && python -m uvicorn app:app --host 127.0.0.1 --port 8000"
    timeout /t 2 > nul
) else (
    echo [1/2] 仕入れ監視システム は既に稼働中です。
)

:: 2. ブラウザで画面を自動オープン
echo [2/2] ブラウザで管理画面を開いています...
start http://127.0.0.1:8000

echo.
echo ========================================================
echo   ✅ すべてのシステムが正常に起動しました！
echo ========================================================
timeout /t 3 > nul
exit
