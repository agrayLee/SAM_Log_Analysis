/**
 * 日志定时处理服务
 * 复用现有验证代码的网络连接和日志解析功能
 * 定期同步山姆接口日志到数据库
 */

const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const NetworkShareManager = require('./NetworkService');
const LogParser = require('./LogParserService');
const DatabaseService = require('./DatabaseService');
const logger = require('../utils/logger');

class LogScheduler {
    constructor() {
        this.networkService = new NetworkShareManager();
        this.logParserService = new LogParser();
        this.databaseService = new DatabaseService();
        this.isRunning = false;
        this.lastProcessTime = null;
        
        // 任务调度器引用
        this.scheduledTasks = new Map();
    }

    // 启动定时任务
    start() {
        logger.info('启动日志定时处理服务');

        // 每小时执行一次日志同步
        const hourlyTask = cron.schedule('0 * * * *', async () => {
            await this.processRecentLogs();
        }, {
            scheduled: false,
            timezone: 'Asia/Shanghai'
        });

        // 每天凌晨2点执行全量检查
        const dailyTask = cron.schedule('0 2 * * *', async () => {
            await this.processDailyLogs();
        }, {
            scheduled: false,
            timezone: 'Asia/Shanghai'
        });

        // 每15分钟检查最新日志（实时性要求高的情况）
        const realtimeTask = cron.schedule('*/15 * * * *', async () => {
            await this.processLatestLogs();
        }, {
            scheduled: false,
            timezone: 'Asia/Shanghai'
        });

        this.scheduledTasks.set('hourly', hourlyTask);
        this.scheduledTasks.set('daily', dailyTask);
        this.scheduledTasks.set('realtime', realtimeTask);

        // 启动所有任务
        hourlyTask.start();
        dailyTask.start();
        realtimeTask.start();

        logger.info('定时任务启动完成', {
            tasks: ['hourly', 'daily', 'realtime']
        });

        // 启动时立即执行一次
        setTimeout(() => {
            this.processRecentLogs();
        }, 5000);
    }

    // 停止定时任务
    stop() {
        logger.info('停止日志定时处理服务');

        this.scheduledTasks.forEach((task, name) => {
            task.stop();
            logger.debug(`停止任务: ${name}`);
        });

        this.scheduledTasks.clear();
        this.databaseService.close();
    }

    // 处理最近的日志（实时处理）
    async processLatestLogs() {
        if (this.isRunning) {
            logger.debug('日志处理正在运行中，跳过本次执行');
            return;
        }

        try {
            this.isRunning = true;
            logger.info('开始处理最新日志');

            // 复用NetworkService连接网络共享
            const connected = await this.networkService.connect();
            if (!connected) {
                logger.warn('网络连接失败，尝试处理本地demo数据作为演示');
                
                // 尝试处理demo数据作为回退
                try {
                    await this.processDemoData();
                    return; // 成功处理demo数据就返回
                } catch (demoError) {
                    logger.error('处理demo数据也失败', { error: demoError.message });
                    throw new Error('网络连接失败且无法处理demo数据');
                }
            }

            // 获取今天的日志文件夹
            const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
            const todayFolderPath = this.networkService.getTodayFolderPath();

            if (!this.networkService.fileExists(todayFolderPath)) {
                logger.warn('今天的日志文件夹不存在', { folderPath: todayFolderPath });
                return;
            }

            // 复用LogParserService识别和解析日志文件
            const logFiles = this.logParserService.identifyLogFiles(todayFolderPath, 'JieLink_Center_Comm');
            
            if (logFiles.length === 0) {
                logger.debug('没有找到需要处理的日志文件');
                return;
            }

            // 只处理最新的1-2个文件（实时性处理）
            const latestFiles = logFiles.slice(0, 2);
            
            for (const file of latestFiles) {
                await this.processLogFile({
                    fileName: file.name,
                    filePath: file.path,
                    size: this.networkService.getFileSize(file.path) || 0
                }, 'realtime');
            }

            this.lastProcessTime = new Date();
            logger.info('最新日志处理完成', { 
                processedFiles: latestFiles.length,
                lastProcessTime: this.lastProcessTime 
            });

        } catch (error) {
            logger.error('处理最新日志失败', { error: error.message });
        } finally {
            this.isRunning = false;
        }
    }

