@echo off
setlocal

title ALKABEER VIP WEB

cd /d "G:\OMARA\Desktop\ALKABEER VIP WEB"

echo Starting ALKABEER VIP API...
start "" /b cmd /c "npm run start:api > api.log 2>&1"

echo Waiting for API...
timeout /t 10 /nobreak >nul

echo Starting ALKABEER VIP WEB...
start "" /b cmd /c "npm run start:web > web.log 2>&1"

echo Waiting for Vite...
timeout /t 5 /nobreak >nul

echo.
echo ALKABEER VIP WEB is running.
echo Opening Chrome...

start "" "http://localhost:5173"

echo.
echo Close this window to stop the application.

pause >nul

taskkill /F /IM node.exe /T >nul 2>&1

endlocal