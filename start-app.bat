@echo off
cd /d "%~dp0"
where java >nul 2>nul
if errorlevel 1 (
  echo Java 21 or newer is required before startup.
  pause
  exit /b 1
)
echo Starting YeYuShiJie backend API at http://localhost:8080
echo Start start-frontend.bat or start-all.bat, then open http://localhost:5173/login.html
java -jar plant-vision-app.jar
pause
