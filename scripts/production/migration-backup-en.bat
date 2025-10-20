@echo off
REM ===============================================
REM Sam Log System - Migration Backup Script
REM Version: v1.4.1 (English Edition)
REM Description: Backup system data, configs and scripts
REM ===============================================

set PROJECT_DIR=%~dp0

REM Safe timestamp generation - Fixed date format issue
set year=%date:~0,4%
set month=%date:~5,2%
set day=%date:~8,2%
set hour=%time:~0,2%
set minute=%time:~3,2%
set second=%time:~6,2%

REM Remove spaces and pad zeros
if "%hour:~0,1%"==" " set hour=0%hour:~1,1%
if "%minute:~0,1%"==" " set minute=0%minute:~1,1%
if "%second:~0,1%"==" " set second=0%second:~1,1%

REM Generate standard timestamp format (YYYY-MM-DD_HH-MM-SS)
set TIMESTAMP=%year%-%month%-%day%_%hour%-%minute%-%second%
set BACKUP_DIR=%PROJECT_DIR%backup\backup_%TIMESTAMP%
set LOG_FILE=%PROJECT_DIR%logs\backup-%TIMESTAMP%.log

echo.
echo ===============================================
echo Sam Log System - Migration Backup
echo Version: v1.4.1 (English Edition)
echo ===============================================
echo.

echo Backup Time: %date% %time%
echo Project Dir: %PROJECT_DIR%
echo Backup Dir: %BACKUP_DIR%
echo Log File: %LOG_FILE%
echo.

REM Create backup directories
if not exist "%PROJECT_DIR%backup" mkdir "%PROJECT_DIR%backup"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
if not exist "%PROJECT_DIR%logs" mkdir "%PROJECT_DIR%logs"

REM Record backup start
echo [%date% %time%] Starting system backup >> "%LOG_FILE%"
echo [%date% %time%] Backup directory: %BACKUP_DIR% >> "%LOG_FILE%"

echo Starting system file backup...
echo.

REM 1. Backup database files
echo [1/8] Backing up database files...
if exist "%PROJECT_DIR%backend\database" (
    xcopy "%PROJECT_DIR%backend\database" "%BACKUP_DIR%\database\" /E /I /Q /Y
    if errorlevel 1 (
        echo WARNING: Database backup may be incomplete
        echo [%date% %time%] WARNING: Database backup failed >> "%LOG_FILE%"
    ) else (
        echo Database backup completed
        echo [%date% %time%] Database backup completed >> "%LOG_FILE%"
    )
) else (
    echo WARNING: Database directory does not exist
    echo [%date% %time%] WARNING: Database directory not found >> "%LOG_FILE%"
)

REM 2. Backup backend code
echo [2/8] Backing up backend code...
if exist "%PROJECT_DIR%backend" (
    xcopy "%PROJECT_DIR%backend" "%BACKUP_DIR%\backend\" /E /I /Q /Y /EXCLUDE:%PROJECT_DIR%backup-exclude.txt
    if errorlevel 1 (
        echo WARNING: Backend code backup may be incomplete
        echo [%date% %time%] WARNING: Backend backup failed >> "%LOG_FILE%"
    ) else (
        echo Backend code backup completed
        echo [%date% %time%] Backend backup completed >> "%LOG_FILE%"
    )
)

REM 3. Backup frontend code
echo [3/8] Backing up frontend code...
if exist "%PROJECT_DIR%frontend" (
    xcopy "%PROJECT_DIR%frontend" "%BACKUP_DIR%\frontend\" /E /I /Q /Y /EXCLUDE:%PROJECT_DIR%backup-exclude.txt
    if errorlevel 1 (
        echo WARNING: Frontend code backup may be incomplete
        echo [%date% %time%] WARNING: Frontend backup failed >> "%LOG_FILE%"
    ) else (
        echo Frontend code backup completed
        echo [%date% %time%] Frontend backup completed >> "%LOG_FILE%"
    )
)

REM 4. Backup configuration files
echo [4/8] Backing up configuration files...
copy "%PROJECT_DIR%package.json" "%BACKUP_DIR%\" >nul 2>&1
copy "%PROJECT_DIR%package-lock.json" "%BACKUP_DIR%\" >nul 2>&1
copy "%PROJECT_DIR%ecosystem.config.js" "%BACKUP_DIR%\" >nul 2>&1
if exist "%PROJECT_DIR%.env" copy "%PROJECT_DIR%.env" "%BACKUP_DIR%\" >nul 2>&1
echo Configuration files backup completed
echo [%date% %time%] Configuration backup completed >> "%LOG_FILE%"

