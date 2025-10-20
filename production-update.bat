@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo 生产环境版本更新脚本
echo Production Version Update Script
echo ========================================
echo.

REM ============ 配置区域 ============
REM 生产环境路径
set "PROD_PATH=C:\log_analysis"

REM GitHub仓库信息
set "GIT_REPO=https://github.com/agrayLee/SAM_Log_Analysis.git"
set "GIT_BRANCH=main"

REM 服务名称（如果使用Windows服务）
set "SERVICE_NAME=LogAnalysis"

REM 备份目录
set "BACKUP_DIR=%PROD_PATH%\backup"
REM ==================================

echo 配置信息：
echo   生产路径: %PROD_PATH%
echo   Git仓库: %GIT_REPO%
echo   分支: %GIT_BRANCH%
echo.
echo 更新步骤：
echo   1. 停止服务
echo   2. 备份当前版本
echo   3. 拉取最新代码
echo   4. 安装/更新依赖
echo   5. 重启服务
echo.
pause

REM 记录开始时间
echo.
echo [开始时间] %date% %time%
echo.

REM ============ 步骤1: 停止服务 ============
echo [1/5] 停止服务...
cd /d "%PROD_PATH%" || (
    echo ❌ 错误：无法进入目录 %PROD_PATH%
    pause
    exit /b 1
)

REM 检查服务是否存在
sc query "%SERVICE_NAME%" >nul 2>&1
if %errorlevel% equ 0 (
    echo    正在停止服务: %SERVICE_NAME%
    net stop "%SERVICE_NAME%" >nul 2>&1
    timeout /t 2 /nobreak >nul
    echo    ✓ 服务已停止
) else (
    echo    - 服务 %SERVICE_NAME% 不存在，跳过
)

REM 停止Node进程（如果有）
echo    正在停止Node进程...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo    ✓ Node进程已停止

REM ============ 步骤2: 备份当前版本 ============
echo.
echo [2/5] 备份当前版本...

REM 创建备份目录
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM 生成备份文件名
set "BACKUP_NAME=backup_%date:~0,4%-%date:~5,2%-%date:~8,2%_%time:~0,2%-%time:~3,2%-%time:~6,2%"
set "BACKUP_NAME=%BACKUP_NAME: =0%"
set "BACKUP_PATH=%BACKUP_DIR%\%BACKUP_NAME%"

echo    备份路径: %BACKUP_PATH%

REM 创建备份目录
mkdir "%BACKUP_PATH%"

REM 备份核心文件
echo    正在备份核心文件...
xcopy /e /i /q backend "%BACKUP_PATH%\backend\" >nul
xcopy /e /i /q frontend "%BACKUP_PATH%\frontend\" >nul
xcopy /i /q package*.json "%BACKUP_PATH%\" >nul
copy /y .env "%BACKUP_PATH%\" >nul 2>&1
copy /y ecosystem.config.js "%BACKUP_PATH%\" >nul 2>&1

echo    ✓ 备份完成: %BACKUP_NAME%

REM ============ 步骤3: 拉取最新代码 ============
echo.
echo [3/5] 拉取最新代码...

REM 检查是否是Git仓库
if not exist ".git\" (
    echo    ❌ 错误：当前目录不是Git仓库
    echo    需要手动初始化：
    echo      git init
    echo      git remote add origin %GIT_REPO%
    echo      git fetch
    echo      git checkout %GIT_BRANCH%
    pause
    exit /b 1
)

REM 保存本地修改（如果有）
git stash save "Auto stash before update %date% %time%" >nul 2>&1

REM 拉取最新代码
echo    正在从远程拉取代码...
git fetch origin %GIT_BRANCH%
if %errorlevel% neq 0 (
    echo    ❌ 错误：拉取代码失败
    echo    请检查网络连接和Git凭证
    pause
    exit /b 1
)

git reset --hard origin/%GIT_BRANCH%
if %errorlevel% neq 0 (
    echo    ❌ 错误：更新代码失败
    pause
    exit /b 1
)

echo    ✓ 代码已更新到最新版本

REM 显示最新提交信息
echo.
echo    最新提交信息：
git log -1 --pretty=format:"    提交: %%h%%n    作者: %%an%%n    时间: %%ad%%n    说明: %%s" --date=format:"%%Y-%%m-%%d %%H:%%M"
echo.
echo.

REM ============ 步骤4: 安装/更新依赖 ============
echo [4/5] 安装/更新依赖...

REM 检查Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo    ❌ 错误：未安装Node.js
    echo    请先安装Node.js：https://nodejs.org/
    pause
    exit /b 1
)

echo    Node版本:
node -v
echo    npm版本:
npm -v
echo.

REM 清理旧的node_modules（可选，加快安装速度）
if exist "node_modules\" (
    echo    清理旧依赖...
    rmdir /s /q node_modules
)

REM 安装依赖
echo    正在安装依赖包...
call npm install --production
if %errorlevel% neq 0 (
    echo    ❌ 错误：依赖安装失败
    pause
    exit /b 1
)

echo    ✓ 依赖安装完成

REM ============ 步骤5: 重启服务 ============
echo.
echo [5/5] 重启服务...

REM 检查服务是否存在
sc query "%SERVICE_NAME%" >nul 2>&1
if %errorlevel% equ 0 (
    echo    正在启动服务: %SERVICE_NAME%
    net start "%SERVICE_NAME%"
    timeout /t 3 /nobreak >nul

    REM 验证服务状态
    sc query "%SERVICE_NAME%" | find "RUNNING" >nul
    if %errorlevel% equ 0 (
        echo    ✓ 服务启动成功
    ) else (
        echo    ⚠️  警告：服务可能未正常启动
        sc query "%SERVICE_NAME%"
    )
) else (
    echo    - 服务不存在，使用手动启动
    echo    请运行：start.bat 或 node backend/app.js
)

REM ============ 完成 ============
echo.
echo ========================================
echo ✓ 更新完成！
echo ========================================
echo.
echo 更新摘要：
echo   备份位置: %BACKUP_PATH%
echo   当前版本:
git log -1 --pretty=format:"   %%h - %%s (%%ad)" --date=short
echo.
echo.
echo   服务状态:
sc query "%SERVICE_NAME%" 2>nul | find "STATE" || echo   (使用手动启动)
echo.
echo [完成时间] %date% %time%
echo.
pause
