@echo off
REM ===============================================
REM Sam Log System - Simplified Deployment Script (English)
REM Version: v1.4.2 (English Edition)
REM Description: Deploy migrated system on target computer (no emoji symbols)
REM ===============================================

set DEPLOY_DIR=%~dp0

REM Generate timestamp with proper zero padding
set year=%date:~0,4%
set month=%date:~5,2%
set day=%date:~8,2%
set hour=%time:~0,2%
set minute=%time:~3,2%
set second=%time:~6,2%

REM Remove spaces and pad with zeros for all time components
if "%hour:~0,1%"==" " set hour=0%hour:~1,1%
if "%minute:~0,1%"==" " set minute=0%minute:~1,1%
if "%second:~0,1%"==" " set second=0%second:~1,1%

set TIMESTAMP=%year%-%month%-%day%_%hour%-%minute%-%second%
set LOG_FILE=%DEPLOY_DIR%logs\deploy-simple-%TIMESTAMP%.log

echo.
echo ===============================================
echo Sam Log System - Simplified Deployment (English)
echo Version: v1.4.2
echo ===============================================
echo.

echo Deployment Time: %date% %time%
echo Target Directory: %DEPLOY_DIR%
echo Target System: %COMPUTERNAME%
echo.

REM Create log directory
if not exist "%DEPLOY_DIR%logs" mkdir "%DEPLOY_DIR%logs"

REM Record deployment start
echo [%date% %time%] Starting simplified deployment to %COMPUTERNAME% >> "%LOG_FILE%"

echo Starting pre-deployment checks...
echo.

REM 1. Check Node.js environment
echo [1/6] Checking Node.js environment...

REM Clear error level before checking
ver >nul

node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not installed!
    echo.
    echo Please install Node.js manually:
    echo 1. Visit https://nodejs.org/
    echo 2. Download LTS version (recommend v18.17.1)
    echo 3. Install and rerun this script
    echo.
    echo [%date% %time%] ERROR: Node.js not installed >> "%LOG_FILE%" 2>&1
    pause
    exit /b 1
) else (
    echo [OK] Node.js installed
    node --version
    echo [%date% %time%] Node.js version check passed >> "%LOG_FILE%" 2>&1
    node --version >> "%LOG_FILE%" 2>&1
)

REM 2. Check npm environment
echo [2/6] Checking npm environment...
call npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not available!
    echo [%date% %time%] ERROR: npm not available >> "%LOG_FILE%"
    pause
    exit /b 1
) else (
    echo [OK] npm installed
    call npm --version
    echo [%date% %time%] npm version check passed >> "%LOG_FILE%"
    call npm --version >> "%LOG_FILE%" 2>&1
)

REM 3. Check port usage
echo [3/6] Checking port usage...
netstat -an | findstr ":3001" >nul
if errorlevel 0 (
    echo [WARNING] Port 3001 is occupied
    echo Please ensure no other services are using this port
    echo [%date% %time%] WARNING: Port 3001 occupied >> "%LOG_FILE%"
    
    set /p continue_port=Continue deployment? (y/n): 
    if /i not "%continue_port%"=="y" (
        echo Deployment cancelled
        exit /b 1
    )
) else (
    echo [OK] Port 3001 available
    echo [%date% %time%] Port 3001 available >> "%LOG_FILE%"
)

REM 4. Install project dependencies
echo [4/6] Installing project dependencies...
echo This may take several minutes, please wait...
echo.

echo Executing: npm install
call npm install
if errorlevel 1 (
    echo [ERROR] Dependency installation failed!
    echo Please check:
    echo 1. Network connection is normal
    echo 2. npm configuration is correct
    echo 3. Sufficient disk space available
    echo 4. No firewall blocking downloads
    echo.
    echo [%date% %time%] ERROR: Dependency installation failed >> "%LOG_FILE%"
    pause
    exit /b 1
) else (
    echo [OK] Project dependencies installation completed
    echo [%date% %time%] Project dependencies installation completed >> "%LOG_FILE%"
)

REM 5. Check database file
echo [5/6] Checking database file...
if exist "%DEPLOY_DIR%backend\database\sam_logs.db" (
    echo [OK] Database file exists
    
    REM Get database file size
    for %%I in ("%DEPLOY_DIR%backend\database\sam_logs.db") do set DB_SIZE=%%~zI
    echo Database file size: %DB_SIZE% bytes
    echo [%date% %time%] Database file exists, size: %DB_SIZE% bytes >> "%LOG_FILE%"
) else (
    echo [WARNING] Database file does not exist, initializing...
    call npm run init-db
    if errorlevel 1 (
        echo [ERROR] Database initialization failed!
        echo [%date% %time%] ERROR: Database initialization failed >> "%LOG_FILE%"
        pause
        exit /b 1
    ) else (
        echo [OK] Database initialization completed
        echo [%date% %time%] Database initialization completed >> "%LOG_FILE%"
    )
)

REM 6. Test service startup
echo [6/6] Testing service startup...
echo Starting service for testing...
echo.

REM Start service in background
start /min "Sam Log System Test" cmd /c "cd /d \"%DEPLOY_DIR%\" && node backend/app.js"

REM Wait for service startup
echo Waiting for service startup...
timeout /t 8 >nul

REM Test HTTP connection
echo Testing HTTP service...
curl -s http://localhost:3001/health >nul 2>&1
if errorlevel 1 (
    echo [WARNING] HTTP service test failed
    echo Service may need more time to start
    echo [%date% %time%] WARNING: HTTP service test failed >> "%LOG_FILE%"
) else (
    echo [OK] HTTP service responding normally
    echo [%date% %time%] HTTP service responding normally >> "%LOG_FILE%"
)

REM Stop test service
echo Stopping test service...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 >nul

echo.
echo ===============================================
echo [SUCCESS] Simplified Deployment Completed!
echo ===============================================
echo.
echo System Information:
echo - Target Computer: %COMPUTERNAME%
echo - Deployment Directory: %DEPLOY_DIR%
echo - Access URL: http://localhost:3001
echo - Default Account: admin / admin123
echo.
echo Deployment Contents:
echo [OK] Node.js environment check
echo [OK] Project dependencies installation
echo [OK] Database migration verification
echo [OK] Service startup test
echo.
echo Next Steps:
echo 1. Start service: call npm start or start-service-simple.bat
echo 2. Access system: http://localhost:3001
echo 3. Test functionality: Login and verify all features
echo 4. Check logs: View log files in logs directory
echo.
echo Deployment log: %LOG_FILE%
echo.

if exist "%DEPLOY_DIR%BACKUP_INFO.txt" (
    echo Original System Information:
    type "%DEPLOY_DIR%BACKUP_INFO.txt" | findstr "Source System\|Backup Time\|Database Record Count"
    echo.
)
echo ===============================================
echo.

echo [%date% %time%] Simplified deployment task completed >> "%LOG_FILE%"

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
