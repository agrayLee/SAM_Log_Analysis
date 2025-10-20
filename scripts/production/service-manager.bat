@echo off
REM ===============================================
REM 山姆日志查询系统 - 服务管理工具
REM 版本: v1.3.0
REM 说明: 管理和监控山姆日志查询系统服务
REM ===============================================

REM 设置控制台编码为UTF-8
chcp 65001 > nul

set SERVICE_NAME=SamLogSystem
set TASK_NAME=SamLogSystemStartup
set PROJECT_DIR=%~dp0

:MAIN_MENU
cls
echo.
echo ===============================================
echo 山姆日志查询系统 - 服务管理工具
echo 版本: v1.3.0
echo ===============================================
echo.
echo 当前时间: %date% %time%
echo 项目目录: %PROJECT_DIR%
echo.
echo 请选择操作:
echo.
echo [1] 查看服务状态
echo [2] 启动服务
echo [3] 停止服务  
echo [4] 重启服务
echo [5] 查看服务日志
echo [6] 打开系统访问地址
echo [7] 健康检查
echo [8] 安装自启动 (Windows服务)
echo [9] 安装自启动 (任务计划)
echo [A] 卸载自启动服务
echo [0] 退出
echo.

set /p choice=请输入选择 (0-9/A): 

if "%choice%"=="1" goto CHECK_STATUS
if "%choice%"=="2" goto START_SERVICE
if "%choice%"=="3" goto STOP_SERVICE
if "%choice%"=="4" goto RESTART_SERVICE
if "%choice%"=="5" goto VIEW_LOGS
if "%choice%"=="6" goto OPEN_BROWSER
if "%choice%"=="7" goto HEALTH_CHECK
if "%choice%"=="8" goto INSTALL_SERVICE
if "%choice%"=="9" goto INSTALL_TASK
if /i "%choice%"=="A" goto UNINSTALL_SERVICE
if "%choice%"=="0" goto EXIT

echo 无效选择，请重新输入
timeout /t 2 > nul
goto MAIN_MENU

:CHECK_STATUS
cls
echo ===============================================
echo 服务状态检查
echo ===============================================
echo.

echo [1] Windows服务状态:
sc query "%SERVICE_NAME%" 2>nul
if %errorLevel% neq 0 (
    echo 服务未安装或已删除
) else (
    echo.
)

echo.
echo [2] 任务计划状态:
schtasks /query /tn "%TASK_NAME%" /fo table 2>nul
if %errorLevel% neq 0 (
    echo 计划任务未配置
)

echo.
echo [3] PM2进程状态:
pm2 list 2>nul
if %errorLevel% neq 0 (
    echo PM2未安装或无运行进程
)

echo.
echo [4] 端口占用检查:
netstat -an | findstr ":3001"
if %errorLevel% neq 0 (
    echo 端口3001未被占用
) else (
    echo 端口3001正在使用中
)

echo.
echo [5] 进程检查:
tasklist | findstr "node.exe"
if %errorLevel% neq 0 (
    echo 未发现Node.js进程
)

echo.
pause
goto MAIN_MENU

:START_SERVICE
cls
echo ===============================================
echo 启动服务
echo ===============================================
echo.

echo 正在启动服务...
echo.

REM 检查Windows服务
sc query "%SERVICE_NAME%" >nul 2>&1
if %errorLevel% equ 0 (
    echo 启动Windows服务...
    net start "%SERVICE_NAME%"
    if %errorLevel% equ 0 (
        echo Windows服务启动成功
    ) else (
        echo Windows服务启动失败
    )
) else (
    echo Windows服务未安装，使用脚本启动...
    call "%PROJECT_DIR%start-service.bat" nogui
)

echo.
echo 等待服务启动...
timeout /t 5 > nul

echo 检查服务状态...
curl -s http://localhost:3001/health >nul 2>&1
if %errorLevel% equ 0 (
    echo 服务启动成功！访问地址: http://localhost:3001
) else (
    echo 服务可能启动失败，请检查日志
)

echo.
pause
goto MAIN_MENU

:STOP_SERVICE
cls
echo ===============================================
echo 停止服务
echo ===============================================
echo.

echo 正在停止服务...
echo.

REM 停止Windows服务
net stop "%SERVICE_NAME%" >nul 2>&1
if %errorLevel% equ 0 (
    echo Windows服务已停止
)

REM 停止PM2进程
pm2 stop sam-log-system >nul 2>&1
pm2 delete sam-log-system >nul 2>&1
if %errorLevel% equ 0 (
    echo PM2进程已停止
)

REM 强制终止Node.js进程
taskkill /f /im node.exe >nul 2>&1
if %errorLevel% equ 0 (
    echo Node.js进程已终止
)

echo.
echo 服务停止完成
pause
goto MAIN_MENU

:RESTART_SERVICE
cls
echo ===============================================
echo 重启服务
echo ===============================================
echo.

echo 正在重启服务...
call :STOP_SERVICE
timeout /t 3 > nul
call :START_SERVICE
goto MAIN_MENU

:VIEW_LOGS
cls
echo ===============================================
echo 查看服务日志
echo ===============================================
echo.

set LOG_DIR=%PROJECT_DIR%logs

if not exist "%LOG_DIR%" (
    echo 日志目录不存在: %LOG_DIR%
    echo.
    pause
    goto MAIN_MENU
)

