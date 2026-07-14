@echo off
title Starfall Admin
cd /d "%~dp0.."
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js ne naiden. Ustanovite Node.js s https://nodejs.org
  pause
  exit /b 1
)
start /min "Starfall Admin Server" cmd /c "node scripts\serve-admin.mjs"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8765"
echo.
echo Starfall Admin zapushchen: http://127.0.0.1:8765
echo Ne zakryvayte eto okno poka rabotaete s admin-panelyu.
echo.
pause
