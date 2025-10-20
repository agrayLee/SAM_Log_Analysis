@echo off
REM ===============================================
REM Sam Log System - Create Clean Deployment Package
REM Version: v1.0.0
REM Description: Copy only essential scripts for deployment
REM ===============================================

echo.
echo ===============================================
echo Sam Log System - Create Clean Deployment Package
echo ===============================================
echo.

set SOURCE_DIR=%~dp0
set TARGET_DIR=%SOURCE_DIR%deployment-package
set BACKUP_SOURCE=backup\backup_2025-08-21_17-41-57

echo Creating clean deployment package...
echo.
echo Source: %BACKUP_SOURCE%
echo Target: %TARGET_DIR%
echo.

REM Create target directory
if exist "%TARGET_DIR%" (
    echo Cleaning existing deployment package...
    rd /s /q "%TARGET_DIR%"
)
mkdir "%TARGET_DIR%"

REM Copy essential production scripts only
echo [1/4] Copying core deployment scripts...
copy "%SOURCE_DIR%%BACKUP_SOURCE%\one-click-deploy.bat" "%TARGET_DIR%\" >nul 2>&1
copy "%SOURCE_DIR%%BACKUP_SOURCE%\migration-deploy-clean.bat" "%TARGET_DIR%\" >nul 2>&1
copy "%SOURCE_DIR%%BACKUP_SOURCE%\migration-deploy-simple-en.bat" "%TARGET_DIR%\" >nul 2>&1
copy "%SOURCE_DIR%%BACKUP_SOURCE%\migration-deploy-simple.bat" "%TARGET_DIR%\" >nul 2>&1
echo   ✓ Core deployment scripts copied

echo [2/4] Copying management scripts...
copy "%SOURCE_DIR%%BACKUP_SOURCE%\migration-backup-en.bat" "%TARGET_DIR%\" >nul 2>&1
copy "%SOURCE_DIR%%BACKUP_SOURCE%\migration-verify.bat" "%TARGET_DIR%\" >nul 2>&1
copy "%SOURCE_DIR%%BACKUP_SOURCE%\start-service-simple.bat" "%TARGET_DIR%\" >nul 2>&1
copy "%SOURCE_DIR%%BACKUP_SOURCE%\deploy-check-simple.bat" "%TARGET_DIR%\" >nul 2>&1
copy "%SOURCE_DIR%%BACKUP_SOURCE%\service-manager.bat" "%TARGET_DIR%\" >nul 2>&1
echo   ✓ Management scripts copied

echo [3/4] Copying installation scripts...
copy "%SOURCE_DIR%%BACKUP_SOURCE%\install-nodejs.bat" "%TARGET_DIR%\" >nul 2>&1
copy "%SOURCE_DIR%%BACKUP_SOURCE%\install-task-scheduler.bat" "%TARGET_DIR%\" >nul 2>&1
copy "%SOURCE_DIR%%BACKUP_SOURCE%\install-windows-service.bat" "%TARGET_DIR%\" >nul 2>&1
echo   ✓ Installation scripts copied

echo [4/4] Copying project files...
if exist "%SOURCE_DIR%%BACKUP_SOURCE%\package.json" (
    copy "%SOURCE_DIR%%BACKUP_SOURCE%\package.json" "%TARGET_DIR%\" >nul 2>&1
    echo   ✓ package.json copied
)
if exist "%SOURCE_DIR%%BACKUP_SOURCE%\ecosystem.config.js" (
    copy "%SOURCE_DIR%%BACKUP_SOURCE%\ecosystem.config.js" "%TARGET_DIR%\" >nul 2>&1
    echo   ✓ ecosystem.config.js copied
)

REM Copy directories
echo Copying directories...
if exist "%SOURCE_DIR%%BACKUP_SOURCE%\backend" (
    xcopy "%SOURCE_DIR%%BACKUP_SOURCE%\backend" "%TARGET_DIR%\backend\" /E /I /Q >nul 2>&1
    echo   ✓ backend directory copied
)
if exist "%SOURCE_DIR%%BACKUP_SOURCE%\frontend" (
    xcopy "%SOURCE_DIR%%BACKUP_SOURCE%\frontend" "%TARGET_DIR%\frontend\" /E /I /Q >nul 2>&1
    echo   ✓ frontend directory copied
)
if exist "%SOURCE_DIR%%BACKUP_SOURCE%\database" (
    xcopy "%SOURCE_DIR%%BACKUP_SOURCE%\database" "%TARGET_DIR%\database\" /E /I /Q >nul 2>&1
    echo   ✓ database directory copied
)

REM Create deployment instructions
echo Creating deployment instructions...
echo Sam Log System - Clean Deployment Package > "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo =========================================== >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo. >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo USAGE INSTRUCTIONS: >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo. >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo 1. QUICK START: >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo    Right-click one-click-deploy.bat and select "Run as administrator" >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo. >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo 2. SCRIPT PRIORITY: >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo    - one-click-deploy.bat will automatically choose: >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo      1st: migration-deploy-clean.bat (recommended) >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo      2nd: migration-deploy-simple-en.bat (backup) >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo      3rd: migration-deploy-simple.bat (last resort) >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo. >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo 3. INCLUDED SCRIPTS: >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo    - one-click-deploy.bat: Main deployment entry point >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo    - migration-deploy-clean.bat: Core deployment logic (fixed npm calls) >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo    - start-service-simple.bat: Start the service >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo    - migration-verify.bat: Verify deployment >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo    - Other support scripts for installation and management >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo. >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo 4. EXCLUDED (Debug scripts not needed for production): >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo    - debug-*.bat, test-*.bat, npm-*-test.bat >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo    - fix-*.bat, update-*.bat (one-time repair tools) >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo. >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo Package created: %date% %time% >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"
echo. >> "%TARGET_DIR%\DEPLOYMENT_INSTRUCTIONS.txt"

echo.
echo ===============================================
echo [SUCCESS] Clean Deployment Package Created!
echo ===============================================
echo.
echo Package Location: %TARGET_DIR%
echo.
echo Package Contents:
dir "%TARGET_DIR%\*.bat" /b
echo.
echo Instructions: See DEPLOYMENT_INSTRUCTIONS.txt in package
echo.
echo RECOMMENDATION: 
echo Use this clean package for production deployments
echo It contains only essential scripts without debug files
echo.
pause
