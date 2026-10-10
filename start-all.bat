@echo off
cd /d "%~dp0"
start "YeYuShiJie Backend" "%~dp0start-backend.bat"
timeout /t 2 >nul
start "YeYuShiJie Frontend" "%~dp0start-frontend.bat"
