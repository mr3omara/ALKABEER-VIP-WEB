@echo off
setlocal

title ALKABEER VIP WEB

cd /d "G:\OMARA\Desktop\ALKABEER VIP WEB"

:: Start API silently
start "" /b cmd /c "npm run start:api > api.log 2>&1"

:: Start Web silently
start "" /b cmd /c "npm run start:web > web.log 2>&1"

echo Waiting for backend API to initialize on port 4000...
set RETRIES=0

:API_LOOP
curl -s -o nul http://localhost:4000/api/auth/me
if %errorlevel% equ 0 (
    goto API_READY
)
set /a RETRIES+=1
if %RETRIES% geq 30 (
    echo [Warning] Backend API is taking longer than expected. Continuing...
    goto API_READY
)
ping 127.0.0.1 -n 2 >nul
goto API_LOOP

:API_READY
echo [OK] Backend API is ready!

:: Small buffer for Vite to finish initial bundling
ping 127.0.0.1 -n 3 >nul

:: Open Chrome
start "" "http://localhost:5173"

echo ALKABEER VIP WEB is running.
echo.
echo Close this window to stop the application.

:: Keep launcher alive
pause >nul

:: Stop Node processes
taskkill /F /IM node.exe /T >nul 2>&1

endlocal