/**
 * 日志分析工具
 * 分析系统运行日志，提供性能统计和问题诊断
 */

const fs = require('fs');
const path = require('path');
const { createReadStream } = require('fs');
const { createInterface } = require('readline');

class LogAnalyzer {
    constructor() {
        this.stats = {
            totalLines: 0,
            errorCount: 0,
            warningCount: 0,
            infoCount: 0,
            debugCount: 0,
            performanceMetrics: [],
            networkOperations: [],
            errors: [],
            timeRange: {
                start: null,
                end: null
            }
        };
        
        this.patterns = {
            logLevel: /\\[(ERROR|WARN|INFO|DEBUG)\\]/,
            timestamp: /\\[(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z)\\]/,
            performance: /性能监控: (.+?) 耗时 (\\d+)ms/,
            network: /网络操作: (.+?) -> (.+?) \\[(.+?)\\]/,
            error: /\\[ERROR\\] (.+)/,
            duration: /(\\d+)ms/
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
            cyan: '\x1b[36m',
            white: '\x1b[37m',
            reset: '\x1b[0m'
        };
        
        console.log(colors[color] + text + colors.reset);
    }
    
    /**
     * 解析单行日志
     * @param {string} line - 日志行
     * @param {number} lineNumber - 行号
     */
    parseLine(line, lineNumber) {
        try {
            // 提取时间戳
            const timestampMatch = line.match(this.patterns.timestamp);
            if (timestampMatch) {
                const timestamp = new Date(timestampMatch[1]);
                
                if (!this.stats.timeRange.start || timestamp < this.stats.timeRange.start) {
                    this.stats.timeRange.start = timestamp;
                }
                if (!this.stats.timeRange.end || timestamp > this.stats.timeRange.end) {
                    this.stats.timeRange.end = timestamp;
                }
            }
            
            // 统计日志级别
            const levelMatch = line.match(this.patterns.logLevel);
            if (levelMatch) {
                const level = levelMatch[1];
                switch (level) {
                    case 'ERROR':
                        this.stats.errorCount++;
                        // 提取错误信息
                        const errorMatch = line.match(this.patterns.error);
                        if (errorMatch) {
                            this.stats.errors.push({
                                line: lineNumber,
                                timestamp: timestampMatch ? timestampMatch[1] : null,
                                message: errorMatch[1],
                                fullLine: line
                            });
                        }
                        break;
                    case 'WARN':
                        this.stats.warningCount++;
                        break;
                    case 'INFO':
                        this.stats.infoCount++;
                        break;
                    case 'DEBUG':
                        this.stats.debugCount++;
                        break;
                }
            }
            
            // 解析性能指标
            const perfMatch = line.match(this.patterns.performance);
            if (perfMatch) {
                this.stats.performanceMetrics.push({
                    operation: perfMatch[1],
                    duration: parseInt(perfMatch[2]),
                    line: lineNumber,
                    timestamp: timestampMatch ? timestampMatch[1] : null
                });
            }
            
            // 解析网络操作
            const networkMatch = line.match(this.patterns.network);
            if (networkMatch) {
                this.stats.networkOperations.push({
                    action: networkMatch[1],
                    target: networkMatch[2],
                    status: networkMatch[3],
                    line: lineNumber,
                    timestamp: timestampMatch ? timestampMatch[1] : null
                });
            }
            
        } catch (error) {
            // 忽略解析错误，继续处理下一行
        }
    }
    
    /**
     * 分析日志文件
     * @param {string} filePath - 日志文件路径
     * @returns {Promise<Object>} 分析结果
     */
    async analyzeLogFile(filePath) {
        return new Promise((resolve, reject) => {
            try {
                this.colorLog(`\\n📊 分析日志文件: ${path.basename(filePath)}`, 'blue');
                
                const startTime = Date.now();
                
                // 重置统计信息
                this.resetStats();
                
                const fileStream = createReadStream(filePath, { encoding: 'utf8' });
                const rl = createInterface({
                    input: fileStream,
                    crlfDelay: Infinity
                });
                
                let lineNumber = 0;
                
                rl.on('line', (line) => {
                    lineNumber++;
                    this.stats.totalLines++;
                    this.parseLine(line, lineNumber);
                });
                
                rl.on('close', () => {
                    const duration = Date.now() - startTime;
                    
                    this.colorLog(`✅ 分析完成，耗时 ${duration}ms`, 'green');
                    
                    const result = this.generateReport();
                    resolve(result);
                });
                
                rl.on('error', (error) => {
                    this.colorLog(`❌ 分析失败: ${error.message}`, 'red');
                    reject(error);
                });
                
            } catch (error) {
                this.colorLog(`❌ 分析异常: ${error.message}`, 'red');
                reject(error);
            }
        });
    }
    
