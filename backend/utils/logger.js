/**
 * 日志记录系统
 * 支持ERROR、WARN、INFO、DEBUG四个级别的日志记录
 * 自动按日期分文件存储，便于问题排查
 */

const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, '../logs');
        this.currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        
        // 确保日志目录存在
        this.ensureLogDirectory();
        
        // 日志级别配置
        this.levels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3
        };
        
        // 当前环境日志级别（可通过环境变量设置）
        this.currentLevel = process.env.LOG_LEVEL ? 
            this.levels[process.env.LOG_LEVEL.toUpperCase()] : 
            this.levels.INFO;
    }
    
    /**
     * 确保日志目录存在
     */
    ensureLogDirectory() {
        try {
            if (!fs.existsSync(this.logDir)) {
                fs.mkdirSync(this.logDir, { recursive: true });
            }
        } catch (error) {
            console.error('创建日志目录失败:', error.message);
        }
    }
    
    /**
     * 格式化日志消息
     * @param {string} level - 日志级别
     * @param {string} message - 日志消息
     * @param {Object} meta - 额外信息
     * @returns {string} 格式化后的日志
     */
    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
        return `[${timestamp}] [${level}] ${message} ${metaStr}\n`;
    }
    
    /**
     * 写入日志文件
     * @param {string} filename - 文件名
     * @param {string} content - 内容
     */
    writeToFile(filename, content) {
        try {
            const filepath = path.join(this.logDir, filename);
            fs.appendFileSync(filepath, content, 'utf8');
        } catch (error) {
            console.error(`写入日志文件失败 ${filename}:`, error.message);
        }
    }
    
    /**
     * 错误级别日志 - 记录所有异常和错误
     */
    error(message, meta = {}) {
        if (this.currentLevel >= this.levels.ERROR) {
            const logContent = this.formatMessage('ERROR', message, meta);
            this.writeToFile(`error-${this.currentDate}.log`, logContent);
            console.error('\x1b[31m%s\x1b[0m', `[ERROR] ${message}`); // 红色输出
        }
    }
    
    /**
     * 警告级别日志 - 记录警告信息
     */
    warn(message, meta = {}) {
        if (this.currentLevel >= this.levels.WARN) {
            const logContent = this.formatMessage('WARN', message, meta);
            this.writeToFile(`warn-${this.currentDate}.log`, logContent);
            console.warn('\x1b[33m%s\x1b[0m', `[WARN] ${message}`); // 黄色输出
        }
    }
    
    /**
     * 信息级别日志 - 记录重要操作
     */
    info(message, meta = {}) {
        if (this.currentLevel >= this.levels.INFO) {
            const logContent = this.formatMessage('INFO', message, meta);
            this.writeToFile(`info-${this.currentDate}.log`, logContent);
            console.log('\x1b[32m%s\x1b[0m', `[INFO] ${message}`); // 绿色输出
        }
    }
    
    /**
     * 调试级别日志 - 记录详细调试信息
     */
    debug(message, meta = {}) {
        if (this.currentLevel >= this.levels.DEBUG) {
            const logContent = this.formatMessage('DEBUG', message, meta);
            this.writeToFile(`debug-${this.currentDate}.log`, logContent);
            console.log('\x1b[36m%s\x1b[0m', `[DEBUG] ${message}`); // 青色输出
        }
    }
    
    /**
     * 记录性能信息
     * @param {string} operation - 操作名称
     * @param {number} duration - 耗时（毫秒）
     * @param {Object} meta - 额外信息
     */
    performance(operation, duration, meta = {}) {
        const perfInfo = {
            operation,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString(),
            ...meta
        };
        this.info(`性能监控: ${operation} 耗时 ${duration}ms`, perfInfo);
    }
    
    /**
     * 记录网络操作
     * @param {string} action - 操作类型
     * @param {string} target - 目标地址
     * @param {string} status - 状态
     * @param {Object} meta - 额外信息
     */
    network(action, target, status, meta = {}) {
        const networkInfo = {
            action,
            target,
            status,
            timestamp: new Date().toISOString(),
            ...meta
        };
        this.info(`网络操作: ${action} -> ${target} [${status}]`, networkInfo);
    }
}

// 创建全局日志实例
const logger = new Logger();

module.exports = logger;
