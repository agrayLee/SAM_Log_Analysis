@echo off
chcp 65001 >nul
title 生产环境备份

echo ========================================
echo    生产环境数据备份
echo ========================================
echo.

:: 获取当前日期时间
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%a%%b%%c)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set datetime=%mydate%-%mytime%

set "BACKUP_DIR=backup-%datetime%"

echo [1/2] 创建备份目录...
mkdir "%BACKUP_DIR%"
echo       ✓ 备份目录: %BACKUP_DIR%

echo.
echo [2/2] 备份关键文件...

:: 备份数据库
if exist "backend\database\sam_logs.db" (
    copy "backend\database\sam_logs.db" "%BACKUP_DIR%\sam_logs.db" >nul 2>&1
    echo       ✓ 数据库文件
) else (
    echo       ✗ 数据库文件不存在
)

:: 备份环境配置
if exist ".env" (
    copy ".env" "%BACKUP_DIR%\.env" >nul 2>&1
    echo       ✓ 环境配置
) else (
    echo       ✗ .env 文件不存在
)

:: 备份日志（最近7天）
if exist "logs" (
    xcopy "logs\*.log" "%BACKUP_DIR%\logs\" /D /I /Y >nul 2>&1
    echo       ✓ 日志文件
)

echo.
echo ========================================
echo    ✓ 备份完成！
echo ========================================
echo.
echo 备份位置: %BACKUP_DIR%
echo.
echo 包含文件:
dir /b "%BACKUP_DIR%"
echo.
echo 建议将此备份文件夹复制到安全位置
pause
