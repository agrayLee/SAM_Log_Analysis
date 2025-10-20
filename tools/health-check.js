/**
 * 系统健康检查工具
 * 验证网络连接、文件访问、程序依赖等系统状态
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class HealthChecker {
    constructor() {
        this.checks = [];
        this.results = {
            passed: 0,
            failed: 0,
            warnings: 0,
            details: []
        };
    }
    
    /**
     * 输出带颜色的文本
     */
    colorLog(text, color = 'white') {
        const colors = {
            red: '\x1b[31m',
            green: '\x1b[32m',
            yellow: '\x1b[33m',
            blue: '\x1b[34m',
            white: '\x1b[37m',
            reset: '\x1b[0m'
        };
        
        console.log(colors[color] + text + colors.reset);
    }
    
    /**
     * 添加检查结果
     */
    addResult(name, status, message, details = {}) {
        const result = {
            name,
            status, // 'pass', 'fail', 'warn'
            message,
            details,
            timestamp: new Date().toISOString()
        };
        
        this.results.details.push(result);
        
        if (status === 'pass') {
            this.results.passed++;
            this.colorLog(`✅ ${name}: ${message}`, 'green');
        } else if (status === 'fail') {
            this.results.failed++;
            this.colorLog(`❌ ${name}: ${message}`, 'red');
        } else if (status === 'warn') {
            this.results.warnings++;
            this.colorLog(`⚠️  ${name}: ${message}`, 'yellow');
        }
    }
    
    /**
     * 检查Node.js版本
     */
    checkNodeVersion() {
        try {
            const version = process.version;
            const majorVersion = parseInt(version.substring(1).split('.')[0]);
            
            if (majorVersion >= 14) {
                this.addResult(
                    'Node.js版本',
                    'pass',
                    `版本 ${version} (满足要求 >=14.0.0)`,
                    { version, majorVersion }
                );
            } else {
                this.addResult(
                    'Node.js版本',
                    'fail',
                    `版本 ${version} 不满足要求 (需要 >=14.0.0)`,
                    { version, majorVersion }
                );
            }
        } catch (error) {
            this.addResult(
                'Node.js版本',
                'fail',
                `检查失败: ${error.message}`,
                { error: error.message }
            );
        }
    }
    
    /**
     * 检查操作系统
     */
    checkOperatingSystem() {
        try {
            const platform = os.platform();
            const type = os.type();
            const release = os.release();
            
            if (platform === 'win32') {
                this.addResult(
                    '操作系统',
                    'pass',
                    `Windows ${release} (支持网络共享访问)`,
                    { platform, type, release }
                );
            } else {
                this.addResult(
                    '操作系统',
                    'warn',
                    `${type} ${release} (可能不支持Windows网络共享)`,
                    { platform, type, release }
                );
            }
        } catch (error) {
            this.addResult(
                '操作系统',
                'fail',
                `检查失败: ${error.message}`,
                { error: error.message }
            );
        }
    }
    
    /**
     * 检查项目目录结构
     */
    checkProjectStructure() {
        const requiredDirs = ['src', 'logs', 'tests', 'docs', 'tools'];
        const requiredFiles = ['package.json', 'src/index.js', 'src/logger.js'];
        
        let missingDirs = [];
        let missingFiles = [];
        
        // 检查目录
        requiredDirs.forEach(dir => {
            const dirPath = path.join(__dirname, '..', dir);
            if (!fs.existsSync(dirPath)) {
                missingDirs.push(dir);
            }
        });
        
        // 检查文件
        requiredFiles.forEach(file => {
            const filePath = path.join(__dirname, '..', file);
            if (!fs.existsSync(filePath)) {
                missingFiles.push(file);
            }
        });
        
        if (missingDirs.length === 0 && missingFiles.length === 0) {
            this.addResult(
                '项目结构',
                'pass',
                '所有必需的目录和文件都存在',
                { requiredDirs, requiredFiles }
            );
        } else {
            this.addResult(
                '项目结构',
                'fail',
                `缺少: 目录[${missingDirs.join(', ')}] 文件[${missingFiles.join(', ')}]`,
                { missingDirs, missingFiles }
            );
        }
    }
    
    /**
     * 检查日志目录写入权限
     */
    checkLogDirectory() {
        try {
            const logDir = path.join(__dirname, '..', 'logs');
            
            // 确保目录存在
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            
            // 测试写入权限
            const testFile = path.join(logDir, 'health-check-test.log');
            const testContent = `健康检查测试 - ${new Date().toISOString()}\\n`;
            
            fs.writeFileSync(testFile, testContent, 'utf8');
            
            // 测试读取
            const readContent = fs.readFileSync(testFile, 'utf8');
            
            // 清理测试文件
            fs.unlinkSync(testFile);
            
            if (readContent === testContent) {
                this.addResult(
                    '日志目录权限',
                    'pass',
                    '日志目录读写权限正常',
                    { logDir }
                );
            } else {
                this.addResult(
                    '日志目录权限',
                    'fail',
                    '日志目录读写权限异常',
                    { logDir }
                );
            }
            
        } catch (error) {
            this.addResult(
                '日志目录权限',
                'fail',
                `权限检查失败: ${error.message}`,
                { error: error.message }
            );
        }
    }
    
    /**
     * 检查网络连通性
     */
    checkNetworkConnectivity() {
        try {
            const targetHost = '10.21.189.125';
            let pingCommand;
            
            if (os.platform() === 'win32') {
                pingCommand = `ping -n 1 ${targetHost}`;
            } else {
                pingCommand = `ping -c 1 ${targetHost}`;
            }
            
            const result = execSync(pingCommand, { 
                encoding: 'utf8',
                timeout: 10000 
            });
            
            if (result.includes('TTL') || result.includes('time=')) {
                this.addResult(
                    '网络连通性',
                    'pass',
                    `目标主机 ${targetHost} 连通正常`,
                    { targetHost, pingResult: 'success' }
                );
            } else {
                this.addResult(
                    '网络连通性',
                    'warn',
                    `目标主机 ${targetHost} 连通异常`,
                    { targetHost, pingResult: 'failed' }
                );
            }
            
        } catch (error) {
            this.addResult(
                '网络连通性',
                'fail',
                `网络连通性检查失败: ${error.message}`,
                { error: error.message }
            );
        }
    }
    
    /**
     * 检查Windows命令行工具
     */
    checkWindowsCommands() {
        const commands = ['net', 'dir', 'powershell'];
        
        commands.forEach(cmd => {
            try {
                let testCommand;
                if (cmd === 'net') {
                    // 使用net use命令测试（显示当前连接）
                    testCommand = 'net use';
                } else if (cmd === 'dir') {
                    // 使用简单的dir命令测试当前目录
                    testCommand = 'dir .';
                } else if (cmd === 'powershell') {
                    testCommand = 'powershell -Command "Get-Date"';
                }
                
                execSync(testCommand, { 
                    encoding: 'utf8',
                    timeout: 5000,
                    stdio: 'pipe'
                });
                
                this.addResult(
                    `命令行工具 ${cmd}`,
                    'pass',
                    `${cmd} 命令可用`,
                    { command: cmd }
                );
                
            } catch (error) {
                this.addResult(
                    `命令行工具 ${cmd}`,
                    'fail',
                    `${cmd} 命令不可用: ${error.message}`,
                    { command: cmd, error: error.message }
                );
            }
        });
    }
    
    /**
     * 检查内存使用情况
     */
    checkMemoryUsage() {
        try {
            const memoryUsage = process.memoryUsage();
            const systemMemory = {
                total: os.totalmem(),
                free: os.freemem(),
                used: os.totalmem() - os.freemem()
            };
            
            const usagePercent = (systemMemory.used / systemMemory.total) * 100;
            
            if (usagePercent < 80) {
                this.addResult(
                    '内存使用情况',
                    'pass',
                    `系统内存充足 (使用率: ${usagePercent.toFixed(1)}%)`,
                    { memoryUsage, systemMemory, usagePercent }
                );
            } else if (usagePercent < 90) {
                this.addResult(
                    '内存使用情况',
                    'warn',
                    `系统内存使用较高 (使用率: ${usagePercent.toFixed(1)}%)`,
                    { memoryUsage, systemMemory, usagePercent }
                );
            } else {
                this.addResult(
                    '内存使用情况',
                    'fail',
                    `系统内存不足 (使用率: ${usagePercent.toFixed(1)}%)`,
                    { memoryUsage, systemMemory, usagePercent }
                );
            }
            
        } catch (error) {
            this.addResult(
                '内存使用情况',
                'fail',
                `内存检查失败: ${error.message}`,
                { error: error.message }
            );
        }
    }
    
    /**
     * 运行所有健康检查
     */
    async runAllChecks() {
        this.colorLog('\\n🏥 ========== 系统健康检查开始 ==========', 'blue');
        this.colorLog(`检查时间: ${new Date().toLocaleString()}`, 'blue');
        
        console.log('\\n正在执行系统检查...');
        
        this.checkNodeVersion();
        this.checkOperatingSystem();
        this.checkProjectStructure();
        this.checkLogDirectory();
        this.checkNetworkConnectivity();
        this.checkWindowsCommands();
        this.checkMemoryUsage();
        
        this.printSummary();
        this.saveResults();
    }
    
    /**
     * 打印检查摘要
     */
    printSummary() {
        console.log('\\n📊 ========== 检查结果摘要 ==========');
        
        this.colorLog(`✅ 通过: ${this.results.passed}`, 'green');
        this.colorLog(`⚠️  警告: ${this.results.warnings}`, 'yellow');
        this.colorLog(`❌ 失败: ${this.results.failed}`, 'red');
        
        const total = this.results.passed + this.results.warnings + this.results.failed;
        const healthScore = ((this.results.passed + this.results.warnings * 0.5) / total * 100).toFixed(1);
        
        console.log(`\\n🎯 系统健康评分: ${healthScore}/100`);
        
        if (this.results.failed > 0) {
            this.colorLog('\\n❗ 发现严重问题，建议修复后再运行主程序', 'red');
        } else if (this.results.warnings > 0) {
            this.colorLog('\\n⚠️  发现一些警告，程序可能可以运行但建议检查', 'yellow');
        } else {
            this.colorLog('\\n🎉 系统状态良好，可以正常运行程序', 'green');
        }
    }
    
    /**
     * 保存检查结果到文件
     */
    saveResults() {
        try {
            const logDir = path.join(__dirname, '..', 'logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const resultFile = path.join(logDir, `health-check-${timestamp}.json`);
            
            const reportData = {
                timestamp: new Date().toISOString(),
                summary: {
                    passed: this.results.passed,
                    warnings: this.results.warnings,
                    failed: this.results.failed,
                    total: this.results.passed + this.results.warnings + this.results.failed
                },
                details: this.results.details
            };
            
            fs.writeFileSync(resultFile, JSON.stringify(reportData, null, 2), 'utf8');
            
            console.log(`\\n💾 检查结果已保存到: ${resultFile}`);
            
        } catch (error) {
            this.colorLog(`保存检查结果失败: ${error.message}`, 'red');
        }
    }
}

// 主函数
async function main() {
    const checker = new HealthChecker();
    await checker.runAllChecks();
}

// 如果直接运行此文件
if (require.main === module) {
    main().catch(console.error);
}

module.exports = HealthChecker;
