/**
 * SQLite数据库初始化
 * 基于验证项目的数据结构设计
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

class DatabaseInitializer {
    constructor() {
        this.dbPath = path.join(__dirname, 'sam_logs.db');
        this.db = null;
    }

    async initialize() {
        try {
            logger.info('开始初始化数据库', { dbPath: this.dbPath });
            
            // 创建数据库连接
            this.db = new sqlite3.Database(this.dbPath);
            
            // 启用外键约束
            await this.runQuery('PRAGMA foreign_keys = ON');
            
            // 创建所有表
            await this.createTables();
            
            // 插入默认数据
            await this.insertDefaultData();
            
            logger.info('数据库初始化完成');
            
        } catch (error) {
            logger.error('数据库初始化失败', { error: error.message });
            throw error;
        } finally {
            if (this.db) {
                this.db.close();
            }
        }
    }

    async createTables() {
        logger.info('创建数据库表结构');

        // 1. 山姆接口记录表
        const samRecordsTable = `
            CREATE TABLE IF NOT EXISTS sam_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plate_number VARCHAR(20) NOT NULL,
                call_time TEXT NOT NULL,
                response_time TEXT,
                free_parking INTEGER DEFAULT 0,
                reject_reason TEXT,
                file_source VARCHAR(100),
                created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                UNIQUE(plate_number, call_time)
            )
        `;

        // 2. 用户表（扩展支持账号管理）
        const usersTable = `
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                real_name TEXT DEFAULT '',
                phone TEXT DEFAULT '',
                role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
                status INTEGER DEFAULT 1 CHECK (status IN (0, 1)),
                first_login INTEGER DEFAULT 1,
                last_login_at DATETIME,
                created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
            )
        `;

        // 3. 文件处理进度表
        const processingLogTable = `
            CREATE TABLE IF NOT EXISTS processing_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_name TEXT UNIQUE NOT NULL,
                file_path TEXT NOT NULL,
                last_position INTEGER DEFAULT 0,
                total_records INTEGER DEFAULT 0,
                processed_records INTEGER DEFAULT 0,
                last_processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'pending'
            )
        `;

        // 4. 用户操作审计表
        const auditLogTable = `
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                operator_id INTEGER NOT NULL,
                operator_username TEXT NOT NULL,
                target_user_id INTEGER,
                target_username TEXT,
                operation_type TEXT NOT NULL,
                operation_details TEXT,
                ip_address TEXT,
                user_agent TEXT,
                created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (operator_id) REFERENCES users(id)
            )
        `;

        // 5. 系统配置表
        const systemConfigTable = `
            CREATE TABLE IF NOT EXISTS system_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                config_key TEXT UNIQUE NOT NULL,
                config_value TEXT,
                description TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // 创建表
        await this.runQuery(samRecordsTable);
        await this.runQuery(usersTable);
        await this.runQuery(processingLogTable);
        await this.runQuery(auditLogTable);
        await this.runQuery(systemConfigTable);

        // 创建索引提高查询性能
        await this.createIndexes();

        logger.info('数据库表创建完成');
    }

    async createIndexes() {
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_sam_records_plate ON sam_records(plate_number)',
            'CREATE INDEX IF NOT EXISTS idx_sam_records_time ON sam_records(call_time)',
            'CREATE INDEX IF NOT EXISTS idx_sam_records_parking ON sam_records(free_parking)',
            'CREATE INDEX IF NOT EXISTS idx_processing_log_status ON processing_log(status)',
            'CREATE INDEX IF NOT EXISTS idx_processing_log_name ON processing_log(file_name)',
            'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
            'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
            'CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)',
            'CREATE INDEX IF NOT EXISTS idx_audit_log_operator ON audit_log(operator_id)',
            'CREATE INDEX IF NOT EXISTS idx_audit_log_target ON audit_log(target_user_id)',
            'CREATE INDEX IF NOT EXISTS idx_audit_log_time ON audit_log(created_at)'
        ];

        for (const indexSql of indexes) {
            await this.runQuery(indexSql);
        }

        logger.info('数据库索引创建完成');
    }

    async insertDefaultData() {
        logger.info('插入默认数据');

        // 创建默认管理员用户
        const adminPasswordHash = await bcrypt.hash('admin123', 10);
        const insertAdmin = `
            INSERT OR IGNORE INTO users (username, password_hash, real_name, role, first_login) 
            VALUES ('admin', ?, '系统管理员', 'admin', 0)
        `;
        await this.runQuery(insertAdmin, [adminPasswordHash]);

        // 插入系统配置
        const systemConfigs = [
            ['network_share_host', '10.21.189.125', '网络共享服务器地址'],
            ['network_share_path', '\\\\10.21.189.125\\Logs', '日志文件共享路径'],
            ['network_username', 'Administrator', '网络连接用户名'],
            ['sync_interval', '3600', '同步间隔（秒）'],
            ['max_records_per_page', '50', '每页最大记录数'],
            ['log_retention_days', '30', '日志保留天数']
        ];

        for (const [key, value, desc] of systemConfigs) {
            const insertConfig = `
                INSERT OR IGNORE INTO system_config (config_key, config_value, description) 
                VALUES (?, ?, ?)
            `;
            await this.runQuery(insertConfig, [key, value, desc]);
        }

        logger.info('默认数据插入完成');
    }

    runQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (params.length > 0) {
                this.db.run(sql, params, function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ lastID: this.lastID, changes: this.changes });
                    }
                });
            } else {
                this.db.run(sql, function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ lastID: this.lastID, changes: this.changes });
                    }
                });
            }
        });
    }

    // 获取数据库连接（用于其他模块）
    static getConnection() {
        const dbPath = path.join(__dirname, 'sam_logs.db');
        return new sqlite3.Database(dbPath);
    }

    // 验证数据库是否正常
    static async validateDatabase() {
        const db = DatabaseInitializer.getConnection();
        
        return new Promise((resolve, reject) => {
            db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='sam_records'", (err, row) => {
                db.close();
                if (err) {
                    reject(err);
                } else {
                    resolve(!!row);
                }
            });
        });
    }
}

// 如果直接运行此文件，执行初始化
if (require.main === module) {
    const initializer = new DatabaseInitializer();
    initializer.initialize()
        .then(() => {
            console.log('✅ 数据库初始化成功');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ 数据库初始化失败:', error.message);
            process.exit(1);
        });
}

module.exports = DatabaseInitializer;
