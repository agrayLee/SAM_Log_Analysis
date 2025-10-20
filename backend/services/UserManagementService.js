/**
 * 用户管理服务
 * 提供用户CRUD操作、密码管理、权限验证等功能
 */

const bcrypt = require('bcryptjs');
const logger = require('../utils/asyncLogger');
const databasePool = require('./DatabasePool');

class UserManagementService {
    constructor() {
        this.saltRounds = 10;
    }

    /**
     * 获取所有用户列表（仅admin权限）
     */
    async getAllUsers(options = {}) {
        const {
            page = 1,
            limit = 20,
            search = '',
            role = '',
            status = ''
        } = options;

        const offset = (page - 1) * limit;
        let whereConditions = [];
        let params = [];

        // 构建查询条件
        if (search) {
            whereConditions.push('(username LIKE ? OR real_name LIKE ? OR phone LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (role && role !== 'all') {
            whereConditions.push('role = ?');
            params.push(role);
        }

        if (status !== '' && status !== 'all') {
            whereConditions.push('status = ?');
            params.push(parseInt(status));
        }

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}` 
            : '';

        try {
            const db = await databasePool.getConnection();

            // 查询用户列表
            const usersSql = `
                SELECT id, username, real_name, phone, role, status, 
                       first_login, last_login_at, created_at, updated_at
                FROM users 
                ${whereClause}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `;

            // 查询总数
            const countSql = `
                SELECT COUNT(*) as total 
                FROM users 
                ${whereClause}
            `;

            const [users, countResult] = await Promise.all([
                this.query(db, usersSql, [...params, limit, offset]),
                this.query(db, countSql, params)
            ]);

            databasePool.releaseConnection(db);

            const total = countResult[0]?.total || 0;

            return {
                users: users.map(user => ({
                    ...user,
                    status: user.status === 1,
                    first_login: user.first_login === 1
                })),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            logger.error('获取用户列表失败', { error: error.message, options });
            throw error;
        }
    }

    /**
     * 根据ID获取用户信息
     */
    async getUserById(userId) {
        try {
            const db = await databasePool.getConnection();
            const sql = `
                SELECT id, username, real_name, phone, role, status, 
                       first_login, last_login_at, created_at, updated_at
                FROM users 
                WHERE id = ?
            `;

            const users = await this.query(db, sql, [userId]);
            databasePool.releaseConnection(db);

            if (users.length === 0) {
                return null;
            }

            const user = users[0];
            return {
                ...user,
                status: user.status === 1,
                first_login: user.first_login === 1
            };
        } catch (error) {
            logger.error('获取用户信息失败', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * 创建新用户（仅admin权限）
     */
    async createUser(userData, operatorInfo) {
        const { username, realName, phone, role = 'user' } = userData;

        // 输入验证
        if (!username || username.length < 3) {
            throw new Error('用户名不能为空且长度不能少于3位');
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            throw new Error('用户名只能包含字母、数字和下划线');
        }

        if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
            throw new Error('手机号格式不正确');
        }

        if (!['admin', 'user'].includes(role)) {
            throw new Error('无效的用户角色');
        }

        try {
            const db = await databasePool.getConnection();

            // 检查用户名是否已存在
            const existingUsers = await this.query(db, 'SELECT id FROM users WHERE username = ?', [username]);
            if (existingUsers.length > 0) {
                databasePool.releaseConnection(db);
                throw new Error('用户名已存在');
            }

            // 生成默认密码hash
            const defaultPassword = '123456';
            const passwordHash = await bcrypt.hash(defaultPassword, this.saltRounds);

            // 插入新用户
            const insertSql = `
                INSERT INTO users (username, password_hash, real_name, phone, role, status, first_login, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 1, 1, datetime('now', 'localtime'), datetime('now', 'localtime'))
            `;

            const result = await this.run(db, insertSql, [
                username,
                passwordHash,
                realName || '',
                phone || '',
                role
            ]);

            databasePool.releaseConnection(db);

            // 记录审计日志
            await this.logAuditOperation({
                operatorId: operatorInfo.id,
                operatorUsername: operatorInfo.username,
                targetUserId: result.lastID,
                targetUsername: username,
                operationType: 'CREATE_USER',
                operationDetails: JSON.stringify({
                    username,
                    realName,
                    phone,
                    role,
                    defaultPassword: defaultPassword
                }),
                ipAddress: operatorInfo.ip,
                userAgent: operatorInfo.userAgent
            });

            logger.info('创建用户成功', {
                operatorId: operatorInfo.id,
                newUserId: result.lastID,
                username,
                role
            });

            return {
                id: result.lastID,
                username,
                realName,
                phone,
                role,
                status: true,
                firstLogin: true,
                defaultPassword
            };
        } catch (error) {
            logger.error('创建用户失败', { error: error.message, userData });
            throw error;
        }
    }

    /**
     * 更新用户信息（仅admin权限或用户本人）
     */
    async updateUser(userId, updateData, operatorInfo) {
        const { realName, phone, role, status } = updateData;

        try {
            const db = await databasePool.getConnection();

            // 获取原用户信息
            const originalUser = await this.getUserById(userId);
            if (!originalUser) {
                databasePool.releaseConnection(db);
                throw new Error('用户不存在');
            }

            // 权限检查：admin可以修改所有用户，普通用户只能修改自己
            if (operatorInfo.role !== 'admin' && operatorInfo.id !== userId) {
                databasePool.releaseConnection(db);
                throw new Error('权限不足，无法修改其他用户信息');
            }

            // 构建更新字段
            let updateFields = [];
            let params = [];

            if (realName !== undefined) {
                updateFields.push('real_name = ?');
                params.push(realName);
            }

            if (phone !== undefined) {
                if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
                    databasePool.releaseConnection(db);
                    throw new Error('手机号格式不正确');
                }
                updateFields.push('phone = ?');
                params.push(phone);
            }

            // 只有admin可以修改角色和状态
            if (operatorInfo.role === 'admin') {
                if (role !== undefined && ['admin', 'user'].includes(role)) {
                    // 防止admin删除自己的admin权限
                    if (operatorInfo.id === userId && role !== 'admin') {
                        databasePool.releaseConnection(db);
                        throw new Error('不能移除自己的管理员权限');
                    }
                    updateFields.push('role = ?');
                    params.push(role);
                }

                if (status !== undefined) {
                    // 防止admin禁用自己的账号
                    if (operatorInfo.id === userId && !status) {
                        databasePool.releaseConnection(db);
                        throw new Error('不能禁用自己的账号');
                    }
                    updateFields.push('status = ?');
                    params.push(status ? 1 : 0);
                }
            }

            if (updateFields.length === 0) {
                databasePool.releaseConnection(db);
                throw new Error('没有可更新的字段');
            }

            // 更新用户信息
            updateFields.push('updated_at = datetime(\'now\', \'localtime\')');
            params.push(userId);

            const updateSql = `
                UPDATE users 
                SET ${updateFields.join(', ')}
                WHERE id = ?
            `;

            await this.run(db, updateSql, params);
            databasePool.releaseConnection(db);

            // 记录审计日志
            await this.logAuditOperation({
                operatorId: operatorInfo.id,
                operatorUsername: operatorInfo.username,
                targetUserId: userId,
                targetUsername: originalUser.username,
                operationType: 'UPDATE_USER',
                operationDetails: JSON.stringify({
                    originalData: originalUser,
                    updateData,
                    updatedFields: updateFields.filter(f => f !== 'updated_at = datetime(\'now\', \'localtime\')')
                }),
                ipAddress: operatorInfo.ip,
                userAgent: operatorInfo.userAgent
            });

            logger.info('更新用户信息成功', {
                operatorId: operatorInfo.id,
                targetUserId: userId,
                updateFields
            });

            return await this.getUserById(userId);
        } catch (error) {
            logger.error('更新用户信息失败', { error: error.message, userId, updateData });
            throw error;
        }
    }

    /**
     * 删除用户（仅admin权限）
     */
    async deleteUser(userId, operatorInfo) {
        try {
            const db = await databasePool.getConnection();

            // 获取要删除的用户信息
            const targetUser = await this.getUserById(userId);
            if (!targetUser) {
                databasePool.releaseConnection(db);
                throw new Error('用户不存在');
            }

            // 防止admin删除自己
            if (operatorInfo.id === userId) {
                databasePool.releaseConnection(db);
                throw new Error('不能删除自己的账号');
            }

            // 确保系统至少保留一个admin
            if (targetUser.role === 'admin') {
                const adminCount = await this.query(db, 'SELECT COUNT(*) as count FROM users WHERE role = "admin"', []);
                if (adminCount[0].count <= 1) {
                    databasePool.releaseConnection(db);
                    throw new Error('系统必须至少保留一个管理员账号');
                }
            }

            // 删除用户
            await this.run(db, 'DELETE FROM users WHERE id = ?', [userId]);
            databasePool.releaseConnection(db);

            // 记录审计日志
            await this.logAuditOperation({
                operatorId: operatorInfo.id,
                operatorUsername: operatorInfo.username,
                targetUserId: userId,
                targetUsername: targetUser.username,
                operationType: 'DELETE_USER',
                operationDetails: JSON.stringify({
                    deletedUser: targetUser
                }),
                ipAddress: operatorInfo.ip,
                userAgent: operatorInfo.userAgent
            });

            logger.info('删除用户成功', {
                operatorId: operatorInfo.id,
                deletedUserId: userId,
                deletedUsername: targetUser.username
            });

            return true;
        } catch (error) {
            logger.error('删除用户失败', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * 重置用户密码（仅admin权限）
     */
    async resetPassword(userId, operatorInfo) {
        const defaultPassword = '123456';

        try {
            const db = await databasePool.getConnection();

            // 获取目标用户信息
            const targetUser = await this.getUserById(userId);
            if (!targetUser) {
                databasePool.releaseConnection(db);
                throw new Error('用户不存在');
            }

            // 生成新密码hash
            const passwordHash = await bcrypt.hash(defaultPassword, this.saltRounds);

            // 更新密码并设置首次登录标志
            const updateSql = `
                UPDATE users 
                SET password_hash = ?, first_login = 1, updated_at = datetime('now', 'localtime')
                WHERE id = ?
            `;

            await this.run(db, updateSql, [passwordHash, userId]);
            databasePool.releaseConnection(db);

            // 记录审计日志
            await this.logAuditOperation({
                operatorId: operatorInfo.id,
                operatorUsername: operatorInfo.username,
                targetUserId: userId,
                targetUsername: targetUser.username,
                operationType: 'RESET_PASSWORD',
                operationDetails: JSON.stringify({
                    newPassword: defaultPassword
                }),
                ipAddress: operatorInfo.ip,
                userAgent: operatorInfo.userAgent
            });

            logger.info('重置密码成功', {
                operatorId: operatorInfo.id,
                targetUserId: userId,
                targetUsername: targetUser.username
            });

            return { defaultPassword };
        } catch (error) {
            logger.error('重置密码失败', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * 修改密码（用户本人或admin）
     */
    async changePassword(userId, passwordData, operatorInfo) {
        const { currentPassword, newPassword } = passwordData;

        // 密码强度验证
        if (!newPassword || newPassword.length < 6) {
            throw new Error('新密码长度不能少于6位');
        }

        if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]/.test(newPassword)) {
            throw new Error('新密码必须包含至少一个字母和一个数字');
        }

        try {
            const db = await databasePool.getConnection();

            // 获取用户当前密码
            const users = await this.query(db, 'SELECT password_hash, username FROM users WHERE id = ?', [userId]);
            if (users.length === 0) {
                databasePool.releaseConnection(db);
                throw new Error('用户不存在');
            }

            const user = users[0];

            // 权限检查：只有用户本人或admin可以修改密码
            if (operatorInfo.id !== userId && operatorInfo.role !== 'admin') {
                databasePool.releaseConnection(db);
                throw new Error('权限不足，无法修改其他用户密码');
            }

            // 如果是用户本人修改密码，需要验证当前密码
            if (operatorInfo.id === userId) {
                const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
                if (!isCurrentPasswordValid) {
                    databasePool.releaseConnection(db);
                    throw new Error('当前密码错误');
                }
            }

            // 生成新密码hash
            const newPasswordHash = await bcrypt.hash(newPassword, this.saltRounds);

            // 更新密码并重置首次登录标志
            const updateSql = `
                UPDATE users 
                SET password_hash = ?, first_login = 0, updated_at = datetime('now', 'localtime')
                WHERE id = ?
            `;

            await this.run(db, updateSql, [newPasswordHash, userId]);
            databasePool.releaseConnection(db);

            // 记录审计日志
            await this.logAuditOperation({
                operatorId: operatorInfo.id,
                operatorUsername: operatorInfo.username,
                targetUserId: userId,
                targetUsername: user.username,
                operationType: 'CHANGE_PASSWORD',
                operationDetails: JSON.stringify({
                    isOwnPassword: operatorInfo.id === userId
                }),
                ipAddress: operatorInfo.ip,
                userAgent: operatorInfo.userAgent
            });

            logger.info('修改密码成功', {
                operatorId: operatorInfo.id,
                targetUserId: userId,
                isOwnPassword: operatorInfo.id === userId
            });

            return true;
        } catch (error) {
            logger.error('修改密码失败', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * 用户登录时更新最后登录时间
     */
    async updateLastLogin(userId) {
        try {
            const db = await databasePool.getConnection();
            const sql = `
                UPDATE users 
                SET last_login_at = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime')
                WHERE id = ?
            `;
            await this.run(db, sql, [userId]);
            databasePool.releaseConnection(db);
        } catch (error) {
            logger.error('更新最后登录时间失败', { error: error.message, userId });
        }
    }

    /**
     * 记录审计日志
     */
    async logAuditOperation(auditData) {
        const {
            operatorId,
            operatorUsername,
            targetUserId,
            targetUsername,
            operationType,
            operationDetails,
            ipAddress,
            userAgent
        } = auditData;

        try {
            const db = await databasePool.getConnection();
            const sql = `
                INSERT INTO audit_log (
                    operator_id, operator_username, target_user_id, target_username,
                    operation_type, operation_details, ip_address, user_agent
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            await this.run(db, sql, [
                operatorId,
                operatorUsername,
                targetUserId,
                targetUsername,
                operationType,
                operationDetails,
                ipAddress,
                userAgent
            ]);

            databasePool.releaseConnection(db);

            logger.info('审计日志记录成功', {
                operatorId,
                operationType,
                targetUserId
            });
        } catch (error) {
            logger.error('记录审计日志失败', { error: error.message, auditData });
        }
    }

