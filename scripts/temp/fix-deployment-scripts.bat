@echo off
REM ===============================================
REM Sam Log System - Deployment Scripts Fix Tool
REM Version: v1.0.0
REM Description: Copy English versions to backup directory
REM ===============================================

echo.
echo ===============================================
echo Sam Log System - Deployment Scripts Fix Tool
echo ===============================================
echo.

set SOURCE_DIR=%~dp0
set TARGET_BACKUP=backup\backup_2025-08-21_17-41-57

echo Fixing deployment scripts in backup directory...
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

echo [1/3] Copying English deployment script...
if exist "%SOURCE_DIR%migration-deploy-simple-en.bat" (
    copy "%SOURCE_DIR%migration-deploy-simple-en.bat" "%SOURCE_DIR%%TARGET_BACKUP%\" >nul 2>&1
    echo   [OK] Copied migration-deploy-simple-en.bat
) else (
    echo   [ERROR] migration-deploy-simple-en.bat not found in source directory
)

echo [2/3] Copying fixed one-click deploy script...
if exist "%SOURCE_DIR%one-click-deploy-fixed.bat" (
    copy "%SOURCE_DIR%one-click-deploy-fixed.bat" "%SOURCE_DIR%%TARGET_BACKUP%\" >nul 2>&1
    copy "%SOURCE_DIR%one-click-deploy-fixed.bat" "%SOURCE_DIR%%TARGET_BACKUP%\one-click-deploy.bat" >nul 2>&1
    echo   [OK] Copied one-click-deploy-fixed.bat and overwrote one-click-deploy.bat
) else (
    echo   [ERROR] one-click-deploy-fixed.bat not found in source directory
)

echo [3/3] Creating usage instructions...
echo Sam Log System - Fixed Scripts Usage Instructions > "%SOURCE_DIR%%TARGET_BACKUP%\FIXED_SCRIPTS_INFO.txt"
echo ========================================================= >> "%SOURCE_DIR%%TARGET_BACKUP%\FIXED_SCRIPTS_INFO.txt"
echo. >> "%SOURCE_DIR%%TARGET_BACKUP%\FIXED_SCRIPTS_INFO.txt"
echo This backup has been updated with fixed English scripts to >> "%SOURCE_DIR%%TARGET_BACKUP%\FIXED_SCRIPTS_INFO.txt"
echo resolve encoding and exit issues. >> "%SOURCE_DIR%%TARGET_BACKUP%\FIXED_SCRIPTS_INFO.txt"
echo. >> "%SOURCE_DIR%%TARGET_BACKUP%\FIXED_SCRIPTS_INFO.txt"
echo New Scripts Added: >> "%SOURCE_DIR%%TARGET_BACKUP%\FIXED_SCRIPTS_INFO.txt"
echo   • migration-deploy-simple-en.bat - English deployment script >> "%SOURCE_DIR%%TARGET_BACKUP%\FIXED_SCRIPTS_INFO.txt"
echo   • one-click-deploy.bat (updated) - Fixed one-click deployment >> "%SOURCE_DIR%%TARGET_BACKUP%\FIXED_SCRIPTS_INFO.txt"
echo. >> "%SOURCE_DIR%%TARGET_BACKUP%\FIXED_SCRIPTS_INFO.txt"
echo Recommended Usage: >> "%SOURCE_DIR%%TARGET_BACKUP%\FIXED_SCRIPTS_INFO.txt"
echo   1. Use one-click-deploy.bat for full automatic deployment >> "%SOURCE_DIR%%TARGET_BACKUP%\FIXED_SCRIPTS_INFO.txt"
echo   2. The script will now prefer English versions automatically >> "%SOURCE_DIR%%TARGET_BACKUP%\FIXED_SCRIPTS_INFO.txt"
echo   3. No more encoding issues or unexpected exits >> "%SOURCE_DIR%%TARGET_BACKUP%\FIXED_SCRIPTS_INFO.txt"
echo. >> "%SOURCE_DIR%%TARGET_BACKUP%\FIXED_SCRIPTS_INFO.txt"
echo Fix Applied: %date% %time% >> "%SOURCE_DIR%%TARGET_BACKUP%\FIXED_SCRIPTS_INFO.txt"
echo. >> "%SOURCE_DIR%%TARGET_BACKUP%\FIXED_SCRIPTS_INFO.txt"

echo   [OK] Created FIXED_SCRIPTS_INFO.txt

echo.
echo ===============================================
echo [SUCCESS] Deployment Scripts Fixed!
echo ===============================================
echo.
echo Fixed backup directory: %TARGET_BACKUP%
echo.
echo What was fixed:
echo   [OK] Added English deployment script (migration-deploy-simple-en.bat)
echo   [OK] Updated one-click deployment to prefer English versions
echo   [OK] Fixed syntax errors that caused unexpected exits
echo   [OK] Resolved encoding issues with Chinese characters
echo.
echo Next Steps:
echo   1. Go to your backup directory: %TARGET_BACKUP%
echo   2. Run: one-click-deploy.bat
echo   3. The script will now run completely without exiting early
echo.
echo Available scripts in backup:
dir "%SOURCE_DIR%%TARGET_BACKUP%\*.bat" /b 2>nul

echo.
echo Scripts fix completed!
pause
