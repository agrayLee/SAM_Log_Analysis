@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo 生产环境Git初始化脚本
echo Production Git Initialization Script
echo ========================================
echo.

REM 设置生产环境路径
set "PROD_PATH=C:\log_analysis"
set "GIT_REPO=https://github.com/agrayLee/SAM_Log_Analysis.git"
set "GIT_BRANCH=main"

echo 目标路径: %PROD_PATH%
echo Git仓库: %GIT_REPO%
echo 分支: %GIT_BRANCH%
echo.

REM 切换到生产目录
cd /d "%PROD_PATH%" || (
    echo ❌ 错误：无法进入目录 %PROD_PATH%
    echo.
    echo 可能的原因：
    echo   1. 目录不存在
    echo   2. 路径错误
    echo.
    echo 请检查路径是否正确，或手动创建目录：
    echo   mkdir %PROD_PATH%
    pause
    exit /b 1
)

echo 当前目录: %CD%
echo.

REM 检查是否已经是Git仓库
if exist ".git\" (
    echo ⚠️  警告：当前目录已经是Git仓库
    echo.
    echo 现有的Git配置：
    git remote -v
    echo.
    echo 是否要重新配置？这将删除现有Git配置。
    pause

    rmdir /s /q .git
    echo ✓ 已删除旧的Git配置
    echo.
)

echo [1/6] 初始化Git仓库...
git init
if %errorlevel% neq 0 (
    echo ❌ 错误：Git初始化失败
    echo.
    echo 请检查：
    echo   1. Git是否已安装？运行: git --version
    echo   2. PATH环境变量是否包含Git路径？
    pause
    exit /b 1
)
echo ✓ Git仓库初始化成功
echo.

echo [2/6] 配置Git用户信息...
git config user.name "agrayLee"
git config user.email "agray@qq.com"
echo ✓ 用户信息配置完成
echo.

echo [3/6] 添加远程仓库...
git remote add origin %GIT_REPO%
if %errorlevel% neq 0 (
    echo ⚠️  远程仓库已存在，尝试更新URL...
    git remote set-url origin %GIT_REPO%
)
echo ✓ 远程仓库配置完成
echo.

echo [4/6] 拉取远程代码...
git fetch origin %GIT_BRANCH%
if %errorlevel% neq 0 (
    echo ❌ 错误：拉取代码失败
    echo.
    echo 可能的原因：
    echo   1. 网络连接问题
    echo   2. GitHub访问受限
    echo   3. 需要配置Git凭证
    echo.
    echo 解决方案：
    echo   1. 检查网络: ping github.com
    echo   2. 配置凭证: git config --global credential.helper manager
    echo   3. 手动登录GitHub
    pause
    exit /b 1
)
echo ✓ 远程代码拉取成功
echo.

echo [5/6] 检查本地文件...
echo.
echo 当前本地文件：
dir /b
echo.
echo ⚠️  重要：接下来将用远程代码覆盖本地文件
echo.
echo 如果需要保留本地配置文件（如.env），请现在备份！
echo.
pause

REM 备份.env文件（如果存在）
if exist ".env" (
    echo 正在备份.env文件...
    copy .env .env.backup >nul
    echo ✓ .env已备份为.env.backup
)

echo.
echo [6/6] 重置到远程版本...
git checkout -b %GIT_BRANCH%
git reset --hard origin/%GIT_BRANCH%
if %errorlevel% neq 0 (
    echo ❌ 错误：代码重置失败
    pause
    exit /b 1
)
echo ✓ 代码已更新到最新版本
echo.

REM 恢复.env文件
if exist ".env.backup" (
    echo 正在恢复.env配置...
    copy /y .env.backup .env >nul
    del .env.backup
    echo ✓ .env配置已恢复
    echo.
)

echo [7/6] 设置跟踪分支...
git branch --set-upstream-to=origin/%GIT_BRANCH% %GIT_BRANCH%
echo ✓ 跟踪分支设置完成
echo.

echo ========================================
echo ✓ Git初始化完成！
echo ========================================
echo.
echo 当前Git状态：
git status
echo.
echo 最新提交：
git log -1 --pretty=format:"  提交: %%h%%n  作者: %%an%%n  时间: %%ad%%n  说明: %%s%%n" --date=format:"%%Y-%%m-%%d %%H:%%M"
echo.
echo 远程仓库：
git remote -v
echo.
echo ========================================
echo 下一步操作：
echo ========================================
echo.
echo 1. 检查.env配置文件是否正确
echo    - 如需修改：notepad .env
echo.
echo 2. 安装依赖包
echo    - 执行：npm install --production
echo.
echo 3. 启动服务
echo    - 执行：start.bat 或 node backend/app.js
echo.
echo 4. 以后更新版本
echo    - 执行：production-update.bat
echo.
pause