echo 日志目录: %LOG_DIR%
echo.
echo 可用日志文件:
dir /b /o-d "%LOG_DIR%\*.log" 2>nul
echo.

echo 最新的启动日志:
for /f %%i in ('dir /b /o-d "%LOG_DIR%\startup-*.log" 2^>nul') do (
    echo 文件: %%i
    echo 内容:
    type "%LOG_DIR%\%%i" | more
    goto LOG_SHOWN
)

echo 未找到启动日志文件

:LOG_SHOWN
echo.
echo PM2日志:
if exist "%LOG_DIR%\pm2-error.log" (
    echo 错误日志:
    type "%LOG_DIR%\pm2-error.log" | tail -20 2>nul
    echo.
)

if exist "%LOG_DIR%\pm2-out.log" (
    echo 输出日志:
    type "%LOG_DIR%\pm2-out.log" | tail -20 2>nul
)

echo.
pause
goto MAIN_MENU

:OPEN_BROWSER
cls
echo ===============================================
echo 打开系统访问地址
echo ===============================================
echo.

echo 正在打开浏览器...
start http://localhost:3001

echo.
echo 系统访问信息:
echo - 地址: http://localhost:3001
echo - 登录: admin / admin123
echo.
echo 如果页面无法打开，请检查服务是否正在运行
pause
goto MAIN_MENU

:HEALTH_CHECK
cls
echo ===============================================
echo 系统健康检查
echo ===============================================
echo.

echo 正在进行健康检查...
echo.

REM 检查Node.js环境
node --version >nul 2>&1
if %errorLevel% equ 0 (
    echo [✓] Node.js 环境: 
    node --version
) else (
    echo [✗] Node.js 未安装或未配置PATH
)

REM 检查npm环境
call npm --version >nul 2>&1
if %errorLevel% equ 0 (
    echo [✓] npm 环境: 
    call npm --version
) else (
    echo [✗] npm 不可用
)

REM 检查项目文件
if exist "%PROJECT_DIR%backend\app.js" (
    echo [✓] 主程序文件存在
) else (
    echo [✗] 主程序文件不存在: backend\app.js
)

if exist "%PROJECT_DIR%package.json" (
    echo [✓] 项目配置文件存在
) else (
    echo [✗] 项目配置文件不存在: package.json
)

if exist "%PROJECT_DIR%node_modules" (
    echo [✓] 项目依赖已安装
) else (
    echo [✗] 项目依赖未安装，请运行 npm install
)

REM 检查数据库
if exist "%PROJECT_DIR%backend\database\sam_logs.db" (
    echo [✓] 数据库文件存在
) else (
    echo [✗] 数据库文件不存在，请运行 npm run init-db
)

REM 检查端口
netstat -an | findstr ":3001" >nul
if %errorLevel% equ 0 (
    echo [✓] 端口3001正在使用
) else (
    echo [!] 端口3001未被占用
)

REM 检查HTTP服务
curl -s -o nul -w "%%{http_code}" http://localhost:3001 >nul 2>&1
if %errorLevel% equ 0 (
    echo [✓] HTTP服务响应正常
) else (
    echo [!] HTTP服务无响应
)

echo.
echo 健康检查完成
pause
goto MAIN_MENU

:INSTALL_SERVICE
cls
echo ===============================================
echo 安装Windows服务
echo ===============================================
echo.

echo 即将安装Windows服务，需要管理员权限
echo.
set /p confirm=确认安装？(y/n): 
if /i not "%confirm%"=="y" goto MAIN_MENU

if exist "%PROJECT_DIR%install-windows-service.bat" (
    call "%PROJECT_DIR%install-windows-service.bat"
) else (
    echo 错误: 安装脚本不存在
)

pause
goto MAIN_MENU

:INSTALL_TASK
cls
echo ===============================================
echo 安装任务计划程序
echo ===============================================
echo.

echo 即将配置任务计划程序，需要管理员权限
echo.
set /p confirm=确认安装？(y/n): 
if /i not "%confirm%"=="y" goto MAIN_MENU

if exist "%PROJECT_DIR%install-task-scheduler.bat" (
    call "%PROJECT_DIR%install-task-scheduler.bat"
) else (
    echo 错误: 安装脚本不存在
)

pause
goto MAIN_MENU

:UNINSTALL_SERVICE
cls
echo ===============================================
echo 卸载自启动服务
echo ===============================================
echo.

echo 正在卸载自启动服务...
echo.

REM 停止并删除Windows服务
echo 删除Windows服务...
net stop "%SERVICE_NAME%" >nul 2>&1
sc delete "%SERVICE_NAME%" >nul 2>&1
if %errorLevel% equ 0 (
    echo Windows服务已删除
) else (
    echo Windows服务不存在或已删除
)

REM 删除任务计划
echo 删除计划任务...
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1
if %errorLevel% equ 0 (
    echo 计划任务已删除
) else (
    echo 计划任务不存在或已删除
)

REM 删除PM2自启动
echo 删除PM2自启动...
pm2 unstartup >nul 2>&1
pm2 stop sam-log-system >nul 2>&1
pm2 delete sam-log-system >nul 2>&1

echo.
echo 自启动服务卸载完成
pause
goto MAIN_MENU

:EXIT
echo.
echo 感谢使用山姆日志查询系统管理工具
echo.
exit /b 0
