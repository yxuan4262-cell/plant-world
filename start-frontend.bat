@echo off
cd /d "%~dp0frontend"
where python >nul 2>nul
if errorlevel 1 (
  echo Python 3 is required before startup.
  pause
  exit /b 1
)
echo Starting YeYuShiJie frontend at http://localhost:5173/login.html
python -m http.server 5173
pause
