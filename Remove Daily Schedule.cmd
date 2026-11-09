@echo off
setlocal
cd /d "%~dp0"

schtasks /Delete /TN "UPSC Digest Daily Research" /F
if errorlevel 1 (
  echo.
  echo The scheduled task was not found, or could not be removed.
) else (
  echo.
  echo Daily research schedule removed.
)
pause

endlocal
