@echo off
REM ===============================================
REM 山姆日志查询系统 - 迁移验证脚本
REM 版本: v1.3.0
REM 说明: 验证迁移后的系统完整性和功能
REM ===============================================

REM 设置控制台编码为UTF-8
chcp 65001 > nul

echo.
echo ===============================================
echo 山姆日志查询系统 - 迁移验证
echo 版本: v1.3.0
echo ===============================================
echo.

set PROJECT_DIR=%~dp0

REM 安全的时间戳生成 - 修复日期格式问题
set year=%date:~0,4%
set month=%date:~5,2%
set day=%date:~8,2%
set hour=%time:~0,2%
set minute=%time:~3,2%
set second=%time:~6,2%

REM 去除空格并补零
if "%hour:~0,1%"==" " set hour=0%hour:~1,1%
if "%minute:~0,1%"==" " set minute=0%minute:~1,1%
if "%second:~0,1%"==" " set second=0%second:~1,1%

REM 生成标准格式的时间戳 (YYYY-MM-DD_HH-MM-SS)
set TIMESTAMP=%year%-%month%-%day%_%hour%-%minute%-%second%
set LOG_FILE=%PROJECT_DIR%logs\verify-%TIMESTAMP%.log

echo 验证时间: %date% %time%
echo 验证系统: %COMPUTERNAME%
echo 项目目录: %PROJECT_DIR%
echo.

REM 创建日志目录
if not exist "%PROJECT_DIR%logs" mkdir "%PROJECT_DIR%logs"

REM 记录验证开始
echo [%date% %time%] 开始迁移验证 >> "%LOG_FILE%"

echo 正在进行系统验证...
echo.

set TOTAL_CHECKS=15
set PASSED_CHECKS=0
set FAILED_CHECKS=0

REM 1. 验证项目文件结构
echo [1/%TOTAL_CHECKS%] 验证项目文件结构...
set /a CHECK_COUNT=1
if exist "%PROJECT_DIR%backend\app.js" (
    echo   ✅ 后端主程序存在
    set /a PASSED_CHECKS+=1
) else (
    echo   ❌ 后端主程序缺失
    set /a FAILED_CHECKS+=1
)

if exist "%PROJECT_DIR%package.json" (
    echo   ✅ 项目配置文件存在
    set /a PASSED_CHECKS+=1
) else (
    echo   ❌ 项目配置文件缺失
    set /a FAILED_CHECKS+=1
)

if exist "%PROJECT_DIR%ecosystem.config.js" (
    echo   ✅ PM2配置文件存在
    set /a PASSED_CHECKS+=1
) else (
    echo   ❌ PM2配置文件缺失
    set /a FAILED_CHECKS+=1
)

echo [%date% %time%] 项目文件结构验证完成 >> "%LOG_FILE%"

REM 2. 验证Node.js环境
echo [2/%TOTAL_CHECKS%] 验证Node.js环境...
node --version >nul 2>&1
if errorlevel 1 (
    echo   ❌ Node.js未安装或不可用
    set /a FAILED_CHECKS+=1
    echo [%date% %time%] Node.js环境验证失败 >> "%LOG_FILE%"
) else (
    echo   ✅ Node.js环境正常
    node --version | findstr /C:"v" | find /C:"v" >nul && (
        set /a PASSED_CHECKS+=1
        echo [%date% %time%] Node.js环境验证通过 >> "%LOG_FILE%"
    )
)

REM 3. 验证npm依赖
echo [3/%TOTAL_CHECKS%] 验证npm依赖...
if exist "%PROJECT_DIR%node_modules" (
    echo   ✅ 项目依赖已安装
    set /a PASSED_CHECKS+=1
    echo [%date% %time%] npm依赖验证通过 >> "%LOG_FILE%"
) else (
    echo   ❌ 项目依赖未安装
    set /a FAILED_CHECKS+=1
    echo [%date% %time%] npm依赖验证失败 >> "%LOG_FILE%"
)

