@echo off
setlocal
cd /d "%~dp0"

node scripts\launch.js
if errorlevel 1 (
  echo.
  echo Could not start the digest. Make sure Node.js 20 or newer is installed.
  pause
)

endlocal
