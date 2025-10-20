@echo off
REM ===============================================
REM 山姆日志查询系统 - Windows服务安装脚本
REM 版本: v1.3.0
REM 说明: 将山姆日志查询系统注册为Windows服务
REM ===============================================

REM 设置控制台编码为UTF-8
chcp 65001 > nul

REM 检查管理员权限
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo ============================================
    echo 错误: 需要管理员权限！
    echo.
    echo 请右键点击此脚本，选择"以管理员身份运行"
    echo ============================================
    echo.
    pause
    exit /b 1
)

echo.
echo ===============================================
echo 山姆日志查询系统 - Windows服务安装
echo 版本: v1.3.0
echo ===============================================
echo.

set SERVICE_NAME=SamLogSystem
set SERVICE_DISPLAY_NAME=山姆日志查询系统
set PROJECT_DIR=%~dp0
set STARTUP_SCRIPT=%PROJECT_DIR%start-service.bat

echo 项目目录: %PROJECT_DIR%
echo 启动脚本: %STARTUP_SCRIPT%
echo.

REM 检查启动脚本是否存在
if not exist "%STARTUP_SCRIPT%" (
    echo 错误: 启动脚本不存在: %STARTUP_SCRIPT%
    echo 请确保start-service.bat文件存在于项目根目录
    pause
    exit /b 1
)

REM 检查服务是否已存在
sc query "%SERVICE_NAME%" > nul 2>&1
if %errorLevel% equ 0 (
    echo 服务已存在，正在卸载旧服务...
    net stop "%SERVICE_NAME%" > nul 2>&1
    sc delete "%SERVICE_NAME%" > nul 2>&1
    echo 等待服务完全删除...
    timeout /t 3 > nul
)

echo 正在安装Windows服务...
echo.

REM 创建Windows服务
REM 使用sc命令创建服务
sc create "%SERVICE_NAME%" ^
    binPath= "cmd.exe /c \"%STARTUP_SCRIPT%\" service" ^
    DisplayName= "%SERVICE_DISPLAY_NAME%" ^
    start= auto ^
    type= own

if %errorLevel% neq 0 (
    echo 错误: 服务创建失败
    echo 错误代码: %errorLevel%
    pause
    exit /b 1
)

echo 服务创建成功！

REM 设置服务描述
sc description "%SERVICE_NAME%" "山姆停车减免日志查询系统 - 自动解析和查询山姆接口日志记录的Web应用系统"

REM 设置服务恢复选项（失败时自动重启）
sc failure "%SERVICE_NAME%" reset= 86400 actions= restart/30000/restart/30000/restart/30000

echo.
echo 配置服务恢复选项...
sc failure "%SERVICE_NAME%" reset= 86400 actions= restart/30000/restart/30000/restart/30000

echo.
echo 启动服务...
net start "%SERVICE_NAME%"

if %errorLevel% equ 0 (
    echo.
    echo ===============================================
    echo Windows服务安装成功！
    echo.
    echo 服务名称: %SERVICE_NAME%
    echo 显示名称: %SERVICE_DISPLAY_NAME%
    echo 启动类型: 自动启动
    echo 当前状态: 运行中
    echo.
    echo 管理命令:
    echo   启动服务: net start %SERVICE_NAME%
    echo   停止服务: net stop %SERVICE_NAME%
    echo   重启服务: net stop %SERVICE_NAME% ^&^& net start %SERVICE_NAME%
    echo   删除服务: sc delete %SERVICE_NAME%
    echo.
    echo 服务管理器: services.msc
    echo 系统访问: http://localhost:3001
    echo 登录账号: admin / admin123
    echo ===============================================
    echo.
    
    REM 等待服务启动
    echo 等待服务完全启动...
    timeout /t 10 > nul
    
    REM 检查服务状态
    echo 检查服务状态:
    sc query "%SERVICE_NAME%"
    
) else (
    echo.
    echo ===============================================
    echo 服务安装成功，但启动失败
    echo.
    echo 可能的原因:
    echo 1. Node.js环境未正确配置
    echo 2. 项目依赖未安装
    echo 3. 端口3001被占用
    echo 4. 网络共享连接问题
    echo.
    echo 解决方案:
    echo 1. 先手动运行 start-service.bat 测试
    echo 2. 检查logs目录下的启动日志
    echo 3. 确保Node.js已正确安装
    echo 4. 检查防火墙和端口设置
    echo.
    echo 手动启动服务: net start %SERVICE_NAME%
    echo ===============================================
    echo.
)

echo.
echo 安装脚本执行完成
pause
