@echo off
title Routine Organizer
cd /d "%~dp0"

echo.
echo   Routine Organizer
echo   =================
echo.

REM First run on a fresh copy needs the dependencies installed.
if not exist "node_modules\next" (
    echo   Installing dependencies. This only happens once, give it a minute...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo   Install failed. Check that Node.js 22.5 or newer is installed:
        echo   node --version
        echo.
        pause
        exit /b 1
    )
    echo.
)

REM Open the browser a few seconds behind the server, in a throwaway window.
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 6; Start-Process 'http://localhost:3000'"

echo   Starting on http://localhost:3000
echo   Your browser will open in a moment.
echo.
echo   Leave this window open while you use the app.
echo   Press Ctrl+C here to stop it.
echo.

call npm run dev

REM If npm exits on its own, something went wrong - keep the error visible.
echo.
echo   The server stopped.
pause
