@echo off
setlocal EnableExtensions
title LH Plan Lab
cd /d "%~dp0"

echo ==================================================
echo   LH Plan Lab - Windows Launcher
echo ==================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto node_missing

where npm >nul 2>nul
if errorlevel 1 goto node_missing

echo [1/2] Checking project dependencies...
call npm ci --no-audit --no-fund
if errorlevel 1 goto install_failed

echo.
echo [2/2] Starting LH Plan Lab...
echo The browser will open automatically when the server is ready.
echo Do not close this window while using the program.
echo.

start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "$url='http://localhost:3000'; for($i=0; $i -lt 120; $i++){ try { Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 2 ^| Out-Null; Start-Process $url; break } catch { Start-Sleep -Seconds 1 } }"
call npm run dev
if errorlevel 1 goto start_failed
goto end

:node_missing
echo [ERROR] Node.js and npm were not found.
echo Install the LTS version of Node.js, then run this file again:
echo https://nodejs.org/en/download
echo.
pause
exit /b 1

:install_failed
echo.
echo [ERROR] Dependency installation failed.
echo Check the error message above and your Internet connection.
echo.
pause
exit /b 1

:start_failed
echo.
echo [ERROR] LH Plan Lab could not start.
echo Check the error message above.
echo.
pause
exit /b 1

:end
endlocal
