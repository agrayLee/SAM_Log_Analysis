@echo off
set DEPLOY_DIR=%~dp0

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    if exist "%DEPLOY_DIR%install-nodejs.bat" (
        call "%DEPLOY_DIR%install-nodejs.bat"
    ) else (
        exit /b 1
    )
)

REM Run deployment
if exist "%DEPLOY_DIR%migration-deploy-minimal.bat" (
    call "%DEPLOY_DIR%migration-deploy-minimal.bat"
) else (
    exit /b 1
)

REM Verify deployment
if exist "%DEPLOY_DIR%migration-verify.bat" (
    call "%DEPLOY_DIR%migration-verify.bat"
)

exit /b 0
