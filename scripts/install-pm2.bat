@echo off
chcp 65001 >nul
echo ============================================
echo 山姆日志查询系统 - PM2服务安装脚本
echo ============================================
echo.

:: 检查管理员权限
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] 此脚本需要管理员权限
    echo 请右键选择"以管理员身份运行"
    pause
    exit /b 1
)

:: 安装PM2
echo [1/5] 安装PM2进程管理器...
npm install -g pm2
if %errorlevel% neq 0 (
    echo [ERROR] PM2安装失败
    pause
    exit /b 1
)
echo [OK] PM2安装完成
echo.

:: 读取端口配置
echo [2/5] 读取配置...
if not exist ".env" (
    echo [ERROR] 环境配置文件不存在，使用默认配置
    set PORT=8080
) else (
    for /f "tokens=2 delims==" %%a in ('findstr "^PORT=" .env') do set PORT=%%a
    if "%PORT%"=="" set PORT=8080
)
echo 使用端口: %PORT%
echo.

:: 创建PM2配置文件
echo [3/5] 创建PM2配置...
(
echo module.exports = {
echo   apps: [{
echo     name: 'sam-log-system',
echo     script: './backend/app.js',
echo     instances: 1,
echo     exec_mode: 'cluster',
echo     watch: false,
echo     max_memory_restart: '1G',
echo     env: {
echo       NODE_ENV: 'production',
echo       PORT: %PORT%
echo     },
echo     log_file: './logs/pm2.log',
echo     out_file: './logs/pm2-out.log',
echo     error_file: './logs/pm2-error.log',
echo     time: true,
echo     autorestart: true,
echo     max_restarts: 10,
echo     min_uptime: '10s'
echo   }]
echo };
) > ecosystem.config.js
echo [OK] PM2配置文件创建完成
echo.

:: 启动服务
echo [4/5] 启动PM2服务...
pm2 start ecosystem.config.js
if %errorlevel% neq 0 (
    echo [ERROR] 服务启动失败
    pause
    exit /b 1
)
echo [OK] 服务启动成功
echo.

:: 设置开机自启
echo [5/5] 配置开机自启...
pm2 startup
echo.
echo [INFO] 请复制上面的命令并以管理员身份执行
echo 然后按任意键继续...
pause >nul

pm2 save
echo [OK] 开机自启配置完成
echo.

:: 防火墙配置
echo 配置防火墙规则...
netsh advfirewall firewall add rule name="SamLogSystem-Port%PORT%" dir=in action=allow protocol=TCP localport=%PORT%
echo [OK] 防火墙规则已添加
echo.

:: 显示状态
echo ============================================
echo [SUCCESS] PM2服务安装完成！
echo ============================================
echo 服务状态:
pm2 status
echo.
echo 常用命令:
echo   pm2 status              # 查看服务状态
echo   pm2 logs sam-log-system # 查看服务日志
echo   pm2 restart sam-log-system # 重启服务
echo   pm2 stop sam-log-system    # 停止服务
echo   pm2 start sam-log-system   # 启动服务
echo.
echo 访问地址: http://localhost:%PORT%
echo 默认账号: admin / admin123
echo ============================================
pause