REM 4. 验证数据库文件
echo [4/%TOTAL_CHECKS%] 验证数据库文件...
if exist "%PROJECT_DIR%backend\database\sam_logs.db" (
    echo   ✅ 数据库文件存在
    
    REM 获取文件大小
    for %%I in ("%PROJECT_DIR%backend\database\sam_logs.db") do set DB_SIZE=%%~zI
    if %DB_SIZE% GTR 1000 (
        echo   ✅ 数据库文件大小正常 (%DB_SIZE% 字节)
        set /a PASSED_CHECKS+=1
        echo [%date% %time%] 数据库文件验证通过，大小: %DB_SIZE% 字节 >> "%LOG_FILE%"
    ) else (
        echo   ⚠️ 数据库文件可能为空或损坏
        set /a FAILED_CHECKS+=1
        echo [%date% %time%] 数据库文件验证失败，大小异常 >> "%LOG_FILE%"
    )
) else (
    echo   ❌ 数据库文件不存在
    set /a FAILED_CHECKS+=1
    echo [%date% %time%] 数据库文件验证失败，文件不存在 >> "%LOG_FILE%"
)

REM 5. 验证数据库结构和数据
echo [5/%TOTAL_CHECKS%] 验证数据库结构...
node -e "
try {
    const sqlite3 = require('sqlite3');
    const path = require('path');
    const dbPath = path.join(__dirname, 'backend/database/sam_logs.db');
    const db = new sqlite3.Database(dbPath);
    
    // 检查表结构
    db.all('SELECT name FROM sqlite_master WHERE type=\"table\"', (err, tables) => {
        if (err) {
            console.log('数据库结构检查失败: ' + err.message);
            process.exit(1);
        }
        
        const requiredTables = ['sam_records', 'users', 'processing_log'];
        const existingTables = tables.map(t => t.name);
        const missingTables = requiredTables.filter(t => !existingTables.includes(t));
        
        if (missingTables.length > 0) {
            console.log('缺少数据表: ' + missingTables.join(', '));
            process.exit(1);
        }
        
        // 检查记录数量
        db.get('SELECT COUNT(*) as count FROM sam_records', (err, row) => {
            if (err) {
                console.log('数据记录检查失败: ' + err.message);
                process.exit(1);
            }
            
            console.log('数据库结构正常，记录总数: ' + row.count);
            db.close();
            process.exit(0);
        });
    });
} catch (error) {
    console.log('数据库验证错误: ' + error.message);
    process.exit(1);
}
" 2>nul

if errorlevel 1 (
    echo   ❌ 数据库结构验证失败
    set /a FAILED_CHECKS+=1
    echo [%date% %time%] 数据库结构验证失败 >> "%LOG_FILE%"
) else (
    echo   ✅ 数据库结构验证通过
    set /a PASSED_CHECKS+=1
    echo [%date% %time%] 数据库结构验证通过 >> "%LOG_FILE%"
)

REM 6. 验证端口可用性
echo [6/%TOTAL_CHECKS%] 验证端口可用性...
netstat -an | findstr ":3001" >nul
if errorlevel 1 (
    echo   ✅ 端口3001可用
    set /a PASSED_CHECKS+=1
    echo [%date% %time%] 端口3001可用 >> "%LOG_FILE%"
) else (
    echo   ⚠️ 端口3001已被占用
    set /a FAILED_CHECKS+=1
    echo [%date% %time%] 端口3001被占用 >> "%LOG_FILE%"
)

REM 7. 测试服务启动
echo [7/%TOTAL_CHECKS%] 测试服务启动...
echo   正在启动测试服务...

REM 启动服务
start /min "验证测试" cmd /c "cd /d \"%PROJECT_DIR%\" && node backend/app.js"
echo   等待服务启动...
timeout /t 8 >nul

REM 测试HTTP响应
curl -s -m 5 http://localhost:3001/health >nul 2>&1
if errorlevel 1 (
    echo   ❌ 服务启动测试失败
    set /a FAILED_CHECKS+=1
    echo [%date% %time%] 服务启动测试失败 >> "%LOG_FILE%"
) else (
    echo   ✅ 服务启动测试通过
    set /a PASSED_CHECKS+=1
    echo [%date% %time%] 服务启动测试通过 >> "%LOG_FILE%"
)

REM 停止测试服务
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 >nul

REM 8. 验证HTTP健康检查
echo [8/%TOTAL_CHECKS%] 验证HTTP健康检查...
start /min "健康检查测试" cmd /c "cd /d \"%PROJECT_DIR%\" && node backend/app.js"
timeout /t 8 >nul

