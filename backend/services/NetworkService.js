/**
 * 网络共享访问模块
 * 处理Windows网络共享文件夹的连接、认证和文件访问
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class NetworkShareManager {
    constructor() {
        this.shareHost = '10.21.189.125';
        this.sharePath = '\\\\10.21.189.125\\Logs';
        this.username = 'Administrator';
        this.password = 'Password2024';
        this.isConnected = false;
        this.localMountPoint = null;
        
        // 检测开发环境
        this.isDevelopment = process.env.NODE_ENV !== 'production';
    }
    
    /**
     * 连接到网络共享文件夹
     * @returns {Promise<boolean>} 连接是否成功
     */
    async connect() {
        // 开发环境也尝试真实连接
        if (this.isDevelopment) {
            logger.info('开发环境：尝试连接真实服务器', {
                host: this.shareHost,
                path: this.sharePath,
                mode: 'development'
            });
        }
        
        try {
            logger.info('开始连接网络共享文件夹', {
                host: this.shareHost,
                path: this.sharePath,
                username: this.username,
                environment: this.isDevelopment ? 'development' : 'production'
            });
            
            // 先清理所有到该服务器的连接
            await this.forceCleanupConnections();
            
            // 使用net use命令连接网络共享
            const command = `net use "${this.sharePath}" "${this.password}" /user:"${this.username}" /persistent:no`;
            
            logger.debug('执行连接命令（密码已隐藏）', {
                command: `net use "${this.sharePath}" ****** /user:"${this.username}" /persistent:no`
            });
            
            const startTime = Date.now();
            const result = execSync(command, { 
                encoding: 'utf8',
                timeout: 30000 // 30秒超时
            });
            
            const duration = Date.now() - startTime;
            logger.performance('网络共享连接', duration, { result: result.trim() });
            
            this.isConnected = true;
            this.localMountPoint = this.sharePath;
            
            logger.network('CONNECT', this.sharePath, 'SUCCESS', {
                duration: `${duration}ms`,
                result: result.trim()
            });
            
            return true;
            
        } catch (error) {
            // 处理特定的错误代码
            if (error.message.includes('1219')) {
                logger.warn('检测到错误1219，尝试强制清理连接后重试');
                
                try {
                    // 强制清理并重试
                    await this.forceCleanupAllConnections();
                    
                    // 等待一小段时间
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // 重试连接
                    const retryCommand = `net use "${this.sharePath}" "${this.password}" /user:"${this.username}" /persistent:no`;
                    const retryResult = execSync(retryCommand, { 
                        encoding: 'utf8',
                        timeout: 30000
                    });
                    
                    this.isConnected = true;
                    this.localMountPoint = this.sharePath;
                    
                    logger.info('重试连接成功');
                    logger.network('CONNECT', this.sharePath, 'SUCCESS_RETRY', {
                        result: retryResult.trim()
                    });
                    
                    return true;
                    
                } catch (retryError) {
                    logger.error('重试连接也失败', {
                        originalError: error.message,
                        retryError: retryError.message
                    });
                }
            }
            
            logger.error('网络共享连接失败', {
                host: this.shareHost,
                error: error.message,
                code: error.code,
                suggestions: this.getConnectionErrorSuggestions(error.message)
            });
            
            logger.network('CONNECT', this.sharePath, 'FAILED', {
                error: error.message
            });
            
            this.isConnected = false;
            return false;
        }
    }
    
    /**
     * 断开网络共享连接
     */
    async disconnect() {
        try {
            if (this.isConnected || this.localMountPoint) {
                const command = `net use "${this.sharePath}" /delete /y`;
                logger.debug('断开网络连接', { command });
                
                try {
                    execSync(command, { encoding: 'utf8', timeout: 10000 });
                    logger.network('DISCONNECT', this.sharePath, 'SUCCESS');
                } catch (disconnectError) {
                    // 断开连接失败不是致命错误，可能本来就没有连接
                    logger.debug('断开连接时出现非致命错误', {
                        error: disconnectError.message
                    });
                }
            }
            
            this.isConnected = false;
            this.localMountPoint = null;
            
        } catch (error) {
            logger.warn('断开网络连接时发生错误', {
                error: error.message
            });
        }
    }
    
    /**
     * 强制清理到指定服务器的连接
     */
    async forceCleanupConnections() {
        try {
            logger.debug('开始清理到目标服务器的连接');
            
            // 尝试断开到目标路径的连接
            const commands = [
                `net use "${this.sharePath}" /delete /y`,
                `net use \\\\${this.shareHost} /delete /y`,
                `net use * \\\\${this.shareHost}\\* /delete /y`
            ];
            
            for (const command of commands) {
                try {
                    execSync(command, { 
                        encoding: 'utf8', 
                        timeout: 5000,
                        stdio: 'pipe'
                    });
                    logger.debug('成功执行清理命令', { command });
                } catch (cleanupError) {
                    // 清理命令失败是正常的，可能本来就没有连接
                    logger.debug('清理命令执行失败（正常）', { 
                        command, 
                        error: cleanupError.message 
                    });
                }
            }
            
        } catch (error) {
            logger.debug('清理连接过程中发生错误', {
                error: error.message
            });
        }
    }
    
    /**
     * 强制清理所有网络连接
     */
    async forceCleanupAllConnections() {
        try {
            logger.warn('执行强制清理所有网络连接');
            
            // 步骤1: 强制断开所有网络驱动器
            try {
                const command1 = 'net use * /delete /y';
                execSync(command1, { 
                    encoding: 'utf8', 
                    timeout: 10000,
                    stdio: 'pipe'
                });
                logger.debug('网络驱动器清理完成');
            } catch (e) {
                logger.debug('网络驱动器清理异常', { error: e.message });
            }
            
            // 步骤2: 强制断开特定服务器的IPC$连接
            try {
                const command2 = `net use \\\\${this.shareHost}\\IPC$ /delete /y`;
                execSync(command2, { 
                    encoding: 'utf8', 
                    timeout: 10000,
                    stdio: 'pipe'
                });
                logger.debug('IPC$连接清理完成');
            } catch (e) {
                logger.debug('IPC$连接清理异常', { error: e.message });
            }
            
            // 步骤3: 清理Windows凭据缓存
            try {
                const command3 = `cmdkey /delete:${this.shareHost}`;
                execSync(command3, { 
                    encoding: 'utf8', 
                    timeout: 10000,
                    stdio: 'pipe'
                });
                logger.debug('凭据缓存清理完成');
            } catch (e) {
                logger.debug('凭据缓存清理异常', { error: e.message });
            }
            
            // 步骤4: 强制断开SMB会话
            try {
                const command4 = 'net session /delete /y';
                execSync(command4, { 
                    encoding: 'utf8', 
                    timeout: 10000,
                    stdio: 'pipe'
                });
                logger.debug('SMB会话清理完成');
            } catch (e) {
                logger.debug('SMB会话清理异常', { error: e.message });
            }
            
            logger.info('成功完成强化网络连接清理');
            
        } catch (error) {
            logger.debug('强化清理所有连接失败', {
                error: error.message
            });
        }
    }
    
    /**
     * 根据错误信息提供解决建议
     * @param {string} errorMessage - 错误信息
     * @returns {Array<string>} 建议列表
     */
    getConnectionErrorSuggestions(errorMessage) {
        const suggestions = [];
        
        if (errorMessage.includes('1219')) {
            suggestions.push('错误1219: 请手动执行 "net use * /delete /y" 清理所有网络连接');
            suggestions.push('确保没有其他程序占用该网络连接');
            suggestions.push('尝试使用不同的用户凭据');
        }
        
        if (errorMessage.includes('1326')) {
            suggestions.push('错误1326: 用户名或密码错误');
            suggestions.push('验证认证信息: PRC/Administrator / Password2024');
            suggestions.push('确认账户未被锁定');
        }
        
        if (errorMessage.includes('53')) {
            suggestions.push('错误53: 找不到网络路径');
            suggestions.push('确认服务器 10.21.189.125 可访问');
            suggestions.push('检查网络连接和防火墙设置');
        }
        
        if (errorMessage.includes('timeout') || errorMessage.includes('超时')) {
            suggestions.push('网络超时: 检查网络连接稳定性');
            suggestions.push('确认服务器响应正常');
            suggestions.push('考虑增加超时时间');
        }
        
        if (suggestions.length === 0) {
            suggestions.push('检查网络连接和认证信息');
            suggestions.push('确认目标服务器可访问');
            suggestions.push('查看详细错误日志获取更多信息');
        }
        
        return suggestions;
    }
    
    /**
     * 检查连接状态
     * @returns {boolean} 是否已连接
     */
    checkConnection() {
        try {
            if (!this.isConnected) {
                return false;
            }
            
            // 尝试列出目录内容来验证连接
            const testPath = this.sharePath;
            const result = execSync(`dir "${testPath}" /b`, { 
                encoding: 'utf8',
                timeout: 5000 
            });
            
            logger.debug('连接状态检查成功', {
                path: testPath,
                itemCount: result.trim().split('\n').length
            });
            
            return true;
            
        } catch (error) {
            logger.warn('连接状态检查失败', {
                error: error.message
            });
            
            this.isConnected = false;
            return false;
        }
    }
    
    /**
     * 获取今天日期对应的文件夹路径
     * @returns {string} 今天日期文件夹路径
     */
    getTodayFolderPath() {
        const today = new Date();
        const dateStr = today.getFullYear().toString() + 
                       (today.getMonth() + 1).toString().padStart(2, '0') + 
                       today.getDate().toString().padStart(2, '0');
        
        const folderPath = path.join(this.sharePath, dateStr);
        
        logger.debug('计算今天日期文件夹路径', {
            date: dateStr,
            path: folderPath,
            environment: this.isDevelopment ? 'development' : 'production'
        });
        
        return folderPath;
    }
    
    /**
     * 获取指定日期对应的文件夹路径
     * @param {string} dateStr - 日期字符串 (YYYYMMDD格式)
     * @returns {string} 指定日期文件夹路径
     */
    getDateFolderPath(dateStr) {
        // 验证日期格式
        if (!/^\d{8}$/.test(dateStr)) {
            throw new Error(`无效的日期格式: ${dateStr}，期望格式: YYYYMMDD`);
        }
        
        const folderPath = path.join(this.sharePath, dateStr);
        
        logger.debug('计算指定日期文件夹路径', {
            date: dateStr,
            path: folderPath,
            environment: this.isDevelopment ? 'development' : 'production'
        });
        
        return folderPath;
    }
    
    /**
     * 列出目录中的文件
     * @param {string} dirPath - 目录路径
     * @returns {Array<string>} 文件列表
     */
    listFiles(dirPath) {
        try {
            logger.debug('开始列出目录文件', { path: dirPath });
            
            const startTime = Date.now();
            const result = execSync(`dir "${dirPath}" /b /a-d`, { 
                encoding: 'utf8',
                timeout: 10000 
            });
            
            const duration = Date.now() - startTime;
            const files = result.trim().split('\n').filter(f => f.trim());
            
            logger.performance('目录文件列表获取', duration, {
                path: dirPath,
                fileCount: files.length
            });
            
            logger.info(`成功获取目录文件列表: ${files.length} 个文件`, {
                path: dirPath,
                files: files.slice(0, 5) // 只记录前5个文件名
            });
            
            return files;
            
        } catch (error) {
            logger.error('获取目录文件列表失败', {
                path: dirPath,
                error: error.message
            });
            
            return [];
        }
    }
    
    /**
     * 检查文件是否存在
     * @param {string} filePath - 文件路径
     * @returns {boolean} 文件是否存在
     */
    fileExists(filePath) {
        try {
            const result = execSync(`if exist "${filePath}" echo EXISTS`, { 
                encoding: 'utf8',
                timeout: 5000 
            });
            
            const exists = result.trim() === 'EXISTS';
            
            logger.debug('文件存在性检查', {
                path: filePath,
                exists
            });
            
            return exists;
            
        } catch (error) {
            logger.debug('文件存在性检查失败', {
                path: filePath,
                error: error.message
            });
            
            return false;
        }
    }
    
    /**
     * 获取文件大小（字节）
     * @param {string} filePath - 文件路径
     * @returns {number} 文件大小
     */
    getFileSize(filePath) {
        try {
            const result = execSync(`powershell "(Get-Item '${filePath}').Length"`, { 
                encoding: 'utf8',
                timeout: 5000 
            });
            
            const size = parseInt(result.trim());
            
            logger.debug('获取文件大小', {
                path: filePath,
                size: `${(size / (1024 * 1024)).toFixed(2)} MB`
            });
            
            return size;
            
        } catch (error) {
            logger.warn('获取文件大小失败', {
                path: filePath,
                error: error.message
            });
            
            return 0;
        }
    }
}

module.exports = NetworkShareManager;
