@echo off
chcp 932 > nul
title 商管どん UI Dashboard Launcher
echo ===================================================
echo 🚀 商管どん UI ダッシュボード サーバーを起動します...
echo 👉 ダッシュボード URL: http://localhost:3000
echo 👉 eBayツール URL: http://localhost:8085
echo ===================================================
cd /d "C:\Users\akata\.gemini\antigravity\scratch"
timeout /t 2 > nul
start http://localhost:3000
node server.js
pause