    /**
     * 重置统计信息
     */
    resetStats() {
        this.stats = {
            totalLines: 0,
            errorCount: 0,
            warningCount: 0,
            infoCount: 0,
            debugCount: 0,
            performanceMetrics: [],
            networkOperations: [],
            errors: [],
            timeRange: {
                start: null,
                end: null
            }
        };
    }
    
    /**
     * 生成分析报告
     * @returns {Object} 分析报告
     */
    generateReport() {
        const report = {
            summary: this.generateSummary(),
            performance: this.analyzePerformance(),
            network: this.analyzeNetwork(),
            errors: this.analyzeErrors(),
            recommendations: this.generateRecommendations()
        };
        
        this.printReport(report);
        return report;
    }
    
    /**
     * 生成基本摘要
     */
    generateSummary() {
        const totalLogEntries = this.stats.errorCount + this.stats.warningCount + 
                               this.stats.infoCount + this.stats.debugCount;
        
        return {
            totalLines: this.stats.totalLines,
            totalLogEntries,
            logLevelDistribution: {
                error: this.stats.errorCount,
                warning: this.stats.warningCount,
                info: this.stats.infoCount,
                debug: this.stats.debugCount
            },
            timeRange: {
                start: this.stats.timeRange.start?.toISOString() || null,
                end: this.stats.timeRange.end?.toISOString() || null,
                duration: this.stats.timeRange.start && this.stats.timeRange.end ? 
                    this.stats.timeRange.end - this.stats.timeRange.start : 0
            }
        };
    }
    
    /**
     * 分析性能指标
     */
    analyzePerformance() {
        if (this.stats.performanceMetrics.length === 0) {
            return { message: '没有找到性能数据' };
        }
        
        const operations = {};
        
        // 按操作类型分组
        this.stats.performanceMetrics.forEach(metric => {
            if (!operations[metric.operation]) {
                operations[metric.operation] = [];
            }
            operations[metric.operation].push(metric.duration);
        });
        
        const analysis = {};
        
        Object.entries(operations).forEach(([operation, durations]) => {
            const sorted = durations.sort((a, b) => a - b);
            const sum = durations.reduce((a, b) => a + b, 0);
            
            analysis[operation] = {
                count: durations.length,
                average: Math.round(sum / durations.length),
                min: Math.min(...durations),
                max: Math.max(...durations),
                median: sorted[Math.floor(sorted.length / 2)],
                p95: sorted[Math.floor(sorted.length * 0.95)],
                total: sum
            };
        });
        
        return {
            totalOperations: this.stats.performanceMetrics.length,
            operations: analysis,
            slowestOperations: this.stats.performanceMetrics
                .sort((a, b) => b.duration - a.duration)
                .slice(0, 5)
        };
    }
    
    /**
     * 分析网络操作
     */
    analyzeNetwork() {
        if (this.stats.networkOperations.length === 0) {
            return { message: '没有找到网络操作数据' };
        }
        
        const statusCount = {};
        const actionCount = {};
        
        this.stats.networkOperations.forEach(op => {
            statusCount[op.status] = (statusCount[op.status] || 0) + 1;
            actionCount[op.action] = (actionCount[op.action] || 0) + 1;
        });
        
        const successCount = statusCount['SUCCESS'] || 0;
        const failedCount = Object.entries(statusCount)
            .filter(([status]) => status !== 'SUCCESS')
            .reduce((sum, [, count]) => sum + count, 0);
        
        return {
            totalOperations: this.stats.networkOperations.length,
            successRate: ((successCount / this.stats.networkOperations.length) * 100).toFixed(2),
            statusDistribution: statusCount,
            actionDistribution: actionCount,
            failedOperations: this.stats.networkOperations
                .filter(op => op.status !== 'SUCCESS')
                .slice(0, 10)
        };
    }
    
    /**
     * 分析错误
     */
    analyzeErrors() {
        if (this.stats.errors.length === 0) {
            return { message: '没有发现错误' };
        }
        
        const errorTypes = {};
        
        this.stats.errors.forEach(error => {
            // 简单的错误分类
            let category = 'Other';
            const message = error.message.toLowerCase();
            
            if (message.includes('network') || message.includes('connection')) {
                category = 'Network';
            } else if (message.includes('file') || message.includes('directory')) {
                category = 'File System';
            } else if (message.includes('parse') || message.includes('format')) {
                category = 'Data Parse';
            } else if (message.includes('timeout')) {
                category = 'Timeout';
            } else if (message.includes('permission') || message.includes('access')) {
                category = 'Permission';
            }
            
            if (!errorTypes[category]) {
                errorTypes[category] = [];
            }
            errorTypes[category].push(error);
        });
        
        return {
            totalErrors: this.stats.errors.length,
            errorTypes,
            recentErrors: this.stats.errors.slice(-10),
            frequentErrors: this.getMostFrequentErrors()
        };
    }
    
