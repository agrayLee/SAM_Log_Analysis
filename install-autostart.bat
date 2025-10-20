@echo off
chcp 65001 >nul
title 安装开机自启动

echo ========================================
echo    安装山姆日志系统开机自启动
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

:: 获取当前目录
set "SCRIPT_DIR=%~dp0"
set "START_SCRIPT=%SCRIPT_DIR%start-service.vbs"

echo [1/3] 创建后台启动脚本...

:: 创建VBS脚本用于隐藏窗口启动
echo Set WshShell = CreateObject("WScript.Shell") > "%START_SCRIPT%"
echo WshShell.CurrentDirectory = "%SCRIPT_DIR%" >> "%START_SCRIPT%"
echo WshShell.Run "cmd /c node backend\app.js", 0, False >> "%START_SCRIPT%"

echo       ✓ 启动脚本创建成功

echo.
echo [2/3] 创建计划任务...

:: 删除已存在的任务（如果有）
schtasks /query /tn "SamLogSystem" >nul 2>&1
if %errorlevel% equ 0 (
    echo       - 删除旧任务...
    schtasks /delete /tn "SamLogSystem" /f >nul 2>&1
)

:: 创建计划任务（开机启动，延迟30秒，失败自动重启）
schtasks /create /tn "SamLogSystem" /tr "wscript.exe \"%START_SCRIPT%\"" /sc onstart /delay 0000:30 /rl highest /f >nul 2>&1

if %errorlevel% equ 0 (
    echo       ✓ 计划任务创建成功
) else (
    echo       ✗ 计划任务创建失败
    pause
    exit /b 1
)

echo.
echo [3/3] 验证安装...

schtasks /query /tn "SamLogSystem" >nul 2>&1
if %errorlevel% equ 0 (
    echo       ✓ 安装验证成功
) else (
    echo       ✗ 安装验证失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo    ✓ 安装完成！
echo ========================================
echo.
echo 系统将在下次开机时自动启动
echo 开机后30秒自动运行（避免启动过快）
echo.
echo 管理命令：
echo   - 查看任务: schtasks /query /tn "SamLogSystem" /fo list /v
echo   - 立即运行: schtasks /run /tn "SamLogSystem"
echo   - 卸载自启: uninstall-autostart.bat
echo.
pause
