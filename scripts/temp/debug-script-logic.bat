@echo off
echo ===============================================
echo Debug Script Logic - Step by Step
echo ===============================================
echo.

echo [STEP 1] Setting up variables like migration-deploy-simple-en.bat
set DEPLOY_DIR=%~dp0

REM Generate timestamp with proper zero padding (copied from script)
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

echo DEPLOY_DIR=%DEPLOY_DIR%
echo TIMESTAMP=%TIMESTAMP%
echo LOG_FILE=%LOG_FILE%
echo.

echo [STEP 2] Creating log directory and file
if not exist "%DEPLOY_DIR%logs" mkdir "%DEPLOY_DIR%logs"

echo [%date% %time%] Starting simplified deployment to %COMPUTERNAME% > "%LOG_FILE%"
if errorlevel 1 (
    echo [ERROR] Failed to create log file!
    echo Error level after log creation: %errorlevel%
) else (
    echo [OK] Log file created successfully
    echo Error level after log creation: %errorlevel%
)
echo.

echo [STEP 3] Testing Node.js check logic (exact copy from script)
REM Clear error level before checking
ver >nul
echo Error level after VER command: %errorlevel%

node --version >nul 2>&1
set NODE_CHECK_RESULT=%errorlevel%
echo Error level after node --version: %NODE_CHECK_RESULT%

if errorlevel 1 (
    echo [RESULT] Script would think Node.js is NOT installed
    echo [PROBLEM] This is the bug!
) else (
    echo [RESULT] Script should think Node.js IS installed
    echo [SUCCESS] Logic appears correct
)
echo.

pause
