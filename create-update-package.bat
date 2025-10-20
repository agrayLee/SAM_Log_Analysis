@echo off
chcp 65001 >nul
title 创建生产环境更新包

echo ========================================
echo    创建生产环境更新包
echo ========================================
echo.

:: 获取当前日期时间
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%a%%b%%c)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set datetime=%mydate%-%mytime%

set "PACKAGE_NAME=update-package-%datetime%.zip"

echo [1/3] 准备更新文件...

:: 创建临时目录
if exist "temp_update" rd /s /q "temp_update"
mkdir "temp_update"

:: 复制核心文件（排除数据库、日志、node_modules）
echo       - 复制后端代码...
xcopy "backend" "temp_update\backend\" /E /I /Y /EXCLUDE:exclude-list.txt >nul 2>&1

echo       - 复制前端代码...
xcopy "frontend" "temp_update\frontend\" /E /I /Y >nul 2>&1

echo       - 复制脚本文件...
xcopy "scripts" "temp_update\scripts\" /E /I /Y >nul 2>&1

echo       - 复制工具文件...
xcopy "tools" "temp_update\tools\" /E /I /Y >nul 2>&1

:: 复制根目录重要文件
copy "start.bat" "temp_update\" >nul 2>&1
copy "install-autostart.bat" "temp_update\" >nul 2>&1
copy "uninstall-autostart.bat" "temp_update\" >nul 2>&1
copy "package.json" "temp_update\" >nul 2>&1
copy "package-lock.json" "temp_update\" >nul 2>&1

:: 创建更新说明
echo 生产环境更新包 > "temp_update\更新说明.txt"
echo 创建时间: %date% %time% >> "temp_update\更新说明.txt"
echo. >> "temp_update\更新说明.txt"
echo 更新步骤: >> "temp_update\更新说明.txt"
echo 1. 停止当前运行的系统 >> "temp_update\更新说明.txt"
echo 2. 备份生产环境的 .env 文件 >> "temp_update\更新说明.txt"
echo 3. 备份数据库 backend\database\sam_logs.db >> "temp_update\更新说明.txt"
echo 4. 解压本更新包，覆盖到生产目录 >> "temp_update\更新说明.txt"
echo 5. 还原 .env 文件 >> "temp_update\更新说明.txt"
echo 6. 运行: npm install >> "temp_update\更新说明.txt"
echo 7. 启动系统测试 >> "temp_update\更新说明.txt"

:: 创建服务器端安装脚本
echo @echo off > "temp_update\apply-update.bat"
echo chcp 65001 ^>nul >> "temp_update\apply-update.bat"
echo title 应用更新 >> "temp_update\apply-update.bat"
echo. >> "temp_update\apply-update.bat"
echo echo ======================================== >> "temp_update\apply-update.bat"
echo echo    应用生产环境更新 >> "temp_update\apply-update.bat"
echo echo ======================================== >> "temp_update\apply-update.bat"
echo echo. >> "temp_update\apply-update.bat"
echo. >> "temp_update\apply-update.bat"
echo echo [警告] 请确保已经: >> "temp_update\apply-update.bat"
echo echo   1. 停止当前运行的系统 >> "temp_update\apply-update.bat"
echo echo   2. 备份 .env 文件 >> "temp_update\apply-update.bat"
echo echo   3. 备份 backend\database\sam_logs.db >> "temp_update\apply-update.bat"
echo echo. >> "temp_update\apply-update.bat"
echo pause >> "temp_update\apply-update.bat"
echo. >> "temp_update\apply-update.bat"
echo echo [1/3] 安装依赖... >> "temp_update\apply-update.bat"
echo npm install >> "temp_update\apply-update.bat"
echo. >> "temp_update\apply-update.bat"
echo echo [2/3] 验证文件... >> "temp_update\apply-update.bat"
echo if not exist ".env" echo [错误] .env 文件缺失！请还原备份！ >> "temp_update\apply-update.bat"
echo if not exist "backend\database\sam_logs.db" echo [错误] 数据库文件缺失！请还原备份！ >> "temp_update\apply-update.bat"
echo. >> "temp_update\apply-update.bat"
echo echo [3/3] 更新完成！ >> "temp_update\apply-update.bat"
echo echo. >> "temp_update\apply-update.bat"
echo echo 现在可以运行 start.bat 启动系统 >> "temp_update\apply-update.bat"
echo pause >> "temp_update\apply-update.bat"

echo       ✓ 文件准备完成

echo.
echo [2/3] 压缩更新包...

:: 使用PowerShell压缩（Windows自带）
powershell -command "Compress-Archive -Path 'temp_update\*' -DestinationPath '%PACKAGE_NAME%' -Force"

if exist "%PACKAGE_NAME%" (
    echo       ✓ 压缩完成
) else (
    echo       ✗ 压缩失败
    pause
    exit /b 1
)

echo.
echo [3/3] 清理临时文件...
rd /s /q "temp_update"
echo       ✓ 清理完成

echo.
echo ========================================
echo    ✓ 更新包创建完成！
echo ========================================
echo.
echo 文件名: %PACKAGE_NAME%
echo 文件大小:
dir "%PACKAGE_NAME%" | findstr "%PACKAGE_NAME%"
echo.
echo 传输到生产服务器后:
echo 1. 解压到项目目录
echo 2. 运行 apply-update.bat
echo.
pause
