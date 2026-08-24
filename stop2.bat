@echo off
net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo Stopping Node.js server...
taskkill /F /IM node.exe /T
echo Server stopped successfully!
timeout /t 2 > nul