REM 5. Backup startup and migration scripts
echo [5/8] Backing up startup and migration scripts...

REM ===== COMPLETE PRODUCTION SCRIPTS BACKUP =====
echo   Backing up ALL essential production scripts...

REM 1. Main entry point - CRITICAL
if exist "%PROJECT_DIR%one-click-deploy.bat" (
    copy "%PROJECT_DIR%one-click-deploy.bat" "%BACKUP_DIR%\" >nul 2>&1
    echo   [OK] one-click-deploy.bat (Main entry point - CRITICAL)
) else if exist "%PROJECT_DIR%one-click-deploy-fixed.bat" (
    copy "%PROJECT_DIR%one-click-deploy-fixed.bat" "%BACKUP_DIR%\one-click-deploy.bat" >nul 2>&1
    echo   [OK] one-click-deploy.bat (from fixed version)
) else (
    echo   [ERROR] one-click-deploy.bat not found - DEPLOYMENT WILL FAIL!
)

REM 2. Core deployment scripts - CRITICAL
if exist "%PROJECT_DIR%migration-deploy-clean.bat" (
    copy "%PROJECT_DIR%migration-deploy-clean.bat" "%BACKUP_DIR%\" >nul 2>&1
    echo   [OK] migration-deploy-clean.bat (PREFERRED - npm issues fixed)
) else (
    echo   [ERROR] migration-deploy-clean.bat not found - CRITICAL!
)

if exist "%PROJECT_DIR%migration-deploy-simple-en.bat" (
    copy "%PROJECT_DIR%migration-deploy-simple-en.bat" "%BACKUP_DIR%\" >nul 2>&1
    echo   [OK] migration-deploy-simple-en.bat (English backup)
) else (
    echo   [WARNING] migration-deploy-simple-en.bat not found
)

if exist "%PROJECT_DIR%migration-deploy-simple.bat" (
    copy "%PROJECT_DIR%migration-deploy-simple.bat" "%BACKUP_DIR%\" >nul 2>&1
    echo   [OK] migration-deploy-simple.bat (Chinese backup)
) else (
    echo   [WARNING] migration-deploy-simple.bat not found
)

REM 3. Management scripts - ESSENTIAL
if exist "%PROJECT_DIR%migration-backup-en.bat" (
    copy "%PROJECT_DIR%migration-backup-en.bat" "%BACKUP_DIR%\" >nul 2>&1
    echo   [OK] migration-backup-en.bat (Backup script)
) else (
    echo   [WARNING] migration-backup-en.bat not found
)

if exist "%PROJECT_DIR%migration-verify.bat" (
    copy "%PROJECT_DIR%migration-verify.bat" "%BACKUP_DIR%\" >nul 2>&1
    echo   [OK] migration-verify.bat (Verification script)
) else (
    echo   [WARNING] migration-verify.bat not found
)

if exist "%PROJECT_DIR%start-service-simple.bat" (
    copy "%PROJECT_DIR%start-service-simple.bat" "%BACKUP_DIR%\" >nul 2>&1
    echo   [OK] start-service-simple.bat (Service startup)
) else (
    echo   [WARNING] start-service-simple.bat not found
)

if exist "%PROJECT_DIR%deploy-check-simple.bat" (
    copy "%PROJECT_DIR%deploy-check-simple.bat" "%BACKUP_DIR%\" >nul 2>&1
    echo   [OK] deploy-check-simple.bat (Pre-deployment check)
) else (
    echo   [WARNING] deploy-check-simple.bat not found
)

if exist "%PROJECT_DIR%service-manager.bat" (
    copy "%PROJECT_DIR%service-manager.bat" "%BACKUP_DIR%\" >nul 2>&1
    echo   [OK] service-manager.bat (Service management)
) else (
    echo   [WARNING] service-manager.bat not found
)

REM 4. Installation scripts - ESSENTIAL
if exist "%PROJECT_DIR%install-nodejs.bat" (
    copy "%PROJECT_DIR%install-nodejs.bat" "%BACKUP_DIR%\" >nul 2>&1
    echo   [OK] install-nodejs.bat (Node.js installer)
) else (
    echo   [WARNING] install-nodejs.bat not found
)

