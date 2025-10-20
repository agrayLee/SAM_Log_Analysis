@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo 生产环境文件清理脚本
echo Production Environment Cleanup Script
echo ========================================
echo.

REM 设置生产环境路径（需要修改为实际路径）
set "PROD_PATH=C:\log_analysis"

echo 当前将清理的目录: %PROD_PATH%
echo.
echo 警告：此操作将删除以下文件/目录：
echo   - 所有 .md 文档文件
echo   - docs/ 目录
echo   - tools/ 目录
echo   - 多余的部署脚本
echo   - 备份说明文件
echo.
echo 保留的文件：
echo   - backend/, frontend/, database/
echo   - node_modules/, logs/
echo   - .env, package.json, ecosystem.config.js
echo   - start-service-minimal.bat
echo.
pause

REM 切换到生产目录
cd /d "%PROD_PATH%" || (
    echo 错误：无法进入目录 %PROD_PATH%
    pause
    exit /b 1
)

echo.
echo [1/5] 删除文档文件...
del /f /q *.md 2>nul
echo    ✓ 已删除所有 .md 文件

echo.
echo [2/5] 删除文档目录...
if exist "docs\" (
    rmdir /s /q docs
    echo    ✓ 已删除 docs/ 目录
) else (
    echo    - docs/ 目录不存在，跳过
)

echo.
echo [3/5] 删除工具目录...
if exist "tools\" (
    rmdir /s /q tools
    echo    ✓ 已删除 tools/ 目录
) else (
    echo    - tools/ 目录不存在，跳过
)

echo.
echo [4/5] 删除多余的部署脚本...
for %%f in (
    deploy-check-simple.bat
    install-nodejs.bat
    install-task-scheduler.bat
    install-windows-service.bat
    migration-backup-en.bat
    migration-deploy-clean.bat
    migration-deploy-minimal.bat
    migration-deploy-simple-en.bat
    migration-deploy-simple.bat
    migration-verify.bat
    one-click-deploy.bat
    one-click-deploy-minimal.bat
    start-service-simple.bat
    backup-exclude.txt
    BACKUP_INFO.txt
) do (
    if exist "%%f" (
        del /f /q "%%f"
        echo    ✓ 已删除 %%f
    )
)

echo.
echo [5/5] 清理旧日志文件（保留最近7天）...
forfiles /p logs /s /m *.log /d -7 /c "cmd /c del @path" 2>nul
echo    ✓ 已清理7天前的日志文件

echo.
echo ========================================
echo 清理完成！
echo ========================================
echo.
echo 当前保留的核心文件和目录：
dir /b /a | findstr /v "node_modules"
echo.
echo 剩余磁盘空间：
for /f "tokens=3" %%a in ('dir /-c ^| findstr /C:"可用字节"') do echo %%a bytes
echo.
pause
