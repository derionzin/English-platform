@echo off
cd /d "%~dp0"
start "Server" cmd /k npm start
timeout /t 3 >nul
cloudflared tunnel --url http://localhost:3000
pause