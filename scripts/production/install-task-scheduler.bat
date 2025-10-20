@echo off
REM ===============================================
REM 山姆日志查询系统 - 任务计划程序配置脚本
REM 版本: v1.3.0
REM 说明: 通过Windows任务计划程序实现开机自启动
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
echo 山姆日志查询系统 - 任务计划程序配置
echo 版本: v1.3.0
echo ===============================================
echo.

set TASK_NAME=SamLogSystemStartup
set PROJECT_DIR=%~dp0
set STARTUP_SCRIPT=%PROJECT_DIR%start-service.bat

echo 项目目录: %PROJECT_DIR%
echo 启动脚本: %STARTUP_SCRIPT%
echo 任务名称: %TASK_NAME%
echo.

REM 检查启动脚本是否存在
if not exist "%STARTUP_SCRIPT%" (
    echo 错误: 启动脚本不存在: %STARTUP_SCRIPT%
    echo 请确保start-service.bat文件存在于项目根目录
    pause
    exit /b 1
)

REM 删除已存在的任务
echo 检查并删除已存在的任务...
schtasks /delete /tn "%TASK_NAME%" /f > nul 2>&1

echo 正在创建计划任务...
echo.

REM 创建任务计划
schtasks /create ^
    /tn "%TASK_NAME%" ^
    /tr "\"%STARTUP_SCRIPT%\" scheduled" ^
    /sc onstart ^
    /ru SYSTEM ^
    /rl highest ^
    /delay 0001:00 ^
    /f

if %errorLevel% neq 0 (
    echo 错误: 任务创建失败
    echo 错误代码: %errorLevel%
    echo.
    echo 尝试使用当前用户权限创建任务...
    
    REM 使用当前用户权限重试
    schtasks /create ^
        /tn "%TASK_NAME%" ^
        /tr "\"%STARTUP_SCRIPT%\" scheduled" ^
        /sc onstart ^
        /delay 0001:00 ^
        /f
    
    if %errorLevel% neq 0 (
        echo 任务创建仍然失败，请手动配置
        pause
        exit /b 1
    )
)

echo 任务创建成功！

REM 修改任务属性以提高稳定性
echo 配置任务高级属性...

REM 导出任务配置到临时XML文件
set TEMP_XML=%TEMP%\%TASK_NAME%.xml
schtasks /query /tn "%TASK_NAME%" /xml > "%TEMP_XML%"

REM 显示任务信息
echo.
echo 任务配置完成！
echo.
echo ===============================================
echo 任务计划详情:
echo.
echo 任务名称: %TASK_NAME%
echo 触发条件: 系统启动时
echo 启动延迟: 1分钟
echo 执行权限: 系统权限
echo 启动脚本: %STARTUP_SCRIPT%
echo.
echo 管理命令:
echo   查看任务: schtasks /query /tn "%TASK_NAME%"
echo   运行任务: schtasks /run /tn "%TASK_NAME%"
echo   删除任务: schtasks /delete /tn "%TASK_NAME%" /f
echo   禁用任务: schtasks /change /tn "%TASK_NAME%" /disable
echo   启用任务: schtasks /change /tn "%TASK_NAME%" /enable
echo.
echo 任务计划程序: taskschd.msc
echo 系统访问: http://localhost:3001
echo 登录账号: admin / admin123
echo ===============================================
echo.

REM 显示当前任务状态
echo 当前任务状态:
schtasks /query /tn "%TASK_NAME%" /fo table /nh
echo.

REM 询问是否立即测试任务
set /p test_now=是否立即测试任务运行？(y/n): 
if /i "%test_now%"=="y" (
    echo.
    echo 正在测试任务执行...
    schtasks /run /tn "%TASK_NAME%"
    if %errorLevel% equ 0 (
        echo 任务启动成功！
        echo 请等待约1-2分钟后访问 http://localhost:3001 检查服务状态
    ) else (
        echo 任务启动失败，请检查配置
    )
)

echo.
echo ===============================================
echo 重要说明:
echo.
echo 1. 计划任务将在系统启动1分钟后自动执行
echo 2. 如需修改启动延迟，可在任务计划程序中调整
echo 3. 建议定期检查任务执行日志
echo 4. 服务启动日志保存在 logs 目录下
echo.
echo 下次重启计算机时，系统将自动启动山姆日志查询系统
echo ===============================================
echo.

REM 清理临时文件
if exist "%TEMP_XML%" del /f /q "%TEMP_XML%" > nul 2>&1

echo 配置脚本执行完成
pause
