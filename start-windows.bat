@echo off
setlocal
cd /d "%~dp0"
echo LH Plan Lab dependencies are being installed...
call npm ci --no-audit --no-fund
if errorlevel 1 exit /b 1
echo Starting LH Plan Lab...
call npm run dev