if exist "%PROJECT_DIR%install-task-scheduler.bat" (
    copy "%PROJECT_DIR%install-task-scheduler.bat" "%BACKUP_DIR%\" >nul 2>&1
    echo   [OK] install-task-scheduler.bat (Task scheduler setup)
) else (
    echo   [WARNING] install-task-scheduler.bat not found
)

if exist "%PROJECT_DIR%install-windows-service.bat" (
    copy "%PROJECT_DIR%install-windows-service.bat" "%BACKUP_DIR%\" >nul 2>&1
    echo   [OK] install-windows-service.bat (Windows service setup)
) else (
    echo   [WARNING] install-windows-service.bat not found
)

REM 5. Support files
if exist "%PROJECT_DIR%backup-exclude.txt" (
    copy "%PROJECT_DIR%backup-exclude.txt" "%BACKUP_DIR%\" >nul 2>&1
    echo   [OK] backup-exclude.txt (Backup configuration)
)

REM 6. Check if copying from scripts\production folder
if exist "%PROJECT_DIR%scripts\production\one-click-deploy.bat" (
    echo   [INFO] Found organized scripts in scripts\production folder
    copy "%PROJECT_DIR%scripts\production\*.bat" "%BACKUP_DIR%\" >nul 2>&1
    echo   [OK] Copied all scripts from scripts\production folder
)

echo Startup and migration scripts backup completed
echo [%date% %time%] Scripts backup completed >> "%LOG_FILE%"

REM 6. Backup documentation files
echo [6/8] Backing up documentation files...
copy "%PROJECT_DIR%README.md" "%BACKUP_DIR%\" >nul 2>&1
copy "%PROJECT_DIR%AUTO_START_GUIDE.md" "%BACKUP_DIR%\" >nul 2>&1
copy "%PROJECT_DIR%QUICK_START_AUTOSTART.md" "%BACKUP_DIR%\" >nul 2>&1
copy "%PROJECT_DIR%TROUBLESHOOTING.md" "%BACKUP_DIR%\" >nul 2>&1
copy "%PROJECT_DIR%MIGRATION_GUIDE.md" "%BACKUP_DIR%\" >nul 2>&1
copy "%PROJECT_DIR%QUICK_MIGRATION_CHECKLIST.md" "%BACKUP_DIR%\" >nul 2>&1
copy "%PROJECT_DIR%SYSTEM_ANALYSIS_REPORT.md" "%BACKUP_DIR%\" >nul 2>&1
if exist "%PROJECT_DIR%docs" xcopy "%PROJECT_DIR%docs" "%BACKUP_DIR%\docs\" /E /I /Q /Y >nul 2>&1
echo Documentation files backup completed
echo [%date% %time%] Documentation backup completed >> "%LOG_FILE%"

REM 7. Backup tool scripts
echo [7/8] Backing up tool scripts...
if exist "%PROJECT_DIR%tools" (
    xcopy "%PROJECT_DIR%tools" "%BACKUP_DIR%\tools\" /E /I /Q /Y
    echo Tool scripts backup completed
    echo [%date% %time%] Tools backup completed >> "%LOG_FILE%"
)

REM 8. Backup important logs (optional)
echo [8/8] Backing up important logs...
set /p backup_logs=Do you want to backup log files? (y/n): 
if /i "%backup_logs%"=="y" (
    if exist "%PROJECT_DIR%logs" (
        xcopy "%PROJECT_DIR%logs" "%BACKUP_DIR%\logs\" /E /I /Q /Y
        echo Log files backup completed
        echo [%date% %time%] Logs backup completed >> "%LOG_FILE%"
    )
) else (
    echo Skipping log files backup
    echo [%date% %time%] Logs backup skipped >> "%LOG_FILE%"
)

REM Generate system information file
echo Generating system information...
echo System Backup Information > "%BACKUP_DIR%\BACKUP_INFO.txt"
echo Backup Time: %date% %time% >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo Source System: %COMPUTERNAME% >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo Operating System: >> "%BACKUP_DIR%\BACKUP_INFO.txt"
ver >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo. >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo Node.js Version: >> "%BACKUP_DIR%\BACKUP_INFO.txt"
node --version >> "%BACKUP_DIR%\BACKUP_INFO.txt" 2>&1
echo. >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo npm Version: >> "%BACKUP_DIR%\BACKUP_INFO.txt"
call npm --version >> "%BACKUP_DIR%\BACKUP_INFO.txt" 2>&1
echo. >> "%BACKUP_DIR%\BACKUP_INFO.txt"

