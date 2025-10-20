/**
 * 数据库服务
 * 提供山姆日志记录的CRUD操作
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../utils/logger');

class DatabaseService {
    constructor() {
        this.dbPath = path.join(__dirname, '../database/sam_logs.db');
        this.db = null;
    }

    // 获取数据库连接
    getConnection() {
        if (!this.db) {
            this.db = new sqlite3.Database(this.dbPath);
        }
        return this.db;
    }

    // 关闭数据库连接
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    // 通用查询方法
    query(sql, params = []) {
        return new Promise((resolve, reject) => {
            const db = this.getConnection();
            db.all(sql, params, (err, rows) => {
                if (err) {
                    logger.error('数据库查询错误', { sql, params, error: err.message });
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // 通用执行方法
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            const db = this.getConnection();
            db.run(sql, params, function(err) {
                if (err) {
                    logger.error('数据库执行错误', { sql, params, error: err.message });
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    // 插入山姆记录
    async insertSamRecord(record) {
        const {
            plateNumber,
            callTime,
            responseTime,
            freeParking,
            rejectReason,
            fileSource,
            recordType,
            metadata
        } = record;

        // 🔧 修复：为JSON错误记录增强rejectReason信息
        let enhancedRejectReason = rejectReason;
        if (recordType === 'json_error' && metadata) {
            enhancedRejectReason = `${rejectReason} [错误代码:${metadata.errorCode}] [追踪ID:${metadata.traceId}] [响应时间:${metadata.responseTime}ms]`;
        }

        const sql = `
            INSERT OR REPLACE INTO sam_records 
            (plate_number, call_time, response_time, free_parking, reject_reason, file_source)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        const params = [
            plateNumber,
            callTime,
            responseTime,
            freeParking ? 1 : 0,
            enhancedRejectReason,
            fileSource
        ];

        try {
            const result = await this.run(sql, params);
            logger.debug('插入山姆记录', { plateNumber, result });
            return result;
        } catch (error) {
            logger.error('插入山姆记录失败', { plateNumber, error: error.message });
            throw error;
        }
    }

    // 批量插入山姆记录
    async insertSamRecordsBatch(records) {
        if (!records || records.length === 0) {
            return { inserted: 0, updated: 0 };
        }

        const db = this.getConnection();
        let inserted = 0;
        let updated = 0;

        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                const stmt = db.prepare(`
                    INSERT OR REPLACE INTO sam_records 
                    (plate_number, call_time, response_time, free_parking, reject_reason, file_source)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);

                records.forEach((record) => {
                    const {
                        plateNumber,
                        callTime,
                        responseTime,
                        freeParking,
                        rejectReason,
                        fileSource,
                        recordType,
                        metadata
                    } = record;

                    // 🔧 修复：为JSON错误记录增强rejectReason信息
                    let enhancedRejectReason = rejectReason;
                    if (recordType === 'json_error' && metadata) {
                        enhancedRejectReason = `${rejectReason} [错误代码:${metadata.errorCode}] [追踪ID:${metadata.traceId}] [响应时间:${metadata.responseTime}ms]`;
                    }

                    stmt.run([
                        plateNumber,
                        callTime,
                        responseTime,
                        freeParking ? 1 : 0,
                        enhancedRejectReason,
                        fileSource
                    ], function(err) {
                        if (err) {
                            logger.error('批量插入记录失败', { plateNumber, error: err.message });
                        } else {
                            if (this.changes > 0) {
                                if (this.lastID > 0) {
                                    inserted++;
                                } else {
                                    updated++;
                                }
                            }
                        }
                    });
                });

                stmt.finalize();

                db.run('COMMIT', (err) => {
                    if (err) {
                        logger.error('事务提交失败', { error: err.message });
                        reject(err);
                    } else {
                        logger.info('批量插入完成', { total: records.length, inserted, updated });
                        resolve({ inserted, updated, total: records.length });
                    }
                });
            });
        });
    }

    // 查询山姆记录（支持分页和筛选）
    async getSamRecords(options = {}) {
        const {
            page = 1,
            limit = 50,
            plateNumber,
            startDate,
            endDate,
            freeParking,
            orderBy = 'call_time',
            orderDirection = 'DESC'
        } = options;

        const offset = (page - 1) * limit;
        let whereConditions = [];
        let params = [];

        // 构建WHERE条件
        if (plateNumber) {
            whereConditions.push('plate_number LIKE ?');
            params.push(`%${plateNumber}%`);
        }

        if (startDate) {
            whereConditions.push('call_time >= ?');
            params.push(startDate);
        }

        if (endDate) {
            whereConditions.push('call_time <= ?');
            params.push(endDate);
        }

        if (freeParking !== undefined) {
            whereConditions.push('free_parking = ?');
            params.push(freeParking === 'true' ? 1 : 0);
        }

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}` 
            : '';

        // 查询数据
        const dataSql = `
            SELECT id, plate_number, call_time, response_time, 
                   free_parking, reject_reason, file_source, created_at
            FROM sam_records 
            ${whereClause}
            ORDER BY ${orderBy} ${orderDirection}
            LIMIT ? OFFSET ?
        `;

        // 查询总数
        const countSql = `
            SELECT COUNT(*) as total 
            FROM sam_records 
            ${whereClause}
        `;

        try {
            const [records, countResult] = await Promise.all([
                this.query(dataSql, [...params, limit, offset]),
                this.query(countSql, params)
            ]);

            const total = countResult[0]?.total || 0;

            // 转换数据格式
            const formattedRecords = records.map(record => ({
                ...record,
                free_parking: record.free_parking === 1
            }));

            return {
                records: formattedRecords,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            logger.error('查询山姆记录失败', { options, error: error.message });
            throw error;
        }
    }

    // 获取统计信息
    async getStatistics(dateRange = {}) {
        const { startDate, endDate } = dateRange;
        let whereConditions = [];
        let params = [];

        if (startDate) {
            whereConditions.push('call_time >= ?');
            params.push(startDate);
        }

        if (endDate) {
            whereConditions.push('call_time <= ?');
            params.push(endDate);
        }

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}` 
            : '';

        const sql = `
            SELECT 
                COUNT(*) as total_queries,
                SUM(CASE WHEN free_parking = 1 THEN 1 ELSE 0 END) as success_count,
                SUM(CASE WHEN free_parking = 0 THEN 1 ELSE 0 END) as failure_count,
                COUNT(DISTINCT plate_number) as unique_plates,
                DATE(call_time) as query_date
            FROM sam_records 
            ${whereClause}
            GROUP BY DATE(call_time)
            ORDER BY query_date DESC
        `;

        try {
            const stats = await this.query(sql, params);
            
            // 总体统计
            const totalSql = `
                SELECT 
                    COUNT(*) as total_queries,
                    SUM(CASE WHEN free_parking = 1 THEN 1 ELSE 0 END) as success_count,
                    SUM(CASE WHEN free_parking = 0 THEN 1 ELSE 0 END) as failure_count,
                    COUNT(DISTINCT plate_number) as unique_plates
                FROM sam_records 
                ${whereClause}
            `;

            const [totalStats] = await this.query(totalSql, params);

            return {
                summary: totalStats,
                daily: stats
            };
        } catch (error) {
            logger.error('获取统计信息失败', { dateRange, error: error.message });
            throw error;
        }
    }

    // 更新文件处理进度
    async updateProcessingLog(fileInfo) {
        const {
            fileName,
            filePath,
            lastPosition,
            totalRecords,
            processedRecords,
            status
        } = fileInfo;

        const sql = `
            INSERT OR REPLACE INTO processing_log 
            (file_name, file_path, last_position, total_records, processed_records, status, last_processed_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;

        const params = [fileName, filePath, lastPosition, totalRecords, processedRecords, status];

        try {
            const result = await this.run(sql, params);
            logger.debug('更新处理进度', { fileName, status });
            return result;
        } catch (error) {
            logger.error('更新处理进度失败', { fileName, error: error.message });
            throw error;
        }
    }

    // 获取处理进度
    async getProcessingLog() {
        const sql = `
            SELECT file_name, file_path, last_position, total_records, 
                   processed_records, status, last_processed_at
            FROM processing_log
            ORDER BY last_processed_at DESC
        `;

        try {
            return await this.query(sql);
        } catch (error) {
            logger.error('获取处理进度失败', { error: error.message });
            throw error;
        }
    }

    // 获取最后处理的时间点（用于增量处理）
    async getLastProcessingTime() {
        try {
            // 从处理日志中获取最后成功处理的时间
            const processingLogSql = `
                SELECT MAX(last_processed_at) as last_processing_time
                FROM processing_log 
                WHERE status = 'completed'
            `;
            
            // 从实际记录中获取最后的记录时间
            const recordsSql = `
                SELECT MAX(call_time) as last_record_time
                FROM sam_records
            `;

            const [processingResult] = await this.query(processingLogSql);
            const [recordsResult] = await this.query(recordsSql);

            const processingTime = processingResult?.last_processing_time;
            const recordTime = recordsResult?.last_record_time;

            // 🔧 修复：安全的时间解析和验证
            function parseAndValidateTime(timeStr) {
                if (!timeStr) return null;
                const date = new Date(timeStr);
                return isNaN(date.getTime()) ? null : date;
            }

            const processingDate = parseAndValidateTime(processingTime);
            const recordDate = parseAndValidateTime(recordTime);

            // 使用两者中较新的时间，如果都没有则返回昨天
            let lastTime = null;
            if (processingDate && recordDate) {
                lastTime = new Date(Math.max(processingDate.getTime(), recordDate.getTime()));
            } else if (processingDate) {
                lastTime = processingDate;
            } else if (recordDate) {
                lastTime = recordDate;
            } else {
                // 如果都没有记录，从昨天开始
                lastTime = new Date();
                lastTime.setDate(lastTime.getDate() - 1);
            }

            // 最终验证确保时间有效
            if (!lastTime || isNaN(lastTime.getTime())) {
                lastTime = new Date();
                lastTime.setDate(lastTime.getDate() - 1);
                logger.warn('时间解析失败，使用默认时间（昨天）', {
                    processingTime,
                    recordTime
                });
            }

            logger.info('获取最后处理时间', {
                processingTime,
                recordTime,
                selectedTime: lastTime.toISOString()
            });

            return {
                lastProcessingTime: processingTime,
                lastRecordTime: recordTime,
                selectedTime: lastTime.toISOString(),
                timeSource: processingDate && recordDate ? 'both' : 
                          processingDate ? 'processing' : 
                          recordDate ? 'records' : 'default'
            };

        } catch (error) {
            logger.error('获取最后处理时间失败', { error: error.message });
            
            // 🔧 修复：提供降级方案
            const fallbackTime = new Date();
            fallbackTime.setDate(fallbackTime.getDate() - 1);
            
            logger.warn('使用降级时间方案', { 
                fallbackTime: fallbackTime.toISOString(),
                originalError: error.message 
            });
            
            return {
                lastProcessingTime: null,
                lastRecordTime: null,
                selectedTime: fallbackTime.toISOString(),
                timeSource: 'fallback'
            };
        }
    }

    // 验证用户登录
    async validateUser(username, password) {
        const bcrypt = require('bcryptjs');
        
        const sql = 'SELECT id, username, password_hash FROM users WHERE username = ?';
        
        try {
            const users = await this.query(sql, [username]);
            
            if (users.length === 0) {
                return null;
            }

            const user = users[0];
            const isValid = await bcrypt.compare(password, user.password_hash);
            
            if (isValid) {
                return { id: user.id, username: user.username };
            } else {
                return null;
            }
        } catch (error) {
            logger.error('用户验证失败', { username, error: error.message });
            throw error;
        }
    }
}

module.exports = DatabaseService;