    /**
     * 获取最频繁的错误
     */
    getMostFrequentErrors() {
        const errorCounts = {};
        
        this.stats.errors.forEach(error => {
            const key = error.message.substring(0, 50); // 取前50个字符作为key
            errorCounts[key] = (errorCounts[key] || 0) + 1;
        });
        
        return Object.entries(errorCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([message, count]) => ({ message, count }));
    }
    
    /**
     * 生成建议
     */
    generateRecommendations() {
        const recommendations = [];
        
        // 错误率建议
        const totalLogs = this.stats.errorCount + this.stats.warningCount + 
                         this.stats.infoCount + this.stats.debugCount;
        
        if (totalLogs > 0) {
            const errorRate = (this.stats.errorCount / totalLogs) * 100;
            
            if (errorRate > 10) {
                recommendations.push({
                    type: 'error',
                    priority: 'high',
                    message: `错误率过高 (${errorRate.toFixed(1)}%)，建议立即检查系统状态`
                });
            } else if (errorRate > 5) {
                recommendations.push({
                    type: 'warning',
                    priority: 'medium',
                    message: `错误率较高 (${errorRate.toFixed(1)}%)，建议关注系统稳定性`
                });
            }
        }
        
        // 性能建议
        if (this.stats.performanceMetrics.length > 0) {
            const slowOperations = this.stats.performanceMetrics
                .filter(m => m.duration > 5000); // 超过5秒的操作
            
            if (slowOperations.length > 0) {
                recommendations.push({
                    type: 'performance',
                    priority: 'medium',
                    message: `发现 ${slowOperations.length} 个慢操作，建议优化性能`
                });
            }
        }
        
        // 网络建议
        if (this.stats.networkOperations.length > 0) {
            const failedOps = this.stats.networkOperations
                .filter(op => op.status !== 'SUCCESS');
            
            if (failedOps.length > 0) {
                const failureRate = (failedOps.length / this.stats.networkOperations.length) * 100;
                
                if (failureRate > 20) {
                    recommendations.push({
                        type: 'network',
                        priority: 'high',
                        message: `网络操作失败率过高 (${failureRate.toFixed(1)}%)，建议检查网络连接`
                    });
                }
            }
        }
        
        // 如果没有发现问题
        if (recommendations.length === 0) {
            recommendations.push({
                type: 'info',
                priority: 'low',
                message: '系统运行状态良好，未发现明显问题'
            });
        }
        
        return recommendations;
    }
    
    /**
     * 打印分析报告
     */
    printReport(report) {
        console.log('\\n📋 ========== 日志分析报告 ==========');
        
        // 基本摘要
        console.log('\\n📊 基本统计:');
        this.colorLog(`   总行数: ${report.summary.totalLines.toLocaleString()}`, 'blue');
        this.colorLog(`   日志条目: ${report.summary.totalLogEntries.toLocaleString()}`, 'blue');
        
        if (report.summary.timeRange.start && report.summary.timeRange.end) {
            const duration = Math.round(report.summary.timeRange.duration / 1000 / 60);
            console.log(`   时间范围: ${duration} 分钟`);
        }
        
        // 日志级别分布
        console.log('\\n📈 日志级别分布:');
        const dist = report.summary.logLevelDistribution;
        this.colorLog(`   🔴 错误: ${dist.error}`, 'red');
        this.colorLog(`   🟡 警告: ${dist.warning}`, 'yellow');
        this.colorLog(`   🟢 信息: ${dist.info}`, 'green');
        this.colorLog(`   🔵 调试: ${dist.debug}`, 'blue');
        
        // 性能分析
        if (report.performance.operations) {
            console.log('\\n⚡ 性能分析:');
            Object.entries(report.performance.operations).forEach(([op, stats]) => {
                console.log(`   ${op}:`);
                console.log(`      次数: ${stats.count}, 平均: ${stats.average}ms, 最大: ${stats.max}ms`);
            });
        }
        
        // 网络分析
        if (report.network.totalOperations) {
            console.log('\\n🌐 网络操作:');
            this.colorLog(`   总操作: ${report.network.totalOperations}`, 'cyan');
            this.colorLog(`   成功率: ${report.network.successRate}%`, 'cyan');
        }
        
        // 错误分析
        if (report.errors.totalErrors) {
            console.log('\\n❌ 错误分析:');
            this.colorLog(`   总错误数: ${report.errors.totalErrors}`, 'red');
            
            if (report.errors.frequentErrors.length > 0) {
                console.log('   频繁错误:');
                report.errors.frequentErrors.forEach(error => {
                    console.log(`      ${error.message}... (${error.count} 次)`);
                });
            }
        }
        
        // 建议
        console.log('\\n💡 建议:');
        report.recommendations.forEach(rec => {
            const color = rec.priority === 'high' ? 'red' : 
                         rec.priority === 'medium' ? 'yellow' : 'green';
            this.colorLog(`   ${rec.message}`, color);
        });
    }
    
