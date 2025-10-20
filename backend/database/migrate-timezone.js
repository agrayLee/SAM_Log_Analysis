/**
 * 数据库时区迁移脚本
 * 修复created_at字段的时区问题
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class TimezoneMigration {
    constructor() {
        this.dbPath = path.join(__dirname, 'sam_logs.db');
    }

    async migrate() {
        return new Promise((resolve, reject) => {
            console.log('开始数据库时区迁移...');
            
            const db = new sqlite3.Database(this.dbPath);
            
            db.serialize(() => {
                // 开始事务
                db.run('BEGIN TRANSACTION');
                
                console.log('1. 创建临时表...');
                // 创建带有正确时区设置的新表
                db.run(`
                    CREATE TABLE sam_records_new (
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
                `, (err) => {
                    if (err) {
                        console.error('创建临时表失败:', err);
                        db.run('ROLLBACK');
                        reject(err);
                        return;
                    }
                });
                
                console.log('2. 复制数据并调整时区...');
                // 复制数据，将UTC时间转换为本地时间（+8小时）
                db.run(`
                    INSERT INTO sam_records_new 
                    (id, plate_number, call_time, response_time, free_parking, reject_reason, file_source, created_at)
                    SELECT 
                        id, 
                        plate_number, 
                        call_time, 
                        response_time, 
                        free_parking, 
                        reject_reason, 
                        file_source,
                        datetime(created_at, '+8 hours') as created_at
                    FROM sam_records
                `, (err) => {
                    if (err) {
                        console.error('数据复制失败:', err);
                        db.run('ROLLBACK');
                        reject(err);
                        return;
                    }
                });
                
                console.log('3. 替换原表...');
                // 删除原表
                db.run('DROP TABLE sam_records', (err) => {
                    if (err) {
                        console.error('删除原表失败:', err);
                        db.run('ROLLBACK');
                        reject(err);
                        return;
                    }
                });
                
                // 重命名新表
                db.run('ALTER TABLE sam_records_new RENAME TO sam_records', (err) => {
                    if (err) {
                        console.error('重命名表失败:', err);
                        db.run('ROLLBACK');
                        reject(err);
                        return;
                    }
                });
                
                console.log('4. 重建索引...');
                // 重建索引
                const indexes = [
                    'CREATE INDEX IF NOT EXISTS idx_sam_records_plate ON sam_records(plate_number)',
                    'CREATE INDEX IF NOT EXISTS idx_sam_records_time ON sam_records(call_time)',
                    'CREATE INDEX IF NOT EXISTS idx_sam_records_parking ON sam_records(free_parking)'
                ];
                
                let indexCount = 0;
                indexes.forEach((indexSql) => {
                    db.run(indexSql, (err) => {
                        if (err) {
                            console.error('创建索引失败:', err);
                            db.run('ROLLBACK');
                            reject(err);
                            return;
                        }
                        
                        indexCount++;
                        if (indexCount === indexes.length) {
                            // 提交事务
                            db.run('COMMIT', (err) => {
                                if (err) {
                                    console.error('提交事务失败:', err);
                                    reject(err);
                                } else {
                                    console.log('数据库时区迁移完成！');
                                    db.close();
                                    resolve();
                                }
                            });
                        }
                    });
                });
            });
        });
    }

    // 检查是否需要迁移
    async needsMigration() {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.dbPath);
            
            // 检查表结构中created_at的默认值
            db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='sam_records'", (err, row) => {
                db.close();
                
                if (err) {
                    reject(err);
                    return;
                }
                
                if (!row) {
                    resolve(false); // 表不存在，不需要迁移
                    return;
                }
                
                // 检查是否包含localtime设置
                const needsUpdate = !row.sql.includes('localtime');
                resolve(needsUpdate);
            });
        });
    }
}

// 如果直接运行此文件，执行迁移
if (require.main === module) {
    const migration = new TimezoneMigration();
    
    migration.needsMigration()
        .then((needs) => {
            if (needs) {
                console.log('检测到需要进行时区迁移');
                return migration.migrate();
            } else {
                console.log('数据库已经是最新版本，无需迁移');
            }
        })
        .then(() => {
            console.log('迁移完成');
            process.exit(0);
        })
        .catch((error) => {
            console.error('迁移失败:', error);
            process.exit(1);
        });
}

module.exports = TimezoneMigration;
