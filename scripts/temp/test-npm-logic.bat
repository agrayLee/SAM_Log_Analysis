@echo off
echo ===============================================
echo Test npm Logic - Step by Step
echo ===============================================
echo.

echo [TEST 1] Direct npm check (like migration-deploy-clean.bat):
echo [2/6] Checking npm environment...
npm --version >nul 2>&1
if not errorlevel 1 (
    echo [OK] npm installed
    npm --version
    echo Error level after npm display: %errorlevel%
) else (
    echo [ERROR] npm not available!
    echo This should not happen - npm is working
    pause
    exit /b 1
)

echo.
echo [TEST 2] Next step simulation - Port check:
echo [3/6] Checking port usage...
netstat -an | findstr ":3001" >nul
if errorlevel 1 (
    echo [OK] Port 3001 available
    echo Error level after port check: %errorlevel%
) else (
    echo [WARNING] Port 3001 is occupied
    echo Error level after port check: %errorlevel%
)

echo.
echo [TEST 3] Continue to step 4 simulation:
echo [4/6] Installing project dependencies...
echo This may take several minutes, please wait...
echo.
echo About to run: npm install
echo Current directory: %CD%
echo.

REM Let's see if package.json exists
if exist "package.json" (
    echo [OK] package.json found
    type package.json | findstr "name\|version" | head -3
) else (
    echo [ERROR] package.json not found!
    echo This might be why the script stops
    dir *.json
)

echo.
echo If we got here, the logic is working fine
pause
