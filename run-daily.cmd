@echo off
setlocal
cd /d "%~dp0"

if not exist "data\logs" mkdir "data\logs"
node scripts\daily-run.js >> "data\logs\scheduled-run.log" 2>&1
exit /b %errorlevel%