REM Generate database statistics
echo Generating database statistics...
if exist "%PROJECT_DIR%backend\database\sam_logs.db" (
    echo Database File Size: >> "%BACKUP_DIR%\BACKUP_INFO.txt"
    dir "%PROJECT_DIR%backend\database\sam_logs.db" | findstr "sam_logs.db" >> "%BACKUP_DIR%\BACKUP_INFO.txt"
    echo. >> "%BACKUP_DIR%\BACKUP_INFO.txt"
    
    REM Try to get record statistics
    echo Counting database records...
    node -e "
    const sqlite3 = require('sqlite3');
    const path = require('path');
    const dbPath = path.join(__dirname, 'backend/database/sam_logs.db');
    const db = new sqlite3.Database(dbPath);
    db.get('SELECT COUNT(*) as count FROM sam_records', (err, row) => {
        if (!err) console.log('Database Record Count: ' + row.count);
        db.close();
    });
    " 2>nul >> "%BACKUP_DIR%\BACKUP_INFO.txt"
)

REM Create compressed archive (if 7zip or WinRAR available)
echo.
set /p create_zip=Do you want to create a compressed archive? (y/n): 
if /i "%create_zip%"=="y" (
    echo Trying to create compressed archive...
    
    REM Try using 7zip
    7z a "%PROJECT_DIR%backup\sam-log-system-backup-%TIMESTAMP%.7z" "%BACKUP_DIR%\*" >nul 2>&1
    if errorlevel 1 (
        REM Try using WinRAR
        rar a -r "%PROJECT_DIR%backup\sam-log-system-backup-%TIMESTAMP%.rar" "%BACKUP_DIR%\*" >nul 2>&1
        if errorlevel 1 (
            echo Compression tools not found, please manually compress the backup folder
        ) else (
            echo Compressed archive created (RAR format)
        )
    ) else (
        echo Compressed archive created (7Z format)
    )
)

echo.
echo ===============================================
echo [SUCCESS] Backup Completed!
echo ===============================================
echo.
echo [Folder] Backup Directory: %BACKUP_DIR%
echo.
echo [Package] Backup Contents:
echo   [OK] Database files (backend/database/) - All historical records
echo   [OK] Backend code (backend/) - Node.js application
echo   [OK] Frontend code (frontend/) - Vue.js user interface
echo   [OK] Configuration files (package.json, ecosystem.config.js, etc.)
echo   [OK] Deployment scripts (migration-deploy-simple.bat, etc.)
echo   [OK] Management tools (service-manager.bat, start-service-simple.bat, etc.)
echo   [OK] Installation tools (install-nodejs.bat, install-*-service.bat)
echo   [OK] Verification tools (migration-verify.bat)
echo   [OK] Documentation (README.md, guides, etc.)
echo   [OK] Tool scripts (tools/) - Health check and data validation
if /i "%backup_logs%"=="y" echo   [OK] Historical logs (logs/) - System operation logs
echo   [OK] System information (BACKUP_INFO.txt) - Original system details
echo.
echo [Rocket] Migration Steps:
echo.
echo [For Beginners - One-Click Deployment]
echo   1. Copy the entire backup folder to target computer
echo   2. Double-click and run "one-click-deploy.bat"
echo   3. Follow prompts to complete automatic deployment
echo.
echo [For Advanced Users - Step-by-Step Deployment]
echo   1. Copy the entire backup folder to target computer  
echo   2. Read "MIGRATION_GUIDE.md" for detailed steps
echo   3. Run install-nodejs.bat (if needed)
echo   4. Run migration-deploy-simple.bat
echo   5. Run migration-verify.bat to verify
echo.
echo [Important Notes]
echo   • Target computer needs no pre-installed software
echo   • Node.js environment will be automatically downloaded and installed
echo   • Recommend running deployment scripts with administrator privileges
echo   • Complete deployment time: approximately 5-15 minutes
echo.
echo [Document References]
echo   • Quick Start: MIGRATION_GUIDE.md
echo   • Detailed Guide: QUICK_MIGRATION_CHECKLIST.md
echo   • Troubleshooting: TROUBLESHOOTING.md
echo.
echo [Backup Statistics]
if exist "%BACKUP_DIR%\BACKUP_INFO.txt" (
    findstr "Database Record Count\|Backup Time\|File Size" "%BACKUP_DIR%\BACKUP_INFO.txt" 2>nul
)
echo.
echo [Log] Backup Log: %LOG_FILE%
echo ===============================================
echo.

echo [%date% %time%] Backup task completed >> "%LOG_FILE%"

pause
