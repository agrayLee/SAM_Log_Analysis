@echo off
set DEPLOY_DIR=%~dp0

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 exit /b 1

REM Check npm  
call npm --version >nul 2>&1
if errorlevel 1 exit /b 1

REM Check port
netstat -an | findstr ":3001" >nul
if not errorlevel 1 (
    set /p continue_port=Port 3001 occupied. Continue? (y/n): 
    if /i not "%continue_port%"=="y" exit /b 1
)

REM Install dependencies
call npm install
if errorlevel 1 exit /b 1

REM Check database
if not exist "%DEPLOY_DIR%backend\database\sam_logs.db" (
    call npm run init-db
    if errorlevel 1 exit /b 1
)

REM Test service
start /min "Test" cmd /c "cd /d \"%DEPLOY_DIR%\" && node backend/app.js"
timeout /t 8 >nul
taskkill /f /im node.exe >nul 2>&1

exit /b 0
