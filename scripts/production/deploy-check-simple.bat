@echo off
chcp 65001 >nul
echo ============================================
echo 山姆日志查询系统 - 部署检查脚本 (兼容版)
echo ============================================
echo.

REM 检查Node.js
echo [1/8] 检查Node.js环境...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js未安装或版本不兼容
    echo 请安装Node.js 16.x或18.x LTS版本
    pause
    exit /b 1
) else (
    echo [OK] Node.js环境正常
    node --version
)
echo.

REM 检查npm
echo [2/8] 检查npm...
call npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm不可用
    pause
    exit /b 1
) else (
    echo [OK] npm正常
    call npm --version
)
echo.

REM 检查项目文件
echo [3/8] 检查项目结构...
if not exist "backend\app.js" (
    echo [ERROR] 后端主文件缺失
    pause
    exit /b 1
)
if not exist "package.json" (
    echo [ERROR] package.json缺失
    pause
    exit /b 1
)
echo [OK] 项目结构完整
echo.

REM 检查端口
echo [4/8] 检查端口占用...
set port=3001

netstat -an | findstr :%port% >nul
if %errorlevel% equ 0 (
    echo [WARNING] 端口 %port% 已被占用
    echo 当前使用该端口的进程:
    netstat -ano | findstr :%port%
    echo 建议使用其他端口或停止占用进程
    pause
) else (
    echo [OK] 端口 %port% 可用
)
echo.

REM 检查网络连接
echo [5/8] 检查网络连接...
ping -n 1 10.21.189.125 >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] 无法连接到10.21.189.125
    echo 请检查网络连接和防火墙设置
) else (
    echo [OK] 网络连接正常
)
echo.

REM 检查目录权限
echo [6/8] 检查目录权限...
if not exist "logs" mkdir logs
if not exist "database" mkdir database
echo test > logs\test.txt 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] 日志目录无写入权限
    echo 请以管理员权限运行或修改目录权限
    pause
    exit /b 1
) else (
    del logs\test.txt >nul 2>&1
    echo [OK] 目录权限正常
)
echo.

REM 创建环境配置
echo [7/8] 创建环境配置...
if not exist ".env" (
    echo PORT=%port% > .env
    echo NODE_ENV=production >> .env
    echo SESSION_SECRET=sam-log-production-secret-change-me >> .env
    echo [OK] 已创建基础环境配置
) else (
    echo [OK] 环境配置文件已存在
)
echo.

REM 安装依赖
echo [8/8] 检查依赖安装...
if not exist "node_modules" (
    echo 正在安装依赖...
    call npm install --production
    if %errorlevel% neq 0 (
        echo [ERROR] 依赖安装失败
        pause
        exit /b 1
    )
)
echo [OK] 依赖检查完成
echo.

REM 部署总结
echo ============================================
echo [SUCCESS] 部署检查完成！
echo ============================================
echo 配置信息:
echo   端口: %port%
echo   环境: 生产环境
echo   日志目录: %cd%\logs
echo   数据库目录: %cd%\database
echo.
echo 下一步操作:
echo   1. 运行 'npm start' 启动系统
echo   2. 访问 http://localhost:%port%
echo   3. 使用 admin/admin123 登录
echo.
echo 生产环境建议:
echo   - 使用 PM2 管理进程
echo   - 配置防火墙开放端口
echo   - 设置定时监控和备份
echo ============================================
pause
