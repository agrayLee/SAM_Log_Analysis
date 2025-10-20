/**
 * 日志查询路由
 * 提供山姆接口日志的查询、统计和管理功能
 */

const express = require('express');
const router = express.Router();
const DatabaseService = require('../services/DatabaseService');
const LogScheduler = require('../services/LogScheduler');
const NetworkService = require('../services/NetworkService');
const LogParserService = require('../services/LogParserService');
const { requireAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

const databaseService = new DatabaseService();

// 查询山姆接口记录
router.get('/records', requireAuth, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            plateNumber,
            startDate,
            endDate,
            freeParking,
            orderBy = 'call_time',
            orderDirection = 'DESC'
        } = req.query;

        // 参数验证
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        if (pageNum < 1 || limitNum < 1 || limitNum > 200) {
            return res.status(400).json({
                success: false,
                message: '分页参数错误',
                code: 'INVALID_PAGINATION'
            });
        }

        const queryOptions = {
            page: pageNum,
            limit: limitNum,
            plateNumber,
            startDate,
            endDate,
            freeParking,
            orderBy,
            orderDirection
        };

        const result = await databaseService.getSamRecords(queryOptions);

        logger.info('查询山姆记录', {
            userId: req.user.id,
            queryOptions,
            resultCount: result.records.length
        });

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        logger.error('查询记录失败', {
            error: error.message,
            userId: req.user.id,
            query: req.query
        });

        res.status(500).json({
            success: false,
            message: '查询失败',
            code: 'QUERY_ERROR'
        });
    }
});

// 获取统计信息
router.get('/statistics', requireAuth, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const dateRange = {};
        if (startDate) dateRange.startDate = startDate;
        if (endDate) dateRange.endDate = endDate;

        const stats = await databaseService.getStatistics(dateRange);

        logger.info('查询统计信息', {
            userId: req.user.id,
            dateRange
        });

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        logger.error('获取统计信息失败', {
            error: error.message,
            userId: req.user.id
        });

        res.status(500).json({
            success: false,
            message: '获取统计信息失败',
            code: 'STATISTICS_ERROR'
        });
    }
});

// 实时查询指定车牌（结合数据库历史 + 实时解析）
router.get('/realtime/:plateNumber', requireAuth, async (req, res) => {
    try {
        const { plateNumber } = req.params;
        const { days = 7 } = req.query;

        if (!plateNumber) {
            return res.status(400).json({
                success: false,
                message: '车牌号不能为空',
                code: 'MISSING_PLATE_NUMBER'
            });
        }

        // 1. 从数据库查询历史记录
        const endDate = new Date().toISOString();
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        const historyResult = await databaseService.getSamRecords({
            plateNumber,
            startDate,
            endDate,
            limit: 100
        });

        // 2. 实时解析最新日志文件（可选）
        let realtimeRecords = [];
        try {
            const networkService = new NetworkService();
            const logParserService = new LogParserService();

            const connected = await networkService.connectToNetworkShare();
            if (connected) {
                const todayFolderPath = networkService.getTodayFolderPath();
                if (await networkService.checkFolderExists(todayFolderPath)) {
                    const logFiles = await logParserService.identifyLogFiles(todayFolderPath);
                    
                    // 只解析最新的1个文件
                    if (logFiles.length > 0) {
                        const latestFile = logFiles[0];
                        const parseResult = await logParserService.parseLogFile(latestFile.filePath, 50);
                        
                        // 筛选指定车牌的记录
                        realtimeRecords = parseResult.records.filter(record => 
                            record.plateNumber && record.plateNumber.includes(plateNumber)
                        );
                    }
                }
            }
        } catch (realtimeError) {
            logger.warn('实时解析失败，仅返回历史数据', {
                plateNumber,
                error: realtimeError.message
            });
        }

        // 3. 合并结果（去重）
        const allRecords = [...historyResult.records];
        
        // 添加实时记录（避免重复）
        realtimeRecords.forEach(realtimeRecord => {
            const exists = allRecords.some(historyRecord => 
                historyRecord.plate_number === realtimeRecord.plateNumber &&
                historyRecord.call_time === realtimeRecord.callTime
            );
            
            if (!exists) {
                allRecords.push({
                    plate_number: realtimeRecord.plateNumber,
                    call_time: realtimeRecord.callTime,
                    response_time: realtimeRecord.responseTime,
                    free_parking: realtimeRecord.freeParking,
                    reject_reason: realtimeRecord.rejectReason,
                    file_source: '实时解析',
                    created_at: new Date().toISOString()
                });
            }
        });

        // 按时间排序
        allRecords.sort((a, b) => new Date(b.call_time) - new Date(a.call_time));

        logger.info('实时查询车牌', {
            plateNumber,
            historyCount: historyResult.records.length,
            realtimeCount: realtimeRecords.length,
            totalCount: allRecords.length,
            userId: req.user.id
        });

        res.json({
            success: true,
            data: {
                plateNumber,
                records: allRecords,
                summary: {
                    total: allRecords.length,
                    historyCount: historyResult.records.length,
                    realtimeCount: realtimeRecords.length,
                    queryRange: `${days}天内`
                }
            }
        });

    } catch (error) {
        logger.error('实时查询失败', {
            plateNumber: req.params.plateNumber,
            error: error.message,
            userId: req.user.id
        });

        res.status(500).json({
            success: false,
            message: '实时查询失败',
            code: 'REALTIME_QUERY_ERROR'
        });
    }
});

