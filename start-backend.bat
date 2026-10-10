@echo off
cd /d "%~dp0"
where java >nul 2>nul
if errorlevel 1 (
  echo Java 21 or newer is required before startup.
  pause
  exit /b 1
)
echo Starting YeYuShiJie backend API at http://localhost:8080
java -jar plant-vision-app.jar
pause
