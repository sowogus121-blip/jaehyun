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
echo Keep the server window open while using the program.
echo.

curl.exe -fsS http://127.0.0.1:3000/ -o NUL >nul 2>nul
if not errorlevel 1 goto server_ready

start "LH Plan Lab Server" cmd.exe /k "npm run dev"
set /a WAIT_COUNT=0

:wait_for_server
timeout /t 1 /nobreak >nul
curl.exe -fsS http://127.0.0.1:3000/ -o NUL >nul 2>nul
if not errorlevel 1 goto server_ready
set /a WAIT_COUNT+=1
if %WAIT_COUNT% GEQ 120 goto start_failed
goto wait_for_server

:server_ready
echo LH Plan Lab is ready. Opening the browser...
start "" "http://127.0.0.1:3000"
timeout /t 2 /nobreak >nul
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
echo Check the "LH Plan Lab Server" window for the error message.
echo You can also try opening http://127.0.0.1:3000 manually.
echo.
pause
exit /b 1

:end
endlocal
