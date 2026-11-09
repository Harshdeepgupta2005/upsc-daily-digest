@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\setup-schedule.ps1"
if errorlevel 1 (
  echo.
  echo Setup failed. Try right-clicking this file and choosing "Run as administrator".
)

echo.
pause

endlocal
