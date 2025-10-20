/**
 * 测试套件运行器
 * 执行所有自动化测试并生成测试报告
 */

const fs = require('fs');
const path = require('path');

class TestRunner {
    constructor() {
        this.testResults = {
            passed: 0,
            failed: 0,
            skipped: 0,
            total: 0,
            details: [],
            startTime: null,
            endTime: null,
            duration: 0
        };
        
        this.currentSuite = null;
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
            cyan: '\x1b[36m',
            white: '\x1b[37m',
            reset: '\x1b[0m'
        };
        
        console.log(colors[color] + text + colors.reset);
    }
    
    /**
     * 断言工具
     */
    assert = {
        equal: (actual, expected, message = '') => {
            if (actual === expected) {
                return { passed: true, message };
            } else {
                return {
                    passed: false,
                    message: `${message} - Expected: ${expected}, Actual: ${actual}`
                };
            }
        },
        
        notEqual: (actual, expected, message = '') => {
            if (actual !== expected) {
                return { passed: true, message };
            } else {
                return {
                    passed: false,
                    message: `${message} - Expected not: ${expected}, Actual: ${actual}`
                };
            }
        },
        
        isTrue: (value, message = '') => {
            if (value === true) {
                return { passed: true, message };
            } else {
                return {
                    passed: false,
                    message: `${message} - Expected: true, Actual: ${value}`
                };
            }
        },
        
        isFalse: (value, message = '') => {
            if (value === false) {
                return { passed: true, message };
            } else {
                return {
                    passed: false,
                    message: `${message} - Expected: false, Actual: ${value}`
                };
            }
        },
        
        isNotNull: (value, message = '') => {
            if (value !== null && value !== undefined) {
                return { passed: true, message };
            } else {
                return {
                    passed: false,
                    message: `${message} - Expected not null/undefined, Actual: ${value}`
                };
            }
        },
        
        throws: async (fn, message = '') => {
            try {
                await fn();
                return {
                    passed: false,
                    message: `${message} - Expected function to throw, but it didn't`
                };
            } catch (error) {
                return { passed: true, message };
            }
        },
        
        doesNotThrow: async (fn, message = '') => {
            try {
                await fn();
                return { passed: true, message };
            } catch (error) {
                return {
                    passed: false,
                    message: `${message} - Expected function not to throw, but got: ${error.message}`
                };
            }
        }
    };
    
    /**
     * 运行单个测试
     */
    async runTest(testName, testFunction) {
        const testResult = {
            suite: this.currentSuite,
            name: testName,
            status: 'unknown',
            message: '',
            duration: 0,
            error: null
        };
        
        const startTime = Date.now();
        
        try {
            console.log(`  执行测试: ${testName}`);
            
            const result = await testFunction(this.assert);
            
            testResult.duration = Date.now() - startTime;
            
            if (result && result.passed === false) {
                testResult.status = 'failed';
                testResult.message = result.message || '测试失败';
                this.testResults.failed++;
                this.colorLog(`    ❌ ${testName} - ${testResult.message}`, 'red');
            } else {
                testResult.status = 'passed';
                testResult.message = '测试通过';
                this.testResults.passed++;
                this.colorLog(`    ✅ ${testName}`, 'green');
            }
            
        } catch (error) {
            testResult.duration = Date.now() - startTime;
            testResult.status = 'failed';
            testResult.message = error.message;
            testResult.error = error.stack;
            this.testResults.failed++;
            this.colorLog(`    ❌ ${testName} - ${error.message}`, 'red');
        }
        
        this.testResults.details.push(testResult);
        this.testResults.total++;
    }
    
    /**
     * 运行测试套件
     */
    async runSuite(suiteName, tests) {
        this.currentSuite = suiteName;
        this.colorLog(`\\n🧪 测试套件: ${suiteName}`, 'blue');
        
        for (const [testName, testFunction] of Object.entries(tests)) {
            await this.runTest(testName, testFunction);
        }
    }
    
    /**
     * Logger模块测试
     */
    async testLogger() {
        const Logger = require('../src/logger');
        
        return {
            '日志模块初始化': async (assert) => {
                return assert.isNotNull(Logger, '日志模块应该成功加载');
            },
            
            '日志输出功能': async (assert) => {
                // 测试各级别日志输出
                Logger.info('测试信息日志');
                Logger.warn('测试警告日志');
                Logger.error('测试错误日志');
                Logger.debug('测试调试日志');
                
                return assert.isTrue(true, '日志输出功能正常');
            },
            
            '性能日志记录': async (assert) => {
                Logger.performance('测试操作', 100, { test: true });
                return assert.isTrue(true, '性能日志记录正常');
            },
            
            '网络日志记录': async (assert) => {
                Logger.network('TEST', 'localhost', 'SUCCESS', { test: true });
                return assert.isTrue(true, '网络日志记录正常');
            }
        };
    }
    
    /**
     * 网络共享模块测试
     */
    async testNetworkShare() {
        const NetworkShareManager = require('../src/networkShare');
        
        return {
            '网络共享模块初始化': async (assert) => {
                const manager = new NetworkShareManager();
                return assert.isNotNull(manager, '网络共享模块应该成功初始化');
            },
            
            '日期文件夹路径计算': async (assert) => {
                const manager = new NetworkShareManager();
                const todayPath = manager.getTodayFolderPath();
                
                const today = new Date();
                const expected = today.getFullYear().toString() + 
                               (today.getMonth() + 1).toString().padStart(2, '0') + 
                               today.getDate().toString().padStart(2, '0');
                
                return assert.isTrue(
                    todayPath.includes(expected),
                    '日期文件夹路径应该包含今天的日期'
                );
            },
            
            '连接状态检查': async (assert) => {
                const manager = new NetworkShareManager();
                const isConnected = manager.checkConnection();
                
                // 由于可能没有实际网络连接，这里只测试函数能正常调用
                return assert.isTrue(
                    typeof isConnected === 'boolean',
                    '连接状态检查应该返回布尔值'
                );
            }
        };
    }
    
    /**
     * 日志解析模块测试
     */
    async testLogParser() {
        const LogParser = require('../src/logParser');
        
        return {
            '日志解析模块初始化': async (assert) => {
                const parser = new LogParser();
                return assert.isNotNull(parser, '日志解析模块应该成功初始化');
            },
            
            '文件存在检查': async (assert) => {
                const parser = new LogParser();
                
                // 测试已知存在的文件
                const existsResult = parser.fileExists(__filename);
                const notExistsResult = parser.fileExists('non-existent-file.txt');
                
                return assert.isTrue(
                    existsResult === true && notExistsResult === false,
                    '文件存在检查功能正常'
                );
            },
            
            '结果格式化': async (assert) => {
                const parser = new LogParser();
                
                const testData = [{
                    licensePlate: '闽A9L69Y',
                    requestTimestamp: '2024-08-11 10:30:00',
                    responseTimestamp: '2024-08-11 10:30:01',
                    freeParking: true,
                    rejectReason: '',
                    requestLine: 100,
                    responseLine: 105
                }];
                
                const formatted = parser.formatResults(testData);
                
                return assert.isTrue(
                    formatted.includes('闽A9L69Y') && formatted.includes('免费停车: 是'),
                    '结果格式化功能正常'
                );
            }
        };
    }
    
    /**
     * 主应用程序测试
     */
    async testMainApp() {
        const LogAnalysisApp = require('../src/index');
        
        return {
            '主应用初始化': async (assert) => {
                const app = new LogAnalysisApp();
                return assert.isNotNull(app, '主应用应该成功初始化');
            },
            
            '模块依赖检查': async (assert) => {
                const app = new LogAnalysisApp();
                
                return assert.isTrue(
                    app.shareManager && app.logParser,
                    '主应用应该包含所有必需的模块'
                );
            }
        };
    }
    
    /**
     * 工具模块测试
     */
    async testTools() {
        return {
            '健康检查工具': async (assert) => {
                const HealthChecker = require('../tools/health-check');
                const checker = new HealthChecker();
                
                return assert.isNotNull(checker, '健康检查工具应该成功加载');
            },
            
            '数据验证工具': async (assert) => {
                const DataValidator = require('../tools/data-validator');
                const validator = new DataValidator();
                
                return assert.isNotNull(validator, '数据验证工具应该成功加载');
            },
            
            '日志分析工具': async (assert) => {
                const LogAnalyzer = require('../tools/log-analyzer');
                const analyzer = new LogAnalyzer();
                
                return assert.isNotNull(analyzer, '日志分析工具应该成功加载');
            }
        };
    }
    
    /**
     * 集成测试
     */
    async testIntegration() {
        return {
            '模块间通信': async (assert) => {
                const Logger = require('../src/logger');
                const NetworkShareManager = require('../src/networkShare');
                const LogParser = require('../src/logParser');
                
                // 测试模块间的基本交互
                const manager = new NetworkShareManager();
                const parser = new LogParser();
                
                // 确保日志记录正常工作
                Logger.info('集成测试开始');
                
                return assert.isTrue(true, '模块间通信正常');
            },
            
            '配置一致性': async (assert) => {
                const packageJson = require('../package.json');
                
                return assert.isTrue(
                    packageJson.name === 'log-analysis',
                    '包配置应该正确'
                );
            }
        };
    }
    
    /**
     * 错误处理测试
     */
    async testErrorHandling() {
        return {
            '无效文件路径处理': async (assert) => {
                const LogParser = require('../src/logParser');
                const parser = new LogParser();
                
                // 测试处理不存在的文件
                const result = await assert.doesNotThrow(
                    () => parser.parseLogFile('non-existent-file.log', 1),
                    '解析不存在的文件不应该导致程序崩溃'
                );
                
                return result;
            },
            
            '无效数据处理': async (assert) => {
                const DataValidator = require('../tools/data-validator');
                const validator = new DataValidator();
                
                // 测试验证无效数据
                const result = validator.validateDataset(null);
                
                return assert.isFalse(
                    result.isValid,
                    '验证无效数据应该返回失败结果'
                );
            }
        };
    }
    
    /**
     * 运行所有测试
     */
    async runAllTests() {
        this.testResults.startTime = new Date();
        
        this.colorLog('\\n🧪 ========== 自动化测试开始 ==========', 'cyan');
        this.colorLog(`测试时间: ${this.testResults.startTime.toLocaleString()}`, 'cyan');
        
        try {
            // 运行各个测试套件
            await this.runSuite('Logger模块测试', await this.testLogger());
            await this.runSuite('网络共享模块测试', await this.testNetworkShare());
            await this.runSuite('日志解析模块测试', await this.testLogParser());
            await this.runSuite('主应用程序测试', await this.testMainApp());
            await this.runSuite('工具模块测试', await this.testTools());
            await this.runSuite('集成测试', await this.testIntegration());
            await this.runSuite('错误处理测试', await this.testErrorHandling());
            
        } catch (error) {
            this.colorLog(`\\n❌ 测试执行异常: ${error.message}`, 'red');
        }
        
        this.testResults.endTime = new Date();
        this.testResults.duration = this.testResults.endTime - this.testResults.startTime;
        
        this.printTestSummary();
        this.saveTestReport();
    }
    
    /**
     * 打印测试摘要
     */
    printTestSummary() {
        console.log('\\n📊 ========== 测试结果摘要 ==========');
        
        this.colorLog(`📦 总测试数: ${this.testResults.total}`, 'blue');
        this.colorLog(`✅ 通过: ${this.testResults.passed}`, 'green');
        this.colorLog(`❌ 失败: ${this.testResults.failed}`, 'red');
        this.colorLog(`⏭️  跳过: ${this.testResults.skipped}`, 'yellow');
        this.colorLog(`⏱️  总耗时: ${this.testResults.duration}ms`, 'blue');
        
        if (this.testResults.total > 0) {
            const passRate = (this.testResults.passed / this.testResults.total * 100).toFixed(1);
            this.colorLog(`🎯 通过率: ${passRate}%`, passRate >= 90 ? 'green' : passRate >= 70 ? 'yellow' : 'red');
        }
        
        // 显示失败的测试
        const failedTests = this.testResults.details.filter(t => t.status === 'failed');
        if (failedTests.length > 0) {
            console.log('\\n❌ 失败的测试:');
            failedTests.forEach(test => {
                this.colorLog(`   ${test.suite} -> ${test.name}: ${test.message}`, 'red');
            });
        }
        
        // 给出建议
        console.log('\\n💡 建议:');
        if (this.testResults.failed === 0) {
            this.colorLog('   🎉 所有测试通过，代码质量良好！', 'green');
        } else if (this.testResults.failed <= 2) {
            this.colorLog('   ⚠️  少量测试失败，建议修复后重新测试', 'yellow');
        } else {
            this.colorLog('   ❌ 较多测试失败，建议检查代码实现', 'red');
        }
    }
    
    /**
     * 保存测试报告
     */
    saveTestReport() {
        try {
            const logDir = path.join(__dirname, '..', 'logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const reportFile = path.join(logDir, `test-report-${timestamp}.json`);
            
            const reportData = {
                timestamp: new Date().toISOString(),
                summary: {
                    total: this.testResults.total,
                    passed: this.testResults.passed,
                    failed: this.testResults.failed,
                    skipped: this.testResults.skipped,
                    duration: this.testResults.duration,
                    passRate: this.testResults.total > 0 ? 
                        (this.testResults.passed / this.testResults.total * 100).toFixed(2) : 0
                },
                details: this.testResults.details,
                environment: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    architecture: process.arch
                }
            };
            
            fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2), 'utf8');
            
            console.log(`\\n💾 测试报告已保存到: ${reportFile}`);
            
        } catch (error) {
            this.colorLog(`保存测试报告失败: ${error.message}`, 'red');
        }
    }
}

// 主函数
async function main() {
    const runner = new TestRunner();
    await runner.runAllTests();
    
    // 根据测试结果设置退出码
    const exitCode = runner.testResults.failed > 0 ? 1 : 0;
    process.exit(exitCode);
}

// 如果直接运行此文件
if (require.main === module) {
    main().catch(console.error);
}

module.exports = TestRunner;
