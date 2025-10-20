/**
 * 用户管理功能数据库迁移脚本
 * 升级现有的users表结构，添加账号管理需要的字段
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../utils/asyncLogger');

class UserManagementMigration {
    constructor() {
        this.dbPath = path.join(__dirname, 'sam_logs.db');
        this.db = null;
    }

    async migrate() {
        try {
            logger.info('开始用户管理功能数据库迁移', { dbPath: this.dbPath });
            
            this.db = new sqlite3.Database(this.dbPath);
            
            // 检查是否需要迁移
            const needsMigration = await this.needsMigration();
            if (!needsMigration) {
                logger.info('数据库已是最新版本，无需迁移');
                return;
            }

            // 备份原有users表
            await this.backupUsersTable();
            
            // 创建新的users表结构
            await this.createNewUsersTable();
            
            // 迁移现有数据
            await this.migrateExistingData();
            
            // 创建审计日志表
            await this.createAuditLogTable();
            
            // 创建新索引
            await this.createIndexes();
            
            // 删除备份表
            await this.cleanupBackup();
            
            logger.info('用户管理功能数据库迁移完成');
            
        } catch (error) {
            logger.error('数据库迁移失败', { error: error.message });
            // 尝试恢复备份
            await this.restoreBackup();
            throw error;
        } finally {
            if (this.db) {
                this.db.close();
            }
        }
    }

    async needsMigration() {
        return new Promise((resolve, reject) => {
            // 检查users表是否包含新字段
            this.db.all("PRAGMA table_info(users)", (err, columns) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                const hasRoleColumn = columns.some(col => col.name === 'role');
                const hasRealNameColumn = columns.some(col => col.name === 'real_name');
                
                // 如果没有role和real_name字段，说明需要迁移
                resolve(!hasRoleColumn || !hasRealNameColumn);
            });
        });
    }

    async backupUsersTable() {
        logger.info('备份原有users表');
        const sql = `
            CREATE TABLE IF NOT EXISTS users_backup AS 
            SELECT * FROM users
        `;
        await this.runQuery(sql);
    }

    async createNewUsersTable() {
        logger.info('创建新的users表结构');
        
        // 先删除原表
        await this.runQuery('DROP TABLE IF EXISTS users_temp');
        
        // 创建新表结构
        const createTableSql = `
            CREATE TABLE users_temp (
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
        await this.runQuery(createTableSql);
    }

    async migrateExistingData() {
        logger.info('迁移现有用户数据');
        
        // 从备份表迁移数据到新表
        const migrateSql = `
            INSERT INTO users_temp (id, username, password_hash, role, first_login, created_at, updated_at)
            SELECT 
                id, 
                username, 
                password_hash, 
                CASE 
                    WHEN username = 'admin' THEN 'admin' 
                    ELSE 'user' 
                END as role,
                CASE 
                    WHEN username = 'admin' THEN 0 
                    ELSE 1 
                END as first_login,
                COALESCE(created_at, datetime('now', 'localtime')),
                datetime('now', 'localtime')
            FROM users_backup
        `;
        await this.runQuery(migrateSql);
        
        // 删除原表并重命名新表
        await this.runQuery('DROP TABLE users');
        await this.runQuery('ALTER TABLE users_temp RENAME TO users');
        
        logger.info('用户数据迁移完成');
    }

    async createAuditLogTable() {
        logger.info('创建审计日志表');
        
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
        await this.runQuery(auditLogTable);
    }

    async createIndexes() {
        logger.info('创建索引');
        
        const indexes = [
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
    }

    async cleanupBackup() {
        logger.info('清理备份表');
        await this.runQuery('DROP TABLE IF EXISTS users_backup');
    }

    async restoreBackup() {
        try {
            logger.warn('尝试从备份恢复数据');
            await this.runQuery('DROP TABLE IF EXISTS users');
            await this.runQuery('ALTER TABLE users_backup RENAME TO users');
            logger.info('数据库恢复成功');
        } catch (error) {
            logger.error('数据库恢复失败', { error: error.message });
        }
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

    // 静态方法：检查是否需要迁移
    static async checkMigrationNeeded() {
        const migration = new UserManagementMigration();
        try {
            migration.db = new sqlite3.Database(migration.dbPath);
            return await migration.needsMigration();
        } catch (error) {
            return false;
        } finally {
            if (migration.db) {
                migration.db.close();
            }
        }
    }
}

// 如果直接运行此文件，执行迁移
if (require.main === module) {
    const migration = new UserManagementMigration();
    migration.migrate()
        .then(() => {
            console.log('✅ 用户管理功能数据库迁移成功');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ 数据库迁移失败:', error.message);
            process.exit(1);
        });
}

module.exports = UserManagementMigration;
