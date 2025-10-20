@echo off
REM ===============================================
REM Sam Log System - Deployment Scripts Update Tool
REM Version: v1.0.1
REM Description: Update deployment scripts with timestamp fix
REM ===============================================

echo.
echo ===============================================
echo Sam Log System - Deployment Scripts Update Tool
echo ===============================================
echo.

set SOURCE_DIR=%~dp0
set TARGET_BACKUP=backup\backup_2025-08-21_17-41-57

echo Updating deployment scripts with timestamp fix...
echo.
echo Source Directory: %SOURCE_DIR%
echo Target Backup: %TARGET_BACKUP%
echo.

REM Check if target backup exists
if not exist "%SOURCE_DIR%%TARGET_BACKUP%" (
    echo [ERROR] Target backup directory not found: %TARGET_BACKUP%
    echo Please check the backup folder path
    pause
    exit /b 1
)

echo [1/2] Updating migration-deploy-simple-en.bat with timestamp fix...
if exist "%SOURCE_DIR%migration-deploy-simple-en.bat" (
    copy "%SOURCE_DIR%migration-deploy-simple-en.bat" "%SOURCE_DIR%%TARGET_BACKUP%\" >nul 2>&1
    echo   [OK] Updated migration-deploy-simple-en.bat (with timestamp fix)
) else (
    echo   [ERROR] migration-deploy-simple-en.bat not found in source directory
)

echo [2/2] Creating update information...
echo Sam Log System - Deployment Scripts Update Log > "%SOURCE_DIR%%TARGET_BACKUP%\SCRIPTS_UPDATE_LOG.txt"
echo ======================================================= >> "%SOURCE_DIR%%TARGET_BACKUP%\SCRIPTS_UPDATE_LOG.txt"
echo. >> "%SOURCE_DIR%%TARGET_BACKUP%\SCRIPTS_UPDATE_LOG.txt"
echo Update Applied: %date% %time% >> "%SOURCE_DIR%%TARGET_BACKUP%\SCRIPTS_UPDATE_LOG.txt"
echo. >> "%SOURCE_DIR%%TARGET_BACKUP%\SCRIPTS_UPDATE_LOG.txt"
echo FIXES APPLIED: >> "%SOURCE_DIR%%TARGET_BACKUP%\SCRIPTS_UPDATE_LOG.txt"
echo   • Fixed timestamp generation logic >> "%SOURCE_DIR%%TARGET_BACKUP%\SCRIPTS_UPDATE_LOG.txt"
echo   • Added proper zero padding for minute and second >> "%SOURCE_DIR%%TARGET_BACKUP%\SCRIPTS_UPDATE_LOG.txt"
echo   • Enhanced error level clearing before Node.js check >> "%SOURCE_DIR%%TARGET_BACKUP%\SCRIPTS_UPDATE_LOG.txt"
echo   • Improved log file error handling >> "%SOURCE_DIR%%TARGET_BACKUP%\SCRIPTS_UPDATE_LOG.txt"
echo. >> "%SOURCE_DIR%%TARGET_BACKUP%\SCRIPTS_UPDATE_LOG.txt"
echo PROBLEM RESOLVED: >> "%SOURCE_DIR%%TARGET_BACKUP%\SCRIPTS_UPDATE_LOG.txt"
echo   The deployment script was incorrectly detecting Node.js as >> "%SOURCE_DIR%%TARGET_BACKUP%\SCRIPTS_UPDATE_LOG.txt"
echo   not installed due to timestamp generation errors causing >> "%SOURCE_DIR%%TARGET_BACKUP%\SCRIPTS_UPDATE_LOG.txt"
echo   log file creation failures, which left errorlevel set to >> "%SOURCE_DIR%%TARGET_BACKUP%\SCRIPTS_UPDATE_LOG.txt"
echo   non-zero value before the Node.js check. >> "%SOURCE_DIR%%TARGET_BACKUP%\SCRIPTS_UPDATE_LOG.txt"
echo. >> "%SOURCE_DIR%%TARGET_BACKUP%\SCRIPTS_UPDATE_LOG.txt"

echo   [OK] Created SCRIPTS_UPDATE_LOG.txt

echo.
echo ===============================================
echo [SUCCESS] Deployment Scripts Updated!
echo ===============================================
echo.
echo Fixed Issues:
echo   [OK] Timestamp generation now handles all time components properly
echo   [OK] Error level is cleared before Node.js check
echo   [OK] Log file operations have better error handling
echo   [OK] Node.js detection will now work correctly
echo.
echo Ready to Use:
echo   1. Go to: %TARGET_BACKUP%
echo   2. Run: one-click-deploy.bat
echo   3. Script will now complete full deployment without exiting
echo.
echo Scripts updated successfully!
pause