// 手动触发日志处理
router.post('/process', requireAuth, async (req, res) => {
    try {
        const { dateStr, force = false } = req.body;

        // 创建临时的LogScheduler实例
        const logScheduler = new LogScheduler();

        const result = await logScheduler.manualProcess(dateStr);

        logger.info('手动触发日志处理', {
            dateStr,
            force,
            result,
            userId: req.user.id
        });

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        logger.error('手动处理失败', {
            error: error.message,
            body: req.body,
            userId: req.user.id
        });

        res.status(500).json({
            success: false,
            message: error.message,
            code: 'MANUAL_PROCESS_ERROR'
        });
    }
});

// 获取处理进度
router.get('/processing-status', requireAuth, async (req, res) => {
    try {
        const processingLogs = await databaseService.getProcessingLog();

        // 计算汇总信息
        const summary = {
            totalFiles: processingLogs.length,
            completedFiles: processingLogs.filter(log => log.status === 'completed').length,
            failedFiles: processingLogs.filter(log => log.status === 'failed').length,
            pendingFiles: processingLogs.filter(log => log.status === 'pending').length,
            lastProcessedAt: processingLogs.length > 0 
                ? processingLogs[0].last_processed_at 
                : null
        };

        res.json({
            success: true,
            data: {
                summary,
                files: processingLogs.slice(0, 20) // 最近20个文件
            }
        });

    } catch (error) {
        logger.error('获取处理状态失败', {
            error: error.message,
            userId: req.user.id
        });

        res.status(500).json({
            success: false,
            message: '获取处理状态失败',
            code: 'PROCESSING_STATUS_ERROR'
        });
    }
});

