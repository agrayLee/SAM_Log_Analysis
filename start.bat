@echo off
chcp 65001 >nul
title 山姆日志系统

echo ========================================
echo    山姆日志查询系统
echo ========================================
echo.

cd /d "%~dp0"
node backend\app.js

pause