curl -s -m 5 http://localhost:3001/health | findstr "healthy" >nul 2>&1
if errorlevel 1 (
    echo   ❌ 健康检查失败
    set /a FAILED_CHECKS+=1
    echo [%date% %time%] 健康检查失败 >> "%LOG_FILE%"
) else (
    echo   ✅ 健康检查通过
    set /a PASSED_CHECKS+=1
    echo [%date% %time%] 健康检查通过 >> "%LOG_FILE%"
)

taskkill /f /im node.exe >nul 2>&1
timeout /t 2 >nul

REM 9. 验证登录功能
echo [9/%TOTAL_CHECKS%] 验证登录功能...
start /min "登录测试" cmd /c "cd /d \"%PROJECT_DIR%\" && node backend/app.js"
timeout /t 8 >nul

curl -X POST -m 5 http://localhost:3001/api/auth/login ^
     -H "Content-Type: application/json" ^
     -d "{\"username\":\"admin\",\"password\":\"admin123\"}" >nul 2>&1
if errorlevel 1 (
    echo   ❌ 登录功能测试失败
    set /a FAILED_CHECKS+=1
    echo [%date% %time%] 登录功能测试失败 >> "%LOG_FILE%"
) else (
    echo   ✅ 登录功能测试通过
    set /a PASSED_CHECKS+=1
    echo [%date% %time%] 登录功能测试通过 >> "%LOG_FILE%"
)

taskkill /f /im node.exe >nul 2>&1
timeout /t 2 >nul

REM 10. 验证前端文件
echo [10/%TOTAL_CHECKS%] 验证前端文件...
if exist "%PROJECT_DIR%frontend\index.html" (
    echo   ✅ 前端主页面存在
    set /a PASSED_CHECKS+=1
    echo [%date% %time%] 前端文件验证通过 >> "%LOG_FILE%"
) else (
    echo   ❌ 前端主页面缺失
    set /a FAILED_CHECKS+=1
    echo [%date% %time%] 前端文件验证失败 >> "%LOG_FILE%"
)

REM 11. 验证启动脚本
echo [11/%TOTAL_CHECKS%] 验证启动脚本...
if exist "%PROJECT_DIR%start-service.bat" (
    echo   ✅ 启动脚本存在
    set /a PASSED_CHECKS+=1
    echo [%date% %time%] 启动脚本验证通过 >> "%LOG_FILE%"
) else (
    echo   ❌ 启动脚本缺失
    set /a FAILED_CHECKS+=1
    echo [%date% %time%] 启动脚本验证失败 >> "%LOG_FILE%"
)

REM 12. 验证管理工具
echo [12/%TOTAL_CHECKS%] 验证管理工具...
if exist "%PROJECT_DIR%service-manager.bat" (
    echo   ✅ 管理工具存在
    set /a PASSED_CHECKS+=1
    echo [%date% %time%] 管理工具验证通过 >> "%LOG_FILE%"
) else (
    echo   ❌ 管理工具缺失
    set /a FAILED_CHECKS+=1
    echo [%date% %time%] 管理工具验证失败 >> "%LOG_FILE%"
)

REM 13. 验证文档文件
echo [13/%TOTAL_CHECKS%] 验证文档文件...
if exist "%PROJECT_DIR%README.md" (
    echo   ✅ 主要文档存在
    set /a PASSED_CHECKS+=1
    echo [%date% %time%] 文档文件验证通过 >> "%LOG_FILE%"
) else (
    echo   ❌ 主要文档缺失
    set /a FAILED_CHECKS+=1
    echo [%date% %time%] 文档文件验证失败 >> "%LOG_FILE%"
)

REM 14. 验证日志目录
echo [14/%TOTAL_CHECKS%] 验证日志目录...
if exist "%PROJECT_DIR%logs" (
    echo   ✅ 日志目录存在
    set /a PASSED_CHECKS+=1
    echo [%date% %time%] 日志目录验证通过 >> "%LOG_FILE%"
) else (
    echo   ⚠️ 日志目录不存在，将自动创建
    mkdir "%PROJECT_DIR%logs"
    set /a PASSED_CHECKS+=1
    echo [%date% %time%] 日志目录已创建 >> "%LOG_FILE%"
)

