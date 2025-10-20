@echo off
chcp 65001 >nul
title 卸载开机自启动

echo ========================================
echo    卸载山姆日志系统开机自启动
echo ========================================
echo.

:: 检查管理员权限
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 需要管理员权限！
    echo.
    echo 请右键点击此脚本，选择"以管理员身份运行"
    echo.
    pause
    exit /b 1
)

echo [1/2] 删除计划任务...

schtasks /query /tn "SamLogSystem" >nul 2>&1
if %errorlevel% equ 0 (
    schtasks /delete /tn "SamLogSystem" /f >nul 2>&1
    if %errorlevel% equ 0 (
        echo       ✓ 计划任务删除成功
    ) else (
        echo       ✗ 计划任务删除失败
    )
) else (
    echo       - 未找到计划任务（可能已经删除）
)

echo.
echo [2/2] 清理启动脚本...

set "SCRIPT_DIR=%~dp0"
set "START_SCRIPT=%SCRIPT_DIR%start-service.vbs"

if exist "%START_SCRIPT%" (
    del /f /q "%START_SCRIPT%" >nul 2>&1
    echo       ✓ 启动脚本删除成功
) else (
    echo       - 未找到启动脚本
)

echo.
echo ========================================
echo    ✓ 卸载完成！
echo ========================================
echo.
echo 开机自启动已移除
echo 您仍可以使用 start.bat 手动启动系统
echo.
pause
