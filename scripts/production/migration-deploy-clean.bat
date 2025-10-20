@echo off
REM ===============================================
REM Sam Log System - Clean Deployment Script
REM Version: v1.4.3 (Clean English Edition)
REM ===============================================

set DEPLOY_DIR=%~dp0

echo.
echo ===============================================
echo Sam Log System - Clean Deployment
echo Version: v1.4.3
echo ===============================================
echo.

echo Deployment Time: %date% %time%
echo Target Directory: %DEPLOY_DIR%
echo Target System: %COMPUTERNAME%
echo.

echo Starting deployment checks...
echo.

REM 1. Check Node.js environment
echo [1/6] Checking Node.js environment...
node --version >nul 2>&1
if not errorlevel 1 (
    echo [OK] Node.js installed
    node --version
) else (
    echo [ERROR] Node.js not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM 2. Check npm environment
echo [2/6] Checking npm environment...
call npm --version >nul 2>&1
if not errorlevel 1 (
    echo [OK] npm installed
    call npm --version
) else (
    echo [ERROR] npm not available!
    pause
    exit /b 1
)

REM 3. Check port usage
echo [3/6] Checking port usage...
netstat -an | findstr ":3001" >nul
if errorlevel 1 (
    echo [OK] Port 3001 available
) else (
    echo [WARNING] Port 3001 is occupied
    set /p continue_port=Continue deployment? (y/n): 
    if /i not "%continue_port%"=="y" (
        echo Deployment cancelled
        exit /b 1
    )
)

REM 4. Install project dependencies
echo [4/6] Installing project dependencies...
echo This may take several minutes, please wait...
echo.
call npm install
if not errorlevel 1 (
    echo [OK] Project dependencies installation completed
) else (
    echo [ERROR] Dependency installation failed!
    pause
    exit /b 1
)

REM 5. Check database file
echo [5/6] Checking database file...
if exist "%DEPLOY_DIR%backend\database\sam_logs.db" (
    echo [OK] Database file exists
    for %%I in ("%DEPLOY_DIR%backend\database\sam_logs.db") do set DB_SIZE=%%~zI
    echo Database file size: %DB_SIZE% bytes
) else (
    echo [WARNING] Database file does not exist, initializing...
    call npm run init-db
    if not errorlevel 1 (
        echo [OK] Database initialization completed
    ) else (
        echo [ERROR] Database initialization failed!
        pause
        exit /b 1
    )
)

REM 6. Test service startup
echo [6/6] Testing service startup...
echo Starting service for testing...
start /min "Sam Log System Test" cmd /c "cd /d \"%DEPLOY_DIR%\" && node backend/app.js"
echo Waiting for service startup...
timeout /t 8 >nul

echo Stopping test service...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 >nul

echo.
echo ===============================================
echo [SUCCESS] Deployment Completed!
echo ===============================================
echo.
echo System Information:
echo - Target Computer: %COMPUTERNAME%
echo - Deployment Directory: %DEPLOY_DIR%
echo - Access URL: http://localhost:3001
echo - Default Account: admin / admin123
echo.
echo Next Steps:
echo 1. Start service: npm start or start-service-simple.bat
echo 2. Access system: http://localhost:3001
echo 3. Test functionality and verify all features
echo.

REM Ask if start service immediately
set /p start_now=Start service immediately? (y/n): 
if /i "%start_now%"=="y" (
    echo.
    echo Starting service...
    if exist "%DEPLOY_DIR%start-service-simple.bat" (
        call "%DEPLOY_DIR%start-service-simple.bat"
    ) else (
        echo Please manually run: call npm start
    )
)

echo.
echo Deployment completed! Thank you for using Sam Log System.
pause
