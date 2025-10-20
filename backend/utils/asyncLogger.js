/**
 * 异步日志记录系统
 * 优化版本：使用异步写入，避免阻塞主线程
 * 支持日志轮转和压缩
 */

const fs = require('fs').promises;
const path = require('path');
const { createWriteStream } = require('fs');
const { Worker } = require('worker_threads');
const EventEmitter = require('events');
const config = require('../config/config');

class AsyncLogger extends EventEmitter {
    constructor() {
        super();
        this.logDir = config.logging.dir;
        this.currentDate = this.getCurrentDate();
        this.logStreams = new Map();
        this.logQueue = [];
        this.isProcessing = false;
        this.logLevels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3
        };
        this.currentLevel = this.logLevels[config.logging.level.toUpperCase()] || this.logLevels.INFO;
        
        // 性能统计
        this.stats = {
            totalLogs: 0,
            errorCount: 0,
            warnCount: 0,
            queueSize: 0,
            lastFlush: Date.now()
        };

        // 初始化
        this.initialize();
        
        // 定期刷新日志
        this.flushInterval = setInterval(() => this.flush(), 1000);
        
        // 定期检查日期变化
        this.dateCheckInterval = setInterval(() => this.checkDateChange(), 60000);
    }

    /**
     * 初始化日志目录
     */
    async initialize() {
        try {
            await fs.mkdir(this.logDir, { recursive: true });
        } catch (error) {
            console.error('创建日志目录失败:', error.message);
        }
    }

    /**
     * 获取当前日期字符串
     */
    getCurrentDate() {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * 检查日期是否变化，如果变化则切换日志文件
     */
    async checkDateChange() {
        const newDate = this.getCurrentDate();
        if (newDate !== this.currentDate) {
            await this.rotateLogs();
            this.currentDate = newDate;
        }
    }

    /**
     * 日志轮转
     */
    async rotateLogs() {
        // 关闭当前的所有流
        for (const [filename, stream] of this.logStreams) {
            stream.end();
        }
        this.logStreams.clear();
        
        // 清理旧日志
        await this.cleanOldLogs();
    }

    /**
     * 清理旧日志文件
     */
    async cleanOldLogs() {
        try {
            const files = await fs.readdir(this.logDir);
            const now = Date.now();
            const maxAge = config.logging.maxFiles * 24 * 60 * 60 * 1000; // 天数转毫秒

            for (const file of files) {
                if (file.endsWith('.log')) {
                    const filePath = path.join(this.logDir, file);
                    const stat = await fs.stat(filePath);
                    
                    if (now - stat.mtime.getTime() > maxAge) {
                        await fs.unlink(filePath);
                        console.log(`删除过期日志文件: ${file}`);
                    }
                }
            }
        } catch (error) {
            console.error('清理旧日志失败:', error.message);
        }
    }

    /**
     * 获取或创建日志流
     */
    getLogStream(filename) {
        if (!this.logStreams.has(filename)) {
            const filepath = path.join(this.logDir, filename);
            const stream = createWriteStream(filepath, { flags: 'a' });
            this.logStreams.set(filename, stream);
        }
        return this.logStreams.get(filename);
    }

    /**
     * 格式化日志消息
     */
    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const pid = process.pid;
        const memory = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        
        const logEntry = {
            timestamp,
            level,
            pid,
            memory: `${memory}MB`,
            message,
            ...meta
        };

        return JSON.stringify(logEntry) + '\n';
    }

    /**
     * 写入日志到队列
     */
    writeLog(level, message, meta = {}) {
        if (this.logLevels[level] > this.currentLevel) {
            return;
        }

        const filename = `${level.toLowerCase()}-${this.currentDate}.log`;
        const content = this.formatMessage(level, message, meta);
        
        this.logQueue.push({ filename, content, level });
        this.stats.queueSize = this.logQueue.length;
        this.stats.totalLogs++;
        
        if (level === 'ERROR') this.stats.errorCount++;
        if (level === 'WARN') this.stats.warnCount++;
        
        // 如果队列过大，立即刷新
        if (this.logQueue.length > 1000) {
            this.flush();
        }
    }

    /**
     * 刷新日志队列到文件
     */
    async flush() {
        if (this.isProcessing || this.logQueue.length === 0) {
            return;
        }

        this.isProcessing = true;
        const batch = this.logQueue.splice(0, this.logQueue.length);
        
        try {
            // 按文件名分组
            const groups = new Map();
            for (const entry of batch) {
                if (!groups.has(entry.filename)) {
                    groups.set(entry.filename, []);
                }
                groups.get(entry.filename).push(entry.content);
            }

            // 写入各个文件
            const writePromises = [];
            for (const [filename, contents] of groups) {
                const stream = this.getLogStream(filename);
                const promise = new Promise((resolve, reject) => {
                    stream.write(contents.join(''), (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                writePromises.push(promise);
            }

            await Promise.all(writePromises);
            
            this.stats.lastFlush = Date.now();
            this.stats.queueSize = this.logQueue.length;
            
        } catch (error) {
            console.error('刷新日志失败:', error.message);
            // 将失败的日志重新加入队列
            this.logQueue.unshift(...batch);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 错误级别日志
     */
    error(message, meta = {}) {
        this.writeLog('ERROR', message, meta);
        
        // 控制台输出
        if (config.logging.enableConsole) {
            console.error('\x1b[31m%s\x1b[0m', `[ERROR] ${message}`);
        }
        
        // 触发错误事件
        this.emit('error', { message, meta });
    }

    /**
     * 警告级别日志
     */
    warn(message, meta = {}) {
        this.writeLog('WARN', message, meta);
        
        if (config.logging.enableConsole) {
            console.warn('\x1b[33m%s\x1b[0m', `[WARN] ${message}`);
        }
    }

    /**
     * 信息级别日志
     */
    info(message, meta = {}) {
        this.writeLog('INFO', message, meta);
        
        if (config.logging.enableConsole) {
            console.log('\x1b[32m%s\x1b[0m', `[INFO] ${message}`);
        }
    }

    /**
     * 调试级别日志
     */
    debug(message, meta = {}) {
        this.writeLog('DEBUG', message, meta);
        
        if (config.logging.enableConsole && this.currentLevel >= this.logLevels.DEBUG) {
            console.log('\x1b[36m%s\x1b[0m', `[DEBUG] ${message}`);
        }
    }

    /**
     * 性能日志
     */
    performance(operation, duration, meta = {}) {
        const performanceInfo = {
            operation,
            duration: `${duration}ms`,
            ...meta
        };
        
        // 性能警告
        if (duration > 1000) {
            this.warn(`性能警告: ${operation} 耗时 ${duration}ms`, performanceInfo);
        } else {
            this.info(`性能监控: ${operation} 耗时 ${duration}ms`, performanceInfo);
        }
    }

    /**
     * 网络操作日志
     */
    network(action, target, status, meta = {}) {
        const networkInfo = {
            action,
            target,
            status,
            ...meta
        };
        this.info(`网络操作: ${action} -> ${target} [${status}]`, networkInfo);
    }

    /**
     * 获取日志统计信息
     */
    getStats() {
        return {
            ...this.stats,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage()
        };
    }

    /**
     * 关闭日志系统
     */
    async close() {
        // 清理定时器
        clearInterval(this.flushInterval);
        clearInterval(this.dateCheckInterval);
        
        // 刷新剩余日志
        await this.flush();
        
        // 关闭所有流
        for (const [filename, stream] of this.logStreams) {
            stream.end();
        }
        this.logStreams.clear();
    }
}

// 创建单例
const asyncLogger = new AsyncLogger();

// 处理进程退出
process.on('exit', () => {
    asyncLogger.flush();
});

process.on('SIGINT', async () => {
    await asyncLogger.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await asyncLogger.close();
    process.exit(0);
});

module.exports = asyncLogger;
