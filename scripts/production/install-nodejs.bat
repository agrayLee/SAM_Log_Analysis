@echo off
REM ===============================================
REM Node.js 自动安装脚本
REM 版本: v1.3.0
REM 说明: 自动下载并安装Node.js LTS版本
REM ===============================================

REM 设置控制台编码为UTF-8
chcp 65001 > nul

echo.
echo ===============================================
echo Node.js 自动安装脚本
echo 版本: v1.3.0
echo ===============================================
echo.

echo 正在检查Node.js环境...
echo.

REM 检查Node.js是否已安装
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js未安装
    echo.
    goto INSTALL_NODEJS
) else (
    echo ✅ Node.js已安装:
    node --version
    echo.
    echo npm版本:
    call npm --version
    echo.
    
    REM 检查版本是否足够
    for /f "tokens=1 delims=." %%a in ('node --version') do set MAJOR_VERSION=%%a
    set MAJOR_VERSION=%MAJOR_VERSION:v=%
    
    REM 安全的版本比较
    if not defined MAJOR_VERSION (
        echo ⚠️ 无法获取Node.js版本信息，开始安装
        echo.
        goto INSTALL_NODEJS
    )
    
    if "%MAJOR_VERSION%" GEQ "14" (
        echo ✅ Node.js版本满足要求（≥14.0.0）
        echo.
        set /p reinstall=Node.js已安装且版本满足要求，是否重新安装？(y/n): 
        if /i not "%reinstall%"=="y" (
            echo 跳过安装，使用现有Node.js环境
            goto END
        )
        echo.
        goto INSTALL_NODEJS
    ) else (
        echo ❌ Node.js版本过低（当前: v%MAJOR_VERSION%.x，需要: ≥v14.0.0）
        echo 需要升级到新版本
        echo.
        goto INSTALL_NODEJS
    )
)

:INSTALL_NODEJS
echo 开始安装Node.js...
echo.

echo 安装选项:
echo [1] 自动下载并安装（推荐）
echo [2] 手动下载安装
echo [3] 使用便携版（如果有）
echo [4] 跳过安装
echo.

set /p install_choice=请选择安装方式 (1-4): 

if "%install_choice%"=="1" goto AUTO_INSTALL
if "%install_choice%"=="2" goto MANUAL_INSTALL
if "%install_choice%"=="3" goto PORTABLE_INSTALL
if "%install_choice%"=="4" goto SKIP_INSTALL

echo 无效选择，默认使用自动安装
goto AUTO_INSTALL

:AUTO_INSTALL
echo.
echo ===============================================
echo 自动下载并安装Node.js
echo ===============================================
echo.

echo 正在准备下载...

REM 设置下载信息
set NODE_VERSION=18.17.1
set NODE_FILENAME=node-v%NODE_VERSION%-x64.msi
set NODE_URL=https://nodejs.org/dist/v%NODE_VERSION%/%NODE_FILENAME%
set DOWNLOAD_DIR=%TEMP%\nodejs_install
set DOWNLOAD_FILE=%DOWNLOAD_DIR%\%NODE_FILENAME%

REM 创建下载目录
if not exist "%DOWNLOAD_DIR%" mkdir "%DOWNLOAD_DIR%"

echo 下载信息:
echo - 版本: Node.js v%NODE_VERSION% LTS
echo - 文件: %NODE_FILENAME%
echo - 下载到: %DOWNLOAD_DIR%
echo.

echo 正在下载Node.js安装包...
echo 这可能需要几分钟时间，请耐心等待...
echo.

REM 使用PowerShell下载文件
powershell -Command "& { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%DOWNLOAD_FILE%' -UseBasicParsing }" 2>nul

if not exist "%DOWNLOAD_FILE%" (
    echo ❌ 下载失败！
    echo.
    echo 可能的原因:
    echo 1. 网络连接问题
    echo 2. 防火墙阻止下载
    echo 3. PowerShell权限不足
    echo.
    echo 请尝试手动下载安装
    goto MANUAL_INSTALL
)

echo ✅ 下载完成！
echo.

echo 正在启动安装程序...
echo 请按照安装向导完成安装