    /**
     * 获取审计日志
     */
    async getAuditLogs(options = {}) {
        const {
            page = 1,
            limit = 50,
            operatorId,
            targetUserId,
            operationType,
            startDate,
            endDate
        } = options;

        const offset = (page - 1) * limit;
        let whereConditions = [];
        let params = [];

        if (operatorId) {
            whereConditions.push('operator_id = ?');
            params.push(operatorId);
        }

        if (targetUserId) {
            whereConditions.push('target_user_id = ?');
            params.push(targetUserId);
        }

        if (operationType) {
            whereConditions.push('operation_type = ?');
            params.push(operationType);
        }

        if (startDate) {
            whereConditions.push('created_at >= ?');
            params.push(startDate);
        }

        if (endDate) {
            whereConditions.push('created_at <= ?');
            params.push(endDate);
        }

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}` 
            : '';

        try {
            const db = await databasePool.getConnection();

            // 查询审计日志
            const logsSql = `
                SELECT id, operator_id, operator_username, target_user_id, target_username,
                       operation_type, operation_details, ip_address, user_agent, created_at
                FROM audit_log 
                ${whereClause}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `;

            // 查询总数
            const countSql = `
                SELECT COUNT(*) as total 
                FROM audit_log 
                ${whereClause}
            `;

            const [logs, countResult] = await Promise.all([
                this.query(db, logsSql, [...params, limit, offset]),
                this.query(db, countSql, params)
            ]);

            databasePool.releaseConnection(db);

            const total = countResult[0]?.total || 0;

            return {
                logs: logs.map(log => ({
                    ...log,
                    operation_details: this.safeParseJSON(log.operation_details)
                })),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            logger.error('获取审计日志失败', { error: error.message, options });
            throw error;
        }
    }

    // 工具方法
    safeParseJSON(jsonString) {
        try {
            return JSON.parse(jsonString);
        } catch {
            return jsonString;
        }
    }

    query(db, sql, params = []) {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    run(db, sql, params = []) {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }
}

module.exports = new UserManagementService();
