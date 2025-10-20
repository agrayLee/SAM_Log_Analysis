/**
 * 数据库连接池管理
 * 优化数据库连接性能，避免频繁创建和销毁连接
 */

const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const config = require('../config/config');
const logger = require('../utils/logger');

class DatabasePool {
    constructor() {
        this.dbPath = config.database.path;
        this.pool = [];
        this.maxConnections = config.database.connectionLimit;
        this.activeConnections = 0;
        this.waitingQueue = [];
        this.initialized = false;
    }

    /**
     * 初始化连接池
     */
    async initialize() {
        if (this.initialized) return;

        try {
            logger.info('初始化数据库连接池', {
                dbPath: this.dbPath,
                maxConnections: this.maxConnections
            });

            // 创建初始连接
            for (let i = 0; i < Math.min(3, this.maxConnections); i++) {
                const db = await this.createConnection();
                this.pool.push(db);
            }

            this.initialized = true;
            logger.info('数据库连接池初始化完成', {
                poolSize: this.pool.length
            });

        } catch (error) {
            logger.error('数据库连接池初始化失败', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * 创建新的数据库连接
     */
    async createConnection() {
        try {
            const db = await open({
                filename: this.dbPath,
                driver: sqlite3.Database
            });

            // 启用WAL模式提高并发性能
            if (config.database.enableWAL) {
                await db.exec('PRAGMA journal_mode = WAL');
            }

            // 设置其他优化参数
            await db.exec('PRAGMA foreign_keys = ON');
            await db.exec('PRAGMA synchronous = NORMAL');
            await db.exec('PRAGMA cache_size = 10000');
            await db.exec('PRAGMA temp_store = MEMORY');

            // 设置查询超时
            await db.exec(`PRAGMA busy_timeout = ${config.database.queryTimeout}`);

            return db;

        } catch (error) {
            logger.error('创建数据库连接失败', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * 获取数据库连接
     */
    async getConnection() {
        if (!this.initialized) {
            await this.initialize();
        }

        // 如果有空闲连接，直接返回
        if (this.pool.length > 0) {
            const db = this.pool.pop();
            this.activeConnections++;
            return db;
        }

        // 如果未达到最大连接数，创建新连接
        if (this.activeConnections < this.maxConnections) {
            const db = await this.createConnection();
            this.activeConnections++;
            return db;
        }

        // 如果达到最大连接数，等待连接释放
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                const index = this.waitingQueue.indexOf(resolver);
                if (index > -1) {
                    this.waitingQueue.splice(index, 1);
                }
                reject(new Error('获取数据库连接超时'));
            }, config.database.queryTimeout);

            const resolver = {
                resolve: (db) => {
                    clearTimeout(timeout);
                    resolve(db);
                },
                reject
            };

            this.waitingQueue.push(resolver);
        });
    }

    /**
     * 释放数据库连接
     */
    releaseConnection(db) {
        if (!db) return;

        this.activeConnections--;

        // 如果有等待的请求，直接分配
        if (this.waitingQueue.length > 0) {
            const waiter = this.waitingQueue.shift();
            this.activeConnections++;
            waiter.resolve(db);
            return;
        }

        // 否则放回连接池
        this.pool.push(db);
    }

    /**
     * 执行查询（自动管理连接）
     */
    async query(sql, params = []) {
        const db = await this.getConnection();
        
        try {
            const result = await db.all(sql, params);
            return result;
        } catch (error) {
            logger.error('数据库查询错误', {
                sql,
                params,
                error: error.message
            });
            throw error;
        } finally {
            this.releaseConnection(db);
        }
    }

    /**
     * 执行更新（自动管理连接）
     */
    async run(sql, params = []) {
        const db = await this.getConnection();
        
        try {
            const result = await db.run(sql, params);
            return result;
        } catch (error) {
            logger.error('数据库执行错误', {
                sql,
                params,
                error: error.message
            });
            throw error;
        } finally {
            this.releaseConnection(db);
        }
    }

    /**
     * 执行事务
     */
    async transaction(callback) {
        const db = await this.getConnection();
        
        try {
            await db.exec('BEGIN TRANSACTION');
            
            try {
                const result = await callback(db);
                await db.exec('COMMIT');
                return result;
            } catch (error) {
                await db.exec('ROLLBACK');
                throw error;
            }
            
        } finally {
            this.releaseConnection(db);
        }
    }

    /**
     * 批量插入（优化性能）
     */
    async batchInsert(table, columns, values) {
        if (!values || values.length === 0) {
            return { inserted: 0 };
        }

        const placeholders = columns.map(() => '?').join(',');
        const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`;

        return await this.transaction(async (db) => {
            const stmt = await db.prepare(sql);
            
            let inserted = 0;
            for (const row of values) {
                try {
                    await stmt.run(...row);
                    inserted++;
                } catch (error) {
                    logger.error('批量插入记录失败', {
                        table,
                        error: error.message
                    });
                }
            }
            
            await stmt.finalize();
            return { inserted };
        });
    }

    /**
     * 获取连接池状态
     */
    getStatus() {
        return {
            initialized: this.initialized,
            maxConnections: this.maxConnections,
            activeConnections: this.activeConnections,
            idleConnections: this.pool.length,
            waitingRequests: this.waitingQueue.length
        };
    }

    /**
     * 关闭所有连接
     */
    async close() {
        logger.info('关闭数据库连接池');

        // 等待所有活动连接完成
        while (this.activeConnections > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // 关闭所有空闲连接
        for (const db of this.pool) {
            await db.close();
        }

        this.pool = [];
        this.initialized = false;
        this.activeConnections = 0;
        this.waitingQueue = [];

        logger.info('数据库连接池已关闭');
    }
}

// 创建单例
const databasePool = new DatabasePool();

module.exports = databasePool;