REM 启动MSI安装程序
start /wait msiexec /i "%DOWNLOAD_FILE%" /quiet /norestart

if errorlevel 1 (
    echo ⚠️ 自动安装可能失败，启动手动安装程序...
    start "" "%DOWNLOAD_FILE%"
    echo.
    echo 请手动完成安装，然后按任意键继续...
    pause >nul
) else (
    echo ✅ Node.js安装完成！
    echo.
)

REM 清理下载文件
del /f /q "%DOWNLOAD_FILE%" >nul 2>&1

REM 刷新环境变量（重新加载PATH）
echo 正在刷新环境变量...
for /f "skip=2 tokens=3*" %%a in ('reg query HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment /v PATH') do set SYSTEM_PATH=%%a %%b
for /f "skip=2 tokens=3*" %%a in ('reg query HKCU\Environment /v PATH 2^>nul') do set USER_PATH=%%a %%b
set PATH=%SYSTEM_PATH%;%USER_PATH%

echo.
echo 验证安装结果...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 安装后验证失败
    echo 请尝试:
    echo 1. 重新启动命令提示符
    echo 2. 重新启动计算机
    echo 3. 手动添加Node.js到PATH环境变量
    echo.
    goto MANUAL_INSTALL
) else (
    echo ✅ 安装验证成功！
    echo Node.js版本:
    node --version
    echo npm版本:
    call npm --version
    echo.
    goto END
)

:MANUAL_INSTALL
echo.
echo ===============================================
echo 手动下载安装指南
echo ===============================================
echo.

echo 请按以下步骤手动安装Node.js:
echo.
echo 1. 打开浏览器访问: https://nodejs.org/
echo 2. 点击"下载LTS版本"（推荐版本）
echo 3. 下载完成后运行安装包
echo 4. 按默认设置完成安装
echo 5. 重新启动命令提示符
echo.

set /p open_browser=是否现在打开Node.js官网？(y/n): 
if /i "%open_browser%"=="y" (
    start https://nodejs.org/
    echo 浏览器已打开，请下载并安装Node.js
)

echo.
echo 安装完成后请重新运行部署脚本
echo.
goto END

:PORTABLE_INSTALL
echo.
echo ===============================================
echo 便携版Node.js安装
echo ===============================================
echo.

set PORTABLE_DIR=%~dp0nodejs_portable
echo 正在检查便携版Node.js: %PORTABLE_DIR%

if exist "%PORTABLE_DIR%\node.exe" (
    echo ✅ 找到便携版Node.js
    
    REM 添加到PATH
    set PATH=%PORTABLE_DIR%;%PATH%
    
    echo 验证便携版...
    "%PORTABLE_DIR%\node.exe" --version
    if errorlevel 1 (
        echo ❌ 便携版Node.js无法运行
        goto MANUAL_INSTALL
    ) else (
        echo ✅ 便携版Node.js可用
        echo.
        REM 设置环境变量
        setx PATH "%PATH%" >nul 2>&1
        goto END
    )
) else (
    echo ❌ 未找到便携版Node.js
    echo.
    echo 便携版目录应包含:
    echo - %PORTABLE_DIR%\node.exe
    echo - %PORTABLE_DIR%\npm.cmd
    echo.
    goto MANUAL_INSTALL
)

:SKIP_INSTALL
echo.
echo ⚠️ 跳过Node.js安装
echo.
echo 请确保在运行部署脚本前手动安装Node.js
echo 最低版本要求: Node.js v14.0.0或更高
echo.
echo 下载地址: https://nodejs.org/
echo.
goto END

:END
echo.
echo ===============================================
echo Node.js安装脚本完成
echo ===============================================
echo.

node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js仍然不可用
    echo.
    echo 建议操作:
    echo 1. 重新启动命令提示符
    echo 2. 检查PATH环境变量
    echo 3. 重新运行此脚本
    echo.
) else (
    echo ✅ Node.js环境准备完成！
    echo.
    echo 当前版本:
    node --version
    call npm --version
    echo.
    echo 现在可以运行部署脚本: migration-deploy.bat
    echo.
)

pause
