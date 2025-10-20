@echo off
REM ===============================================
REM Sam Log System - One-Click Deployment Script
REM Version: v1.4.1 (English Edition)
REM Description: One-click deployment on target computer
REM ===============================================

set DEPLOY_DIR=%~dp0

echo.
echo ===============================================
echo Sam Log System - One-Click Deployment
echo Version: v1.4.1 (English Edition)
echo ===============================================
echo.

echo Welcome to Sam Log System One-Click Deployment Tool
echo.
echo This tool will automatically complete the following operations:
echo [+] Check and install Node.js environment
echo [+] Install system dependencies
echo [+] Verify database integrity
echo [+] Test system functionality
echo [+] Configure startup services
echo.

echo Deployment Directory: %DEPLOY_DIR%
echo Target Computer: %COMPUTERNAME%
echo.

REM Check administrator privileges
net session >nul 2>&1
if errorlevel 1 (
    echo [!] Recommend running with administrator privileges for best experience
    echo     (Right-click this file and select "Run as administrator")
    echo.
    set /p continue_anyway=Continue deployment anyway? (y/n): 
    if /i not "%continue_anyway%"=="y" (
        echo Deployment cancelled
        pause
        exit /b 0
    )
    echo.
)

echo Important Notes:
echo 1. Ensure network connection is stable (for downloading Node.js)
echo 2. Ensure port 3001 is not occupied
echo 3. Do not close this window during deployment
echo 4. The entire process takes approximately 5-15 minutes
echo.

set /p start_deploy=Ready to start deployment? (y/n): 
if /i not "%start_deploy%"=="y" (
    echo Deployment cancelled
    pause
    exit /b 0
)

echo.
echo [*] Starting automatic deployment...
echo ===============================================
echo.

REM Step 1: Node.js environment check and installation
echo [1] Step One: Check Node.js Environment
echo.

node --version >nul 2>&1
if errorlevel 1 (
    echo [X] Node.js not installed, starting automatic installation...
    echo.
    
    if exist "%DEPLOY_DIR%install-nodejs.bat" (
        echo Installing Node.js automatically, please follow prompts...
        call "%DEPLOY_DIR%install-nodejs.bat"
        
        REM Verify installation
        node --version >nul 2>&1
        if errorlevel 1 (
            echo.
            echo [X] Node.js installation failed
            echo.
            echo Please manually install Node.js and rerun this script
            echo 1. Visit https://nodejs.org/
            echo 2. Download and install LTS version
            echo 3. Rerun this script
            echo.
            pause
            exit /b 1
        ) else (
            echo [OK] Node.js installation successful
        )
    ) else (
        echo [X] Missing Node.js installation script
        echo.
        echo Please manually install Node.js
        echo 1. Visit https://nodejs.org/
        echo 2. Download and install LTS version
        echo 3. Rerun this script
        echo.
        pause
        exit /b 1
    )
) else (
    echo [OK] Node.js already installed
    node --version
    call npm --version
)

echo.
echo [Step] Step Two: Run complete deployment script
echo.

if exist "%DEPLOY_DIR%migration-deploy-clean.bat" (
    echo Running detailed deployment script (Clean English version)...
    echo Please follow prompts to complete configuration...
    echo.
    
    call "%DEPLOY_DIR%migration-deploy-clean.bat"
    set DEPLOY_RESULT=%errorlevel%
) else if exist "%DEPLOY_DIR%migration-deploy-simple-en.bat" (
    echo Running detailed deployment script (English version)...
    echo Please follow prompts to complete configuration...
    echo.
    
    call "%DEPLOY_DIR%migration-deploy-simple-en.bat"
    set DEPLOY_RESULT=%errorlevel%
) else if exist "%DEPLOY_DIR%migration-deploy-simple.bat" (
    echo Running detailed deployment script (Chinese version)...
    echo Warning: May encounter encoding issues...
    echo.
    
    call "%DEPLOY_DIR%migration-deploy-simple.bat"
    set DEPLOY_RESULT=%errorlevel%
) else (
    echo [X] Missing deployment script file
    echo.
    echo Please ensure the following files exist:
    echo - migration-deploy-clean.bat (preferred)
    echo - migration-deploy-simple-en.bat
    echo - migration-deploy-simple.bat
    echo - migration-verify.bat
    echo.
    pause
    exit /b 1
)

REM Check deployment result
if %DEPLOY_RESULT% neq 0 (
    echo.
    echo [X] Problems encountered during deployment
    echo.
    echo Possible solutions:
    echo 1. Check network connection
    echo 2. Ensure sufficient disk space
    echo 3. Run with administrator privileges
    echo 4. Check deployment logs for detailed error information
    echo.
    pause
    exit /b 1
)

echo.
echo [Step] Step Three: Verify deployment results
echo.

if exist "%DEPLOY_DIR%migration-verify.bat" (
    echo Verifying system integrity...
    echo.
    
    call "%DEPLOY_DIR%migration-verify.bat"
    
    echo.
    echo Verification completed. Please check verification results.
) else (
    echo [!] Missing verification script, skipping verification step
    echo.
    echo Please manually test the system:
    echo 1. Visit http://localhost:3001
    echo 2. Login with admin/admin123
    echo 3. Test all functions
)

echo.
echo ===============================================
echo [SUCCESS] One-Click Deployment Completed
echo ===============================================
echo.

echo System Information:
echo - Access URL: http://localhost:3001
echo - Login Account: admin / admin123
echo - Deployment Directory: %DEPLOY_DIR%
echo.

echo Next Steps:
echo 1. Test system access: http://localhost:3001
echo 2. Verify login functionality: admin / admin123
echo 3. Test log query functionality
echo 4. Verify "Query Latest" functionality
echo 5. Restart computer to test auto-startup
echo.

echo Management Tools:
if exist "%DEPLOY_DIR%service-manager.bat" (
    echo - Service Management: service-manager.bat
)
if exist "%DEPLOY_DIR%start-service-simple.bat" (
    echo - Start Service: start-service-simple.bat
)
echo - Health Check: npm run health-check
echo.

echo Document References:
if exist "%DEPLOY_DIR%README.md" (
    echo - System Documentation: README.md
)
if exist "%DEPLOY_DIR%MIGRATION_GUIDE.md" (
    echo - Migration Guide: MIGRATION_GUIDE.md
)
if exist "%DEPLOY_DIR%TROUBLESHOOTING.md" (
    echo - Troubleshooting: TROUBLESHOOTING.md
)
echo.

set /p test_now=Test the system now? (y/n): 
if /i "%test_now%"=="y" (
    echo.
    echo Starting system...
    if exist "%DEPLOY_DIR%start-service-simple.bat" (
        start /min "%DEPLOY_DIR%start-service-simple.bat"
        timeout /t 3 >nul
        echo Opening browser...
        start http://localhost:3001
    ) else (
        echo Please manually start service: npm start
    )
)

echo.
echo Thank you for using Sam Log System
echo If you have any issues, please refer to the documentation or contact technical support.
echo.
pause
