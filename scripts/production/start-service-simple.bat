@echo off
chcp 65001 >nul
echo ============================================
echo 山姆日志查询系统 - 启动脚本 (兼容版)
echo ============================================
echo.

echo 当前配置:
echo   端口: 3001
echo   环境: 生产环境
echo   时间: %date% %time%
echo.

REM 检查端口占用
echo 检查端口占用...
netstat -an | findstr :3001 >nul
if %errorlevel% equ 0 (
    echo [WARNING] 端口 3001 被占用，正在尝试停止旧进程...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do (
        taskkill /pid %%a /f >nul 2>&1
    )
    timeout /t 3 >nul
)

REM 创建必要目录
if not exist "logs" mkdir logs
if not exist "database" mkdir database

echo.
echo [INFO] 正在启动山姆日志查询系统...
echo [INFO] 访问地址: http://localhost:3001
echo [INFO] 默认账号: admin / admin123
echo.
echo 按 Ctrl+C 停止服务
echo ============================================
echo.

REM 启动Node.js应用
node backend/app.js

REM 如果异常退出，记录日志
echo [%date% %time%] 系统异常退出 >> logs\startup.log
echo.
echo [WARNING] 系统已停止运行
echo 请检查 logs\error.log 查看错误信息
pause