REM 15. 验证自启动配置
echo [15/%TOTAL_CHECKS%] 验证自启动配置...

REM 检查Windows服务
sc query SamLogSystem >nul 2>&1
if errorlevel 1 (
    set SERVICE_STATUS=未安装
) else (
    set SERVICE_STATUS=已安装
)

REM 检查任务计划
schtasks /query /tn "SamLogSystemStartup" >nul 2>&1
if errorlevel 1 (
    set TASK_STATUS=未配置
) else (
    set TASK_STATUS=已配置
)

REM 检查PM2
pm2 list | findstr "sam-log-system" >nul 2>&1
if errorlevel 1 (
    set PM2_STATUS=未配置
) else (
    set PM2_STATUS=已配置
)

echo   Windows服务: %SERVICE_STATUS%
echo   任务计划: %TASK_STATUS%
echo   PM2自启动: %PM2_STATUS%

if "%SERVICE_STATUS%"=="已安装" (
    set /a PASSED_CHECKS+=1
) else if "%TASK_STATUS%"=="已配置" (
    set /a PASSED_CHECKS+=1
) else if "%PM2_STATUS%"=="已配置" (
    set /a PASSED_CHECKS+=1
) else (
    echo   ⚠️ 未配置自启动
    set /a FAILED_CHECKS+=1
)

echo [%date% %time%] 自启动配置验证完成 >> "%LOG_FILE%"

REM 计算通过率
set /a PASS_RATE=(%PASSED_CHECKS% * 100) / %TOTAL_CHECKS%

echo.
echo ===============================================
echo 🔍 验证结果汇总
echo ===============================================
echo.
echo 验证项目: %TOTAL_CHECKS%
echo 通过项目: %PASSED_CHECKS%
echo 失败项目: %FAILED_CHECKS%
echo 通过率: %PASS_RATE%%%
echo.

if %PASS_RATE% GEQ 90 (
    echo ✅ 验证结果: 优秀
    echo 系统迁移成功，所有核心功能正常！
) else if %PASS_RATE% GEQ 80 (
    echo ⚠️ 验证结果: 良好
    echo 系统基本功能正常，但有少量问题需要注意。
) else if %PASS_RATE% GEQ 60 (
    echo ⚠️ 验证结果: 一般
    echo 系统可以运行，但建议解决发现的问题。
) else (
    echo ❌ 验证结果: 需要修复
    echo 发现较多问题，建议重新部署或修复后再使用。
)

echo.
echo 详细建议:
echo.

if %FAILED_CHECKS% GTR 0 (
    echo 🔧 问题修复建议:
    if exist "%PROJECT_DIR%backend\app.js" (
        echo   - 已检测到后端程序
    ) else (
        echo   - 缺少后端程序，请重新复制项目文件
    )
    
    if exist "%PROJECT_DIR%node_modules" (
        echo   - 依赖已安装
    ) else (
        echo   - 运行 npm install 安装依赖
    )
    
    if exist "%PROJECT_DIR%backend\database\sam_logs.db" (
        echo   - 数据库文件存在
    ) else (
        echo   - 运行 npm run init-db 初始化数据库
    )
    
    echo   - 如有网络问题，检查防火墙和端口设置
    echo   - 如有权限问题，使用管理员权限运行
    echo.
)

echo 📋 下一步操作:
echo 1. 如验证通过，运行 start-service.bat 启动服务
echo 2. 访问 http://localhost:3001 测试界面
echo 3. 使用 admin/admin123 登录系统
echo 4. 测试日志查询功能
echo 5. 如需自启动，运行 service-manager.bat 配置
echo.

echo 📁 重要文件位置:
echo - 启动服务: start-service.bat
echo - 管理工具: service-manager.bat  
echo - 系统日志: logs\ 目录
echo - 验证日志: %LOG_FILE%
echo.

if exist "%PROJECT_DIR%BACKUP_INFO.txt" (
    echo 📊 迁移信息:
    type "%PROJECT_DIR%BACKUP_INFO.txt" | findstr "源系统\|备份时间\|数据库记录总数"
    echo.
)

echo ===============================================
echo.

echo [%date% %time%] 验证任务完成，通过率: %PASS_RATE%%% >> "%LOG_FILE%"

pause