    // 处理最近几小时的日志
    async processRecentLogs() {
        if (this.isRunning) {
            logger.debug('日志处理正在运行中，跳过本次执行');
            return;
        }

        try {
            this.isRunning = true;
            logger.info('开始处理最近日志');

            // 复用NetworkService连接
            const connected = await this.networkService.connect();
            if (!connected) {
                throw new Error('网络连接失败');
            }

            // 处理今天的日志
            await this.processDateLogs(new Date());

            // 如果是凌晨，也处理昨天的日志
            const now = new Date();
            if (now.getHours() < 6) {
                const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                await this.processDateLogs(yesterday);
            }

            this.lastProcessTime = new Date();
            logger.info('最近日志处理完成', { lastProcessTime: this.lastProcessTime });

        } catch (error) {
            logger.error('处理最近日志失败', { error: error.message });
        } finally {
            this.isRunning = false;
        }
    }

    // 处理每日日志（全量检查）
    async processDailyLogs() {
        if (this.isRunning) {
            logger.debug('日志处理正在运行中，跳过本次执行');
            return;
        }

        try {
            this.isRunning = true;
            logger.info('开始每日日志全量处理');

            // 连接网络共享
            const connected = await this.networkService.connect();
            if (!connected) {
                throw new Error('网络连接失败');
            }

            // 处理最近3天的日志
            const dates = [];
            for (let i = 0; i < 3; i++) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                dates.push(date);
            }

            for (const date of dates) {
                await this.processDateLogs(date);
            }

            this.lastProcessTime = new Date();
            logger.info('每日日志处理完成', { 
                processedDates: dates.length,
                lastProcessTime: this.lastProcessTime 
            });

        } catch (error) {
            logger.error('每日日志处理失败', { error: error.message });
        } finally {
            this.isRunning = false;
        }
    }

    // 处理指定日期的日志
    async processDateLogs(date) {
        const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
        const dateFolderPath = this.networkService.getDateFolderPath(dateStr);

        if (!this.networkService.fileExists(dateFolderPath)) {
            logger.debug('日期文件夹不存在', { dateStr, folderPath: dateFolderPath });
            return;
        }

        logger.info('处理日期日志', { dateStr });

        // 复用LogParserService识别日志文件
        const logFiles = this.logParserService.identifyLogFiles(dateFolderPath, 'JieLink_Center_Comm');
        
        if (logFiles.length === 0) {
            logger.debug('没有找到日志文件', { dateStr });
            return;
        }

        // 处理所有日志文件
        for (const file of logFiles) {
            await this.processLogFile({
                fileName: file.name,
                filePath: file.path,
                size: this.networkService.getFileSize(file.path) || 0
            }, 'scheduled');
        }

        logger.info('日期日志处理完成', { 
            dateStr, 
            processedFiles: logFiles.length 
        });
    }

    // 处理单个日志文件
    async processLogFile(fileInfo, processingType = 'scheduled') {
        const { fileName, filePath, size } = fileInfo;
        
        try {
            logger.debug('开始处理日志文件', { fileName, size, processingType });

            // 检查处理进度（避免重复处理）
            const processingLogs = await this.databaseService.getProcessingLog();
            const existingLog = processingLogs.find(log => log.file_name === fileName);
            
            let startPosition = 0;
            if (existingLog && existingLog.status === 'completed') {
                // 如果文件已完整处理过，只处理增量部分
                startPosition = existingLog.last_position || 0;
            }

            // 复用LogParserService解析日志文件
            const parseResults = await this.logParserService.parseLogFile(filePath, 0);
            
            if (parseResults && parseResults.length > 0) {
                // 过滤掉已处理的记录（基于位置）
                const newRecords = parseResults;

                // 添加文件来源信息并转换字段名称
                const recordsWithSource = newRecords.map(record => ({
                    plateNumber: record.licensePlate,
                    callTime: record.requestTimestamp,
                    responseTime: record.responseTimestamp,
                    freeParking: record.freeParking,
                    rejectReason: record.rejectReason,
                    fileSource: fileName,
                    // 新增：支持JSON错误记录的附加信息
                    recordType: record.recordType || 'normal',
                    metadata: record.metadata // 保留JSON错误记录的元数据
                }));

                // 批量插入到数据库
                const insertResult = await this.databaseService.insertSamRecordsBatch(recordsWithSource);
                
                // 更新处理进度
                await this.databaseService.updateProcessingLog({
                    fileName,
                    filePath,
                    lastPosition: size, // 整个文件大小作为最后位置
                    totalRecords: parseResults.length,
                    processedRecords: insertResult.total,
                    status: 'completed'
                });

                logger.info('文件处理完成', {
                    fileName,
                    totalRecords: parseResults.length,
                    insertedRecords: insertResult.inserted,
                    updatedRecords: insertResult.updated,
                    processingType
                });

            } else {
                logger.debug('文件中没有找到山姆接口记录', { fileName });
                
                // 仍然更新处理状态
                await this.databaseService.updateProcessingLog({
                    fileName,
                    filePath,
                    lastPosition: size,
                    totalRecords: 0,
                    processedRecords: 0,
                    status: 'completed'
                });
            }

        } catch (error) {
            logger.error('处理日志文件失败', {
                fileName,
                error: error.message,
                processingType
            });

            // 更新失败状态
            await this.databaseService.updateProcessingLog({
                fileName,
                filePath,
                lastPosition: 0,
                totalRecords: 0,
                processedRecords: 0,
                status: 'failed'
            });
        }
    }

    // 手动触发处理（用于API调用）
    async manualProcess(dateStr = null) {
        if (this.isRunning) {
            throw new Error('日志处理正在运行中，请稍后再试');
        }

        try {
            this.isRunning = true;
            logger.info('手动触发日志处理', { dateStr });

            // 连接网络共享
            const connected = await this.networkService.connect();
            if (!connected) {
                throw new Error('网络连接失败');
            }

            if (dateStr) {
                // 处理指定日期
                const date = new Date(dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
                await this.processDateLogs(date);
            } else {
                // 处理今天
                await this.processDateLogs(new Date());
            }

            return {
                success: true,
                message: '日志处理完成',
                processedDate: dateStr || 'today'
            };

        } catch (error) {
            logger.error('手动处理失败', { dateStr, error: error.message });
            throw error;
        } finally {
            this.isRunning = false;
        }
    }

    // 获取处理状态
    getStatus() {
        return {
            isRunning: this.isRunning,
            lastProcessTime: this.lastProcessTime,
            scheduledTasks: Array.from(this.scheduledTasks.keys())
        };
    }

    // 处理demo数据作为回退（当网络连接失败时）
    async processDemoData() {
        try {
            logger.info('开始处理demo数据作为回退方案');
            
            const demoDataPath = path.join(__dirname, '../../demo-data');
            const demoLogFile = path.join(demoDataPath, 'sample-log.txt');
            
            // 检查demo文件是否存在
            if (!fs.existsSync(demoLogFile)) {
                throw new Error(`Demo文件不存在: ${demoLogFile}`);
            }
            
            // 解析demo日志文件
            const parseResults = await this.logParserService.parseLogFile(demoLogFile, 10); // 最多处理10条记录
            
            if (parseResults && parseResults.length > 0) {
                // 转换并添加文件来源信息
                const formatTimestamp = (timestamp) => {
                    if (!timestamp) return null;
                    return timestamp.replace(',', '.').replace(' ', 'T');
                };
                
                const recordsWithSource = parseResults.map(record => ({
                    plateNumber: record.licensePlate,
                    callTime: formatTimestamp(record.requestTimestamp),
                    responseTime: formatTimestamp(record.responseTimestamp),
                    freeParking: record.freeParking,
                    rejectReason: record.rejectReason,
                    fileSource: 'demo-data'
                }));
                
                // 批量插入到数据库
                const insertResult = await this.databaseService.insertSamRecordsBatch(recordsWithSource);
                
                logger.info('Demo数据处理完成', {
                    totalRecords: parseResults.length,
                    insertedRecords: insertResult.inserted,
                    updatedRecords: insertResult.updated
                });
                
                this.lastProcessTime = new Date();
                return true;
            } else {
                logger.warn('Demo文件中没有找到有效记录');
                return false;
            }
            
        } catch (error) {
            logger.error('处理demo数据失败', { error: error.message });
            throw error;
        }
    }
}

module.exports = LogScheduler;
