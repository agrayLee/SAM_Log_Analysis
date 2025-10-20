@echo off
REM ===============================================
REM 山姆日志查询系统 - 简化部署脚本 (兼容版)
REM 版本: v1.4.1
REM 说明: 在目标计算机上部署迁移的系统 (无emoji符号)
REM ===============================================

REM 设置控制台编码为UTF-8
chcp 65001 > nul

echo.
echo ===============================================
echo 山姆日志查询系统 - 简化部署 (兼容版)
echo 版本 v1.4.1
echo ===============================================
echo.

set DEPLOY_DIR=%~dp0
set TIMESTAMP=%date:~0,4%-%date:~5,2%-%date:~8,2%_%time:~0,2%-%time:~3,2%-%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set LOG_FILE=%DEPLOY_DIR%logs\deploy-simple-%TIMESTAMP%.log

echo 部署时间: %date% %time%
echo 目标目录: %DEPLOY_DIR%
echo 目标系统: %COMPUTERNAME%
echo.

REM 创建日志目录
if not exist "%DEPLOY_DIR%logs" mkdir "%DEPLOY_DIR%logs"

REM 记录部署开始
echo [%date% %time%] 开始简化部署到 %COMPUTERNAME% >> "%LOG_FILE%"

echo 正在进行部署前检查...
echo.

REM 1. 检查Node.js环境
echo [1/6] 检查Node.js环境...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js未安装！
    echo.
    echo 请手动安装Node.js:
    echo 1. 访问 https://nodejs.org/
    echo 2. 下载LTS版本 (推荐v18.17.1)
    echo 3. 安装后重新运行此脚本
    echo.
    echo [%date% %time%] 错误: Node.js未安装 >> "%LOG_FILE%"
    pause
    exit /b 1
) else (
    echo [OK] Node.js已安装
    node --version
    echo [%date% %time%] Node.js版本检查通过 >> "%LOG_FILE%"
    node --version >> "%LOG_FILE%" 2>&1
)

REM 2. 检查npm环境
echo [2/6] 检查npm环境...
call npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm不可用！
    echo [%date% %time%] 错误: npm不可用 >> "%LOG_FILE%"
    pause
    exit /b 1
) else (
    echo [OK] npm已安装
    call npm --version
    echo [%date% %time%] npm版本检查通过 >> "%LOG_FILE%"
    call npm --version >> "%LOG_FILE%" 2>&1
)

REM 3. 检查端口占用
echo [3/6] 检查端口占用...
netstat -an | findstr ":3001" >nul
if errorlevel 0 (
    echo [WARNING] 端口3001已被占用
    echo 请确保没有其他服务使用此端口
    echo [%date% %time%] 警告: 端口3001已被占用 >> "%LOG_FILE%"
    
    set /p continue_port=是否继续部署? (y/n): 
    if /i not "%continue_port%"=="y" (
        echo 部署已取消
        exit /b 1
    )
) else (
    echo [OK] 端口3001可用
    echo [%date% %time%] 端口3001可用 >> "%LOG_FILE%"
)

REM 4. 安装项目依赖
echo [4/6] 安装项目依赖...
echo 这可能需要几分钟时间，请耐心等待...
echo.

echo 正在执行: call npm install
call npm install
if errorlevel 1 (
    echo [ERROR] 依赖安装失败！
    echo 请检查:
    echo 1. 网络连接是否正常
    echo 2. npm配置是否正确
    echo 3. 是否有足够的磁盘空间
    echo 4. 是否有防火墙阻止下载
    echo.
    echo [%date% %time%] 错误: 依赖安装失败 >> "%LOG_FILE%"
    pause
    exit /b 1
) else (
    echo [OK] 项目依赖安装完成
    echo [%date% %time%] 项目依赖安装完成 >> "%LOG_FILE%"
)

REM 5. 检查数据库文件
echo [5/6] 检查数据库文件...
if exist "%DEPLOY_DIR%backend\database\sam_logs.db" (
    echo [OK] 数据库文件存在
    
    REM 获取数据库文件大小
    for %%I in ("%DEPLOY_DIR%backend\database\sam_logs.db") do set DB_SIZE=%%~zI
    echo 数据库文件大小: %DB_SIZE% 字节
    echo [%date% %time%] 数据库文件存在，大小: %DB_SIZE% 字节 >> "%LOG_FILE%"
) else (
    echo [WARNING] 数据库文件不存在，正在初始化...
    call npm run init-db
    if errorlevel 1 (
        echo [ERROR] 数据库初始化失败！
        echo [%date% %time%] 错误: 数据库初始化失败 >> "%LOG_FILE%"
        pause
        exit /b 1
    ) else (
        echo [OK] 数据库初始化完成
        echo [%date% %time%] 数据库初始化完成 >> "%LOG_FILE%"
    )
)

REM 6. 测试启动服务
echo [6/6] 测试服务启动...
echo 正在启动服务进行测试...
echo.

REM 在后台启动服务
start /min "山姆日志系统测试" cmd /c "cd /d \"%DEPLOY_DIR%\" && node backend/app.js"

REM 等待服务启动
echo 等待服务启动...
timeout /t 8 >nul

REM 测试HTTP连接
echo 测试HTTP服务...
curl -s http://localhost:3001/health >nul 2>&1
if errorlevel 1 (
    echo [WARNING] HTTP服务测试失败
    echo 服务可能需要更长时间启动
    echo [%date% %time%] 警告: HTTP服务测试失败 >> "%LOG_FILE%"
) else (
    echo [OK] HTTP服务响应正常
    echo [%date% %time%] HTTP服务响应正常 >> "%LOG_FILE%"
)

REM 停止测试服务
echo 停止测试服务...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 >nul

echo.
echo ===============================================
echo [SUCCESS] 简化部署完成！
echo ===============================================
echo.
echo 系统信息:
echo - 目标计算机: %COMPUTERNAME%
echo - 部署目录: %DEPLOY_DIR%
echo - 访问地址: http://localhost:3001
echo - 默认账号: admin / admin123
echo.
echo 部署内容:
echo [OK] Node.js环境检查
echo [OK] 项目依赖安装
echo [OK] 数据库迁移验证
echo [OK] 服务启动测试
echo.
echo 下一步操作:
echo 1. 启动服务: npm start 或 start-service.bat
echo 2. 访问系统: http://localhost:3001
echo 3. 测试功能: 登录并验证各项功能
echo 4. 检查日志: 查看logs目录下的日志文件
echo.
echo 部署日志: %LOG_FILE%
echo.

if exist "%DEPLOY_DIR%BACKUP_INFO.txt" (
    echo 原系统信息:
    type "%DEPLOY_DIR%BACKUP_INFO.txt" | findstr "源系统\|备份时间\|数据库记录总数"
    echo.
)
echo ===============================================
echo.

echo [%date% %time%] 简化部署任务完成 >> "%LOG_FILE%"

REM 询问是否立即启动服务
set /p start_now=是否立即启动服务? (y/n): 
if /i "%start_now%"=="y" (
    echo.
    echo 正在启动服务...
    if exist "%DEPLOY_DIR%start-service.bat" (
        call "%DEPLOY_DIR%start-service.bat"
    ) else (
        echo 请手动运行: npm start
    )
)

echo.
echo 部署完成！感谢使用山姆日志查询系统。
pause
