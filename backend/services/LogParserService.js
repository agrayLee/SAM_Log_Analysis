/**
 * 日志解析模块
 * 处理山姆接口日志的解析，提取车牌号、查询结果等信息
 * 使用流式读取处理大文件，避免内存溢出
 */

const fs = require('fs');
const path = require('path');
const { createReadStream } = require('fs');
const { createInterface } = require('readline');
const logger = require('../utils/logger');
const iconv = require('iconv-lite');

class LogParser {
    constructor() {
        this.requestPattern = /查询山姆是否会员，请求地址＝/;
        this.responsePattern = /查询山姆是否会员，返回结果＝/;
        this.licensePlatePattern = /"licensePlateNbr":"([^"]+)"/;
        // 修正JSON嵌套结构的正则表达式 - 处理复杂嵌套JSON
        this.freeParkingPattern = /"freeParking":\s*(true|false)/;
        this.rejectReasonPattern = /"rejectReason":\s*"([^"]*)"/;
        this.timestampPattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(,\d{3})?/;
        
        // 新增：JSON错误记录识别模式
        this.jsonErrorPattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}.*?\{.*?"code":\s*"ERROR".*?"appName":\s*"members-parking-service".*?\}/;
        this.jsonRecordPattern = /\{.*?"code":\s*"ERROR".*?"appName":\s*"members-parking-service".*?\}/;
        // 从请求记录的参数JSON中提取车牌号的模式
        this.licensePlateFromRequestPattern = /"licensePlateNbr"\s*:\s*"([^"]+)"/;
        // 从JSON错误消息中提取车牌号的模式 - 作为备用
        this.plateFromMessagePattern = /车牌号[绑定]?.*?[异常]?.*?\(([A-Z0-9\u4e00-\u9fa5]+)\)/;
        this.plateFromMessagePattern2 = /车牌[：:]\s*([A-Z0-9\u4e00-\u9fa5]+)/;
        this.plateFromMessagePattern3 = /车牌号码[：:]\s*([A-Z0-9\u4e00-\u9fa5]+)/;
        
        // 存储解析结果
        this.parsedRecords = [];
        this.requestBuffer = new Map(); // 临时存储请求记录，用于匹配
    }
    
    /**
     * 识别并获取指定日期文件夹中的所有相关日志文件
     * @param {string} dateFolder - 日期文件夹路径
     * @param {string} baseFileName - 基础文件名（如 JieLink_Center_Comm）
     * @returns {Array<Object>} 文件信息列表
     */
    identifyLogFiles(dateFolder, baseFileName) {
        try {
            logger.info('开始识别日志文件', {
                folder: dateFolder,
                baseFileName
            });
            
            // 从日期文件夹路径中提取日期（例如从 \\10.21.189.125\Logs\20250811 提取 20250811）
            const dateMatch = dateFolder.match(/(\d{8})$/);
            if (!dateMatch) {
                throw new Error(`无法从路径中提取日期: ${dateFolder}`);
            }
            const targetDate = dateMatch[1];
            const currentLogName = `${baseFileName}_${targetDate}.log`;
            
            logger.debug('提取的目标日期', {
                dateFolder,
                targetDate,
                currentLogName
            });
            
            // 构建文件路径模式
            const files = [];
            const basePath = path.join(dateFolder, currentLogName);
            
            // 检查当前文件
            if (this.fileExists(basePath)) {
                files.push({
                    path: basePath,
                    name: currentLogName,
                    type: 'current',
                    index: 0
                });
            }
            
            // 检查历史切片文件 (.log.1, .log.2, 等)
            for (let i = 1; i <= 20; i++) {
                const slicePath = `${basePath}.${i}`;
                if (this.fileExists(slicePath)) {
                    files.push({
                        path: slicePath,
                        name: `${currentLogName}.${i}`,
                        type: 'slice',
                        index: i
                    });
                } else {
                    // 如果某个序号不存在，假设后面的也不存在
                    break;
                }
            }
            
            // 按时间顺序排列（最新的在前）
            files.sort((a, b) => a.index - b.index);
            
            logger.info(`成功识别 ${files.length} 个日志文件`, {
                files: files.map(f => ({ name: f.name, type: f.type }))
            });
            
            return files;
            
        } catch (error) {
            logger.error('识别日志文件失败', {
                folder: dateFolder,
                error: error.message
            });
            
            return [];
        }
    }
    
    /**
     * 检查文件是否存在（跨平台）
     * @param {string} filePath - 文件路径
     * @returns {boolean} 文件是否存在
     */
    fileExists(filePath) {
        try {
            return fs.existsSync(filePath);
        } catch (error) {
            return false;
        }
    }
    
    /**
     * 格式化JSON错误原因信息
     * @param {string} message - 错误消息
     * @param {Object} jsonData - JSON数据对象
     * @returns {string} 格式化的错误原因
     */
    formatJsonErrorReason(message, jsonData) {
        const parts = [];
        
        if (message) {
            parts.push(`错误消息: ${message}`);
        }
        
        if (jsonData.returnCode) {
            parts.push(`错误代码: ${jsonData.returnCode}`);
        }
        
        if (jsonData.responseTime) {
            parts.push(`响应时间: ${jsonData.responseTime}ms`);
        }
        
        if (jsonData.traceId) {
            parts.push(`追踪ID: ${jsonData.traceId}`);
        }
        
        return parts.join(' | ');
    }
    
    /**
     * 解析JSON格式的错误记录
     * @param {string} line - 日志行内容
     * @param {string} timestamp - 时间戳
     * @param {number} lineNumber - 行号
     * @returns {Object|null} 解析结果或null
     */
    parseJsonErrorRecord(line, timestamp, lineNumber) {
        try {
            // 提取JSON部分
            const jsonMatch = line.match(this.jsonRecordPattern);
            if (!jsonMatch) {
                return null;
            }
            
            const jsonStr = jsonMatch[0];
            const jsonData = JSON.parse(jsonStr);
            
            // 验证是否是我们关心的错误记录
            if (jsonData.code !== 'ERROR' || jsonData.appName !== 'members-parking-service') {
                return null;
            }
            
            // JSON错误记录中没有车牌号，需要从匹配的请求记录中获取
            // 这里暂时设为null，会在匹配请求记录时设置
            let licensePlate = null;
            const message = jsonData.message || '';
            
            // 备用：尝试从错误消息中提取车牌号（以防万一）
            let plateMatch = message.match(this.plateFromMessagePattern);
            if (!plateMatch) {
                plateMatch = message.match(this.plateFromMessagePattern2);
            }
            if (!plateMatch) {
                plateMatch = message.match(this.plateFromMessagePattern3);
            }
            
            if (plateMatch) {
                licensePlate = plateMatch[1];
            }
            
            // 构造错误记录结果 - 兼容现有数据库结构
            const errorRecord = {
                requestTimestamp: timestamp,
                responseTimestamp: timestamp, // 错误记录只有一个时间戳
                licensePlate: licensePlate,
                freeParking: false, // 错误情况下默认为false
                rejectReason: this.formatJsonErrorReason(message, jsonData),
                requestLine: lineNumber,
                responseLine: lineNumber,
                recordType: 'json_error', // 标记为JSON错误记录
                // 额外的JSON字段信息存储在元数据中
                metadata: {
                    errorCode: jsonData.returnCode || jsonData.code,
                    responseTime: jsonData.responseTime || 0,
                    traceId: jsonData.traceId || '',
                    rawJsonData: jsonStr
                }
            };
            
            logger.debug('解析到JSON错误记录', {
                timestamp,
                licensePlate,
                errorCode: errorRecord.metadata.errorCode,
                traceId: errorRecord.metadata.traceId,
                line: lineNumber
            });
            
            return errorRecord;
            
        } catch (error) {
            logger.warn('解析JSON错误记录失败', {
                line: lineNumber,
                error: error.message,
                lineContent: line.substring(0, 200) // 只记录前200字符避免日志过长
            });
            return null;
        }
    }
    
    /**
     * 解析单个日志文件中的山姆接口记录
     * @param {string} filePath - 文件路径
     * @param {number} maxRecords - 最大记录数（0表示不限制）
     * @returns {Promise<Array>} 解析结果
     */
    async parseLogFile(filePath, maxRecords = 0) {
        return new Promise((resolve, reject) => {
            try {
                logger.info('开始解析日志文件', {
                    file: path.basename(filePath),
                    path: filePath,
                    maxRecords
                });
                
                const startTime = Date.now();
                const results = [];
                const requestMap = new Map(); // 临时存储请求，用于匹配响应
                
                // 使用二进制模式读取，然后用iconv-lite转换GBK编码
                const fileStream = createReadStream(filePath, { 
                    highWaterMark: 64 * 1024 // 64KB缓冲区
                }).pipe(iconv.decodeStream('gbk'));
                const rl = createInterface({
                    input: fileStream,
                    crlfDelay: Infinity // 处理Windows和Unix的换行符
                });
                
                let lineCount = 0;
                let processedRequests = 0;
                let processedResponses = 0;
                let processedJsonErrors = 0; // 新增：JSON错误记录计数
                
                rl.on('line', (line) => {
                    lineCount++;
                    
                    try {
                        // 提取时间戳
                        const timestampMatch = line.match(this.timestampPattern);
                        if (!timestampMatch) {
                            return; // 跳过没有时间戳的行
                        }
                        
                        const timestamp = timestampMatch[0];
                        
                        // 检查是否是山姆请求行
                        if (this.requestPattern.test(line)) {
                            // 优先从参数JSON中提取车牌号
                            let plateMatch = line.match(this.licensePlateFromRequestPattern);
                            if (!plateMatch) {
                                // 备用：从旧格式中提取
                                plateMatch = line.match(this.licensePlatePattern);
                            }
                            
                            if (plateMatch) {
                                const requestData = {
                                    timestamp,
                                    licensePlate: plateMatch[1],
                                    line: lineCount,
                                    type: 'request',
                                    rawLine: line // 保存原始行，用于JSON错误记录匹配
                                };
                                
                                // 使用时间戳作为key临时存储
                                requestMap.set(timestamp, requestData);
                                processedRequests++;
                                
                                logger.debug('发现山姆查询请求', {
                                    timestamp,
                                    licensePlate: plateMatch[1],
                                    line: lineCount,
                                    extractMethod: plateMatch === line.match(this.licensePlateFromRequestPattern) ? 'JSON参数' : '旧格式'
                                });
                            }
                        }
                        
                                // 检查是否是山姆响应行
        else if (this.responsePattern.test(line)) {
            const freeParkingMatch = line.match(this.freeParkingPattern);
            const rejectReasonMatch = line.match(this.rejectReasonPattern);
            
            // 处理正常的成功/失败响应（包含freeParking字段）
            if (freeParkingMatch) {
                // 寻找最近的请求记录进行匹配
                const matchingRequest = this.findMatchingRequest(requestMap, timestamp);
                
                if (matchingRequest) {
                    const combinedRecord = {
                        requestTimestamp: matchingRequest.timestamp,
                        responseTimestamp: timestamp,
                        licensePlate: matchingRequest.licensePlate,
                        freeParking: freeParkingMatch[1] === 'true',
                        rejectReason: rejectReasonMatch ? rejectReasonMatch[1] : '',
                        requestLine: matchingRequest.line,
                        responseLine: lineCount
                    };
                    
                    results.push(combinedRecord);
                    processedResponses++;
                    
                    // 移除已匹配的请求
                    requestMap.delete(matchingRequest.timestamp);
                    
                    logger.debug('成功匹配请求响应对', {
                        licensePlate: combinedRecord.licensePlate,
                        freeParking: combinedRecord.freeParking,
                        responseTime: timestamp
                    });
                    
                    // 检查是否已达到最大记录数
                    if (maxRecords > 0 && results.length >= maxRecords) {
                        rl.close();
                        return;
                    }
                }
            }
            // 新增：处理JSON格式的错误响应（不包含freeParking但包含ERROR的情况）
            else if (this.jsonRecordPattern.test(line)) {
                const errorRecord = this.parseJsonErrorRecord(line, timestamp, lineCount);
                
                if (errorRecord) {
                    // 尝试匹配对应的请求记录
                    const matchingRequest = this.findMatchingRequest(requestMap, timestamp);
                    
                    if (matchingRequest) {
                        // 🔧 关键修复：强制使用匹配请求中的车牌号
                        errorRecord.requestTimestamp = matchingRequest.timestamp;
                        errorRecord.licensePlate = matchingRequest.licensePlate; // 直接使用请求中的车牌号
                        errorRecord.requestLine = matchingRequest.line;
                        
                        // 移除已匹配的请求
                        requestMap.delete(matchingRequest.timestamp);
                        
                        logger.info('🎯 成功匹配JSON错误响应对', {
                            licensePlate: errorRecord.licensePlate,
                            errorCode: errorRecord.metadata.errorCode,
                            requestTime: matchingRequest.timestamp,
                            responseTime: timestamp,
                            requestLine: matchingRequest.line,
                            responseLine: lineCount
                        });
                    } else {
                        logger.warn('JSON错误记录未找到匹配的请求', {
                            timestamp,
                            errorCode: errorRecord.metadata ? errorRecord.metadata.errorCode : 'unknown',
                            line: lineCount
                        });
                        
                        // 即使没有匹配的请求也保留记录，但标记为未匹配
                        errorRecord.licensePlate = errorRecord.licensePlate || 'UNMATCHED';
                    }
                    
                    results.push(errorRecord);
                    processedJsonErrors++;
                    
                    logger.debug('添加JSON错误记录到结果', {
                        licensePlate: errorRecord.licensePlate,
                        recordType: errorRecord.recordType,
                        resultsCount: results.length
                    });
                    
                    // 检查是否已达到最大记录数
                    if (maxRecords > 0 && results.length >= maxRecords) {
                        rl.close();
                        return;
                    }
                }
            }
        }
                        
                    } catch (lineError) {
                        logger.warn('处理日志行时发生错误', {
                            line: lineCount,
                            error: lineError.message
                        });
                    }
                });
                
                rl.on('close', () => {
                    const duration = Date.now() - startTime;
                    
                    logger.performance('日志文件解析完成', duration, {
                        file: path.basename(filePath),
                        totalLines: lineCount,
                        foundRequests: processedRequests,
                        foundResponses: processedResponses,
                        foundJsonErrors: processedJsonErrors, // 新增：JSON错误记录统计
                        totalRecords: results.length
                    });
                    
                    logger.info('日志解析完成', {
                        file: path.basename(filePath),
                        totalResults: results.length,
                        normalRequests: processedRequests,
                        normalResponses: processedResponses,
                        jsonErrors: processedJsonErrors,
                        duration: `${duration}ms`
                    });
                    
                    resolve(results);
                });
                
                rl.on('error', (error) => {
                    logger.error('读取日志文件失败', {
                        file: path.basename(filePath),
                        error: error.message
                    });
                    
                    reject(error);
                });
                
                // 处理文件流错误
                fileStream.on('error', (error) => {
                    logger.error('文件流读取错误', {
                        file: path.basename(filePath),
                        error: error.message
                    });
                    
                    reject(error);
                });
                
            } catch (error) {
                logger.error('解析日志文件时发生异常', {
                    file: path.basename(filePath),
                    error: error.message
                });
                
                reject(error);
            }
        });
    }
    
    /**
     * 根据时间戳找到最匹配的请求记录
     * @param {Map} requestMap - 请求记录映射
     * @param {string} responseTimestamp - 响应时间戳
     * @returns {Object|null} 匹配的请求记录
     */
    findMatchingRequest(requestMap, responseTimestamp) {
        try {
            // 修复时间戳解析：将逗号替换为点号以符合ISO格式
            const responseTime = new Date(responseTimestamp.replace(',', '.'));
            let closestRequest = null;
            let minTimeDiff = Infinity;
            
            for (const [reqTimestamp, requestData] of requestMap) {
                const requestTime = new Date(reqTimestamp.replace(',', '.'));
                const timeDiff = responseTime - requestTime;
                
                // 响应应该在请求之后，且时间差最小
                if (timeDiff >= 0 && timeDiff < minTimeDiff) {
                    minTimeDiff = timeDiff;
                    closestRequest = requestData;
                }
            }
            
            // 如果时间差超过5分钟，认为不匹配
            if (minTimeDiff > 5 * 60 * 1000) {
                logger.debug('请求响应时间差过大，跳过匹配', {
                    responseTimestamp,
                    timeDiffMinutes: (minTimeDiff / (60 * 1000)).toFixed(2)
                });
                return null;
            }
            
            return closestRequest;
            
        } catch (error) {
            logger.warn('匹配请求响应时发生错误', {
                responseTimestamp,
                error: error.message
            });
            return null;
        }
    }
    
    /**
     * 测试大文件读取性能
     * @param {string} filePath - 文件路径
     * @returns {Promise<Object>} 性能测试结果
     */
    async testFilePerformance(filePath) {
        return new Promise((resolve, reject) => {
            try {
                logger.info('开始大文件性能测试', {
                    file: path.basename(filePath)
                });
                
                const startTime = Date.now();
                const startMemory = process.memoryUsage();
                
                let lineCount = 0;
                let byteCount = 0;
                
                const fileStream = createReadStream(filePath, { encoding: 'utf8' });
                const rl = createInterface({
                    input: fileStream,
                    crlfDelay: Infinity
                });
                
                rl.on('line', (line) => {
                    lineCount++;
                    byteCount += Buffer.byteLength(line, 'utf8');
                });
                
                rl.on('close', () => {
                    const endTime = Date.now();
                    const endMemory = process.memoryUsage();
                    
                    const duration = endTime - startTime;
                    const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;
                    
                    const result = {
                        fileName: path.basename(filePath),
                        fileSize: `${(byteCount / (1024 * 1024)).toFixed(2)} MB`,
                        fileSizeBytes: byteCount,
                        lineCount,
                        duration: `${duration}ms`,
                        durationMs: duration,
                        memoryUsed: `${(memoryUsed / (1024 * 1024)).toFixed(2)} MB`,
                        memoryUsedBytes: memoryUsed,
                        throughput: `${(byteCount / (1024 * 1024) / (duration / 1000)).toFixed(2)} MB/s`
                    };
                    
                    logger.performance('大文件性能测试完成', duration, result);
                    
                    resolve(result);
                });
                
                rl.on('error', (error) => {
                    logger.error('性能测试失败', {
                        file: path.basename(filePath),
                        error: error.message
                    });
                    
                    reject(error);
                });
                
            } catch (error) {
                logger.error('性能测试异常', {
                    file: path.basename(filePath),
                    error: error.message
                });
                
                reject(error);
            }
        });
    }
    
    /**
     * 格式化解析结果用于输出
     * @param {Array} results - 解析结果
     * @returns {string} 格式化的结果字符串
     */
    formatResults(results) {
        if (!results || results.length === 0) {
            return '未找到任何山姆接口记录';
        }
        
        let output = `\n========== 山姆接口解析结果 (共${results.length}条记录) ==========\n`;
        
        results.forEach((record, index) => {
            output += `\n--- 记录 ${index + 1} ---\n`;
            output += `车牌号: ${record.licensePlate}\n`;
            output += `查询时间: ${record.requestTimestamp}\n`;
            output += `响应时间: ${record.responseTimestamp}\n`;
            output += `免费停车: ${record.freeParking ? '是' : '否'}\n`;
            output += `失败原因: ${record.rejectReason || '无'}\n`;
            output += `请求行号: ${record.requestLine}\n`;
            output += `响应行号: ${record.responseLine}\n`;
        });
        
        output += '\n=======================================================\n';
        
        return output;
    }
}

module.exports = LogParser;
