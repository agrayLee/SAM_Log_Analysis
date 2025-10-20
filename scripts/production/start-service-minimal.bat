@echo off
set DEPLOY_DIR=%~dp0
cd /d "%DEPLOY_DIR%"
call npm start