    /**
     * 保存分析报告
     */
    saveReport(report, logFilePath) {
        try {
            const logDir = path.join(__dirname, '..', 'logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const reportFile = path.join(logDir, `log-analysis-${timestamp}.json`);
            
            const reportData = {
                timestamp: new Date().toISOString(),
                sourceFile: logFilePath,
                report
            };
            
            fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2), 'utf8');
            
            console.log(`\\n💾 分析报告已保存到: ${reportFile}`);
            
        } catch (error) {
            this.colorLog(`保存分析报告失败: ${error.message}`, 'red');
        }
    }
    
    /**
     * 分析日志目录中的所有日志文件
     * @param {string} logDir - 日志目录路径
     */
    async analyzeLogDirectory(logDir = path.join(__dirname, '..', 'logs')) {
        try {
            this.colorLog('\\n📁 分析日志目录中的所有文件...', 'blue');
            
            if (!fs.existsSync(logDir)) {
                this.colorLog('❌ 日志目录不存在', 'red');
                return;
            }
            
            const files = fs.readdirSync(logDir)
                .filter(file => file.endsWith('.log'))
                .map(file => path.join(logDir, file));
            
            if (files.length === 0) {
                this.colorLog('❌ 没有找到日志文件', 'red');
                return;
            }
            
            console.log(`找到 ${files.length} 个日志文件:`);
            files.forEach(file => console.log(`   ${path.basename(file)}`));
            
            const reports = [];
            
            for (const file of files) {
                try {
                    const report = await this.analyzeLogFile(file);
                    reports.push({
                        file: path.basename(file),
                        report
                    });
                } catch (error) {
                    this.colorLog(`分析文件 ${path.basename(file)} 失败: ${error.message}`, 'red');
                }
            }
            
            this.printCombinedSummary(reports);
            
        } catch (error) {
            this.colorLog(`分析日志目录失败: ${error.message}`, 'red');
        }
    }
    
    /**
     * 打印合并摘要
     */
    printCombinedSummary(reports) {
        console.log('\\n🔍 ========== 综合分析摘要 ==========');
        
        const totalErrors = reports.reduce((sum, r) => sum + (r.report.errors.totalErrors || 0), 0);
        const totalWarnings = reports.reduce((sum, r) => sum + (r.report.summary.logLevelDistribution.warning || 0), 0);
        
        this.colorLog(`📊 分析文件数: ${reports.length}`, 'blue');
        this.colorLog(`🔴 总错误数: ${totalErrors}`, 'red');
        this.colorLog(`🟡 总警告数: ${totalWarnings}`, 'yellow');
        
        if (totalErrors === 0 && totalWarnings === 0) {
            this.colorLog('\\n🎉 系统运行状态良好！', 'green');
        } else if (totalErrors > 0) {
            this.colorLog('\\n⚠️  发现错误，建议检查系统状态', 'red');
        } else {
            this.colorLog('\\n👍 系统基本正常，有少量警告', 'yellow');
        }
    }
}

// 主函数
async function main() {
    const analyzer = new LogAnalyzer();
    
    const filePath = process.argv[2];
    
    if (filePath) {
        // 分析指定文件
        if (fs.existsSync(filePath)) {
            const report = await analyzer.analyzeLogFile(filePath);
            analyzer.saveReport(report, filePath);
        } else {
            analyzer.colorLog(`❌ 文件不存在: ${filePath}`, 'red');
        }
    } else {
        // 分析整个日志目录
        await analyzer.analyzeLogDirectory();
    }
}

// 如果直接运行此文件
if (require.main === module) {
    main().catch(console.error);
}

module.exports = LogAnalyzer;