// 测试网络连接
router.get('/test-connection', requireAuth, async (req, res) => {
    try {
        const networkService = new NetworkService();
        
        const startTime = Date.now();
        const connected = await networkService.connectToNetworkShare();
        const connectionTime = Date.now() - startTime;

        let folderStatus = null;
        let fileStatus = null;

        if (connected) {
            try {
                const todayFolderPath = networkService.getTodayFolderPath();
                folderStatus = {
                    path: todayFolderPath,
                    exists: await networkService.checkFolderExists(todayFolderPath)
                };

                if (folderStatus.exists) {
                    const logParserService = new LogParserService();
                    const logFiles = await logParserService.identifyLogFiles(todayFolderPath);
                    fileStatus = {
                        count: logFiles.length,
                        files: logFiles.slice(0, 5).map(f => ({
                            name: f.fileName,
                            size: f.size,
                            sizeFormatted: `${(f.size / (1024 * 1024)).toFixed(2)}MB`
                        }))
                    };
                }
            } catch (folderError) {
                folderStatus = { error: folderError.message };
            }
        }

        logger.info('网络连接测试', {
            connected,
            connectionTime,
            folderStatus,
            userId: req.user.id
        });

        res.json({
            success: true,
            data: {
                connected,
                connectionTime,
                folderStatus,
                fileStatus,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('网络连接测试失败', {
            error: error.message,
            userId: req.user.id
        });

        res.status(500).json({
            success: false,
            message: '网络连接测试失败',
            code: 'CONNECTION_TEST_ERROR'
        });
    }
});

// 增量处理最新日志（从最后处理时间到当前时间）
router.get('/process-latest', requireAuth, async (req, res) => {
    try {
        // 设置Server-Sent Events响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

        // 发送消息的辅助函数
        const sendEvent = (type, data) => {
            res.write(`event: ${type}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        // 发送开始消息
        sendEvent('start', {
            message: '开始查询最新日志...',
            timestamp: new Date().toISOString(),
            userId: req.user.id
        });

        try {
            // 1. 获取最后处理时间
            sendEvent('progress', {
                step: 'getting_last_time',
                message: '获取最后处理时间...',
                progress: 10
            });

            const timeInfo = await databaseService.getLastProcessingTime();
            
            sendEvent('progress', {
                step: 'last_time_found',
                message: `找到最后处理时间: ${timeInfo.selectedTime}`,
                progress: 20,
                data: timeInfo
            });

            // 2. 连接网络共享
            sendEvent('progress', {
                step: 'connecting_network',
                message: '连接网络共享...',
                progress: 30
            });

            const networkService = new NetworkService();
            const connected = await networkService.connect();
            
            if (!connected) {
                sendEvent('error', {
                    message: '网络连接失败，无法处理最新日志',
                    code: 'NETWORK_CONNECTION_FAILED'
                });
                return;
            }

            sendEvent('progress', {
                step: 'network_connected',
                message: '网络连接成功',
                progress: 40
            });

            // 3. 创建增量处理器
            const logScheduler = new LogScheduler();
            let totalNewRecords = 0;
            let processedFiles = 0;

            // 4. 处理今天和昨天的日志
            const currentDate = new Date();
            const yesterday = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
            const datesToProcess = [yesterday, currentDate];

            for (let i = 0; i < datesToProcess.length; i++) {
                const date = datesToProcess[i];
                const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
                
                sendEvent('progress', {
                    step: 'processing_date',
                    message: `处理日期: ${dateStr}`,
                    progress: 50 + (i * 20),
                    data: { date: dateStr, index: i + 1, total: datesToProcess.length }
                });

                try {
                    // 获取该日期的日志文件夹
                    const dateFolderPath = networkService.getDateFolderPath(dateStr);
                    
                    if (!networkService.fileExists(dateFolderPath)) {
                        sendEvent('warning', {
                            message: `日期文件夹不存在: ${dateStr}`,
                            data: { dateStr, folderPath: dateFolderPath }
                        });
                        continue;
                    }

                    // 识别日志文件
                    const logParserService = new LogParserService();
                    const logFiles = logParserService.identifyLogFiles(dateFolderPath, 'JieLink_Center_Comm');
                    
                    sendEvent('progress', {
                        step: 'files_identified',
                        message: `找到 ${logFiles.length} 个日志文件`,
                        data: { 
                            dateStr, 
                            fileCount: logFiles.length,
                            files: logFiles.slice(0, 3).map(f => f.name) // 只显示前3个文件名
                        }
                    });

                    // 处理每个文件
                    for (let j = 0; j < logFiles.length; j++) {
                        const file = logFiles[j];
                        const fileName = file.name;
                        
                        sendEvent('progress', {
                            step: 'processing_file',
                            message: `处理文件: ${fileName}`,
                            progress: 50 + (i * 20) + (j / logFiles.length * 15),
                            data: { fileName, fileIndex: j + 1, totalFiles: logFiles.length }
                        });

                        try {
                            // 检查文件是否已处理过
                            const processingLogs = await databaseService.getProcessingLog();
                            const existingLog = processingLogs.find(log => log.file_name === fileName);
                            
                            // 解析日志文件
                            const parseResults = await logParserService.parseLogFile(file.path, 0);
                            
                            if (parseResults && parseResults.length > 0) {
                                // 过滤出比最后处理时间更新的记录
                                const lastTime = new Date(timeInfo.selectedTime);
                                const newRecords = parseResults.filter(record => {
                                    if (!record.requestTimestamp) return false;
                                    const recordTime = new Date(record.requestTimestamp.replace(',', '.'));
                                    return recordTime > lastTime;
                                });

                                if (newRecords.length > 0) {
                                    // 转换并插入新记录
                                    const recordsWithSource = newRecords.map(record => ({
                                        plateNumber: record.licensePlate,
                                        callTime: record.requestTimestamp,
                                        responseTime: record.responseTimestamp,
                                        freeParking: record.freeParking,
                                        rejectReason: record.rejectReason,
                                        fileSource: fileName
                                    }));

                                    const insertResult = await databaseService.insertSamRecordsBatch(recordsWithSource);
                                    totalNewRecords += insertResult.inserted;

                                    sendEvent('progress', {
                                        step: 'records_inserted',
                                        message: `新增 ${insertResult.inserted} 条记录`,
                                        data: {
                                            fileName,
                                            newRecords: newRecords.length,
                                            inserted: insertResult.inserted,
                                            totalNew: totalNewRecords
                                        }
                                    });
                                } else {
                                    sendEvent('progress', {
                                        step: 'no_new_records',
                                        message: '该文件无新记录',
                                        data: { fileName, totalRecords: parseResults.length }
                                    });
                                }

                                // 更新处理进度
                                await databaseService.updateProcessingLog({
                                    fileName,
                                    filePath: file.path,
                                    lastPosition: networkService.getFileSize(file.path) || 0,
                                    totalRecords: parseResults.length,
                                    processedRecords: parseResults.length,
                                    status: 'completed'
                                });

                            } else {
                                sendEvent('progress', {
                                    step: 'no_records_found',
                                    message: '文件中未找到山姆接口记录',
                                    data: { fileName }
                                });
                            }

                            processedFiles++;

                        } catch (fileError) {
                            sendEvent('error', {
                                message: `处理文件失败: ${fileName}`,
                                error: fileError.message,
                                data: { fileName, dateStr }
                            });
                        }
                    }

                } catch (dateError) {
                    sendEvent('error', {
                        message: `处理日期失败: ${dateStr}`,
                        error: dateError.message,
                        data: { dateStr }
                    });
                }
            }

            // 发送完成消息
            sendEvent('completed', {
                message: '增量处理完成',
                summary: {
                    processedFiles,
                    totalNewRecords,
                    timeRange: {
                        from: timeInfo.selectedTime,
                        to: new Date().toISOString()
                    }
                },
                timestamp: new Date().toISOString()
            });

            logger.info('增量处理最新日志完成', {
                userId: req.user.id,
                processedFiles,
                totalNewRecords,
                timeRange: timeInfo.selectedTime
            });

        } catch (error) {
            sendEvent('error', {
                message: '处理过程中发生错误',
                error: error.message,
                stack: error.stack
            });

            logger.error('增量处理失败', {
                error: error.message,
                userId: req.user.id
            });
        }

    } catch (error) {
        logger.error('启动增量处理失败', {
            error: error.message,
            userId: req.user.id
        });

        // 如果SSE还没设置，则发送JSON错误
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: '启动增量处理失败',
                code: 'INCREMENTAL_PROCESS_ERROR'
            });
        }
    }
});

// 导出数据（CSV格式）
router.get('/export', requireAuth, async (req, res) => {
    try {
        const {
            plateNumber,
            startDate,
            endDate,
            freeParking,
            format = 'csv'
        } = req.query;

        const queryOptions = {
            plateNumber,
            startDate,
            endDate,
            freeParking,
            limit: 10000 // 导出限制
        };

        const result = await databaseService.getSamRecords(queryOptions);

        if (format === 'csv') {
            // 生成CSV数据
            const csvHeader = '车牌号,查询时间,响应时间,免费停车,失败原因,文件来源,创建时间\n';
            const csvRows = result.records.map(record => {
                return [
                    record.plate_number,
                    record.call_time,
                    record.response_time || '',
                    record.free_parking ? '是' : '否',
                    record.reject_reason || '',
                    record.file_source || '',
                    record.created_at
                ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
            }).join('\n');

            const csvContent = csvHeader + csvRows;

            logger.info('导出数据', {
                format,
                recordCount: result.records.length,
                queryOptions,
                userId: req.user.id
            });

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="sam_logs_${new Date().toISOString().split('T')[0]}.csv"`);
            res.send('\ufeff' + csvContent); // UTF-8 BOM for Excel

        } else {
            // JSON格式
            res.json({
                success: true,
                data: result
            });
        }

    } catch (error) {
        logger.error('导出数据失败', {
            error: error.message,
            query: req.query,
            userId: req.user.id
        });

        res.status(500).json({
            success: false,
            message: '导出数据失败',
            code: 'EXPORT_ERROR'
        });
    }
});

module.exports = router;
