/**
 * 用户管理路由
 * 提供用户CRUD操作、密码管理、权限控制等API
 */

const express = require('express');
const router = express.Router();
const UserManagementService = require('../services/UserManagementService');
const { 
    requireAdmin, 
    requireSelfOrAdmin, 
    getOperatorInfo 
} = require('../middleware/auth');
const logger = require('../utils/asyncLogger');

// 输入验证工具
const validateUserInput = (req, res, next) => {
    const { body } = req;
    
    // 验证用户名
    if (body.username !== undefined) {
        if (!body.username || body.username.length < 3) {
            return res.status(400).json({
                success: false,
                message: '用户名不能为空且长度不能少于3位',
                code: 'INVALID_USERNAME'
            });
        }
        
        if (!/^[a-zA-Z0-9_]+$/.test(body.username)) {
            return res.status(400).json({
                success: false,
                message: '用户名只能包含字母、数字和下划线',
                code: 'INVALID_USERNAME_FORMAT'
            });
        }
    }
    
    // 验证手机号
    if (body.phone !== undefined && body.phone && !/^1[3-9]\d{9}$/.test(body.phone)) {
        return res.status(400).json({
            success: false,
            message: '手机号格式不正确',
            code: 'INVALID_PHONE'
        });
    }
    
    // 验证角色
    if (body.role !== undefined && !['admin', 'user'].includes(body.role)) {
        return res.status(400).json({
            success: false,
            message: '无效的用户角色',
            code: 'INVALID_ROLE'
        });
    }
    
    next();
};

// 获取用户列表（仅管理员）
router.get('/', requireAdmin, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search = '',
            role = '',
            status = ''
        } = req.query;

        const options = {
            page: parseInt(page),
            limit: Math.min(parseInt(limit), 100), // 限制最大每页数量
            search: search.trim(),
            role,
            status
        };

        const result = await UserManagementService.getAllUsers(options);

        res.json({
            success: true,
            message: '获取用户列表成功',
            data: result
        });

    } catch (error) {
        logger.error('获取用户列表失败', {
            error: error.message,
            operatorId: req.user.id,
            query: req.query
        });

        res.status(500).json({
            success: false,
            message: '获取用户列表失败',
            code: 'GET_USERS_ERROR'
        });
    }
});

// 获取指定用户信息（管理员或用户本人）
router.get('/:id', requireSelfOrAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: '无效的用户ID',
                code: 'INVALID_USER_ID'
            });
        }

        const user = await UserManagementService.getUserById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在',
                code: 'USER_NOT_FOUND'
            });
        }

        res.json({
            success: true,
            message: '获取用户信息成功',
            data: { user }
        });

    } catch (error) {
        logger.error('获取用户信息失败', {
            error: error.message,
            operatorId: req.user.id,
            targetUserId: req.params.id
        });

        res.status(500).json({
            success: false,
            message: '获取用户信息失败',
            code: 'GET_USER_ERROR'
        });
    }
});

// 创建新用户（仅管理员）
router.post('/', requireAdmin, validateUserInput, async (req, res) => {
    try {
        const { username, realName, phone, role = 'user' } = req.body;

        const userData = {
            username: username.trim(),
            realName: realName?.trim() || '',
            phone: phone?.trim() || '',
            role
        };

        const operatorInfo = getOperatorInfo(req);
        const newUser = await UserManagementService.createUser(userData, operatorInfo);

        res.status(201).json({
            success: true,
            message: '创建用户成功',
            data: {
                user: newUser,
                defaultPassword: newUser.defaultPassword
            }
        });

    } catch (error) {
        logger.error('创建用户失败', {
            error: error.message,
            operatorId: req.user.id,
            userData: req.body
        });

        // 根据错误类型返回适当的状态码
        const statusCode = error.message.includes('已存在') ? 409 : 400;

        res.status(statusCode).json({
            success: false,
            message: error.message,
            code: 'CREATE_USER_ERROR'
        });
    }
});

// 更新用户信息（管理员或用户本人）
router.put('/:id', requireSelfOrAdmin, validateUserInput, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: '无效的用户ID',
                code: 'INVALID_USER_ID'
            });
        }

        const { realName, phone, role, status } = req.body;

        const updateData = {};
        if (realName !== undefined) updateData.realName = realName?.trim() || '';
        if (phone !== undefined) updateData.phone = phone?.trim() || '';
        if (role !== undefined) updateData.role = role;
        if (status !== undefined) updateData.status = status;

        const operatorInfo = getOperatorInfo(req);
        const updatedUser = await UserManagementService.updateUser(userId, updateData, operatorInfo);

        res.json({
            success: true,
            message: '更新用户信息成功',
            data: { user: updatedUser }
        });

    } catch (error) {
        logger.error('更新用户信息失败', {
            error: error.message,
            operatorId: req.user.id,
            targetUserId: req.params.id,
            updateData: req.body
        });

        const statusCode = error.message.includes('权限不足') ? 403 : 400;

        res.status(statusCode).json({
            success: false,
            message: error.message,
            code: 'UPDATE_USER_ERROR'
        });
    }
});

// 删除用户（仅管理员）
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: '无效的用户ID',
                code: 'INVALID_USER_ID'
            });
        }

        const operatorInfo = getOperatorInfo(req);
        await UserManagementService.deleteUser(userId, operatorInfo);

        res.json({
            success: true,
            message: '删除用户成功'
        });

    } catch (error) {
        logger.error('删除用户失败', {
            error: error.message,
            operatorId: req.user.id,
            targetUserId: req.params.id
        });

        const statusCode = error.message.includes('不能删除') ? 403 : 400;

        res.status(statusCode).json({
            success: false,
            message: error.message,
            code: 'DELETE_USER_ERROR'
        });
    }
});

// 重置用户密码（仅管理员）
router.post('/:id/reset-password', requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: '无效的用户ID',
                code: 'INVALID_USER_ID'
            });
        }

        const operatorInfo = getOperatorInfo(req);
        const result = await UserManagementService.resetPassword(userId, operatorInfo);

        res.json({
            success: true,
            message: '重置密码成功',
            data: {
                defaultPassword: result.defaultPassword
            }
        });

    } catch (error) {
        logger.error('重置密码失败', {
            error: error.message,
            operatorId: req.user.id,
            targetUserId: req.params.id
        });

        res.status(400).json({
            success: false,
            message: error.message,
            code: 'RESET_PASSWORD_ERROR'
        });
    }
});

// 修改密码（管理员或用户本人）
router.post('/:id/change-password', requireSelfOrAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: '无效的用户ID',
                code: 'INVALID_USER_ID'
            });
        }

        const { currentPassword, newPassword } = req.body;

        // 输入验证
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: '新密码长度不能少于6位',
                code: 'WEAK_PASSWORD'
            });
        }

        if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]/.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: '新密码必须包含至少一个字母和一个数字',
                code: 'WEAK_PASSWORD_FORMAT'
            });
        }

        // 如果是用户本人修改密码，必须提供当前密码
        if (req.user.id === userId && !currentPassword) {
            return res.status(400).json({
                success: false,
                message: '请提供当前密码',
                code: 'CURRENT_PASSWORD_REQUIRED'
            });
        }

        const passwordData = { currentPassword, newPassword };
        const operatorInfo = getOperatorInfo(req);
        
        await UserManagementService.changePassword(userId, passwordData, operatorInfo);

        res.json({
            success: true,
            message: '修改密码成功'
        });

    } catch (error) {
        logger.error('修改密码失败', {
            error: error.message,
            operatorId: req.user.id,
            targetUserId: req.params.id
        });

        const statusCode = error.message.includes('当前密码错误') ? 401 : 400;

        res.status(statusCode).json({
            success: false,
            message: error.message,
            code: 'CHANGE_PASSWORD_ERROR'
        });
    }
});

// 批量操作（仅管理员）
router.post('/batch-action', requireAdmin, async (req, res) => {
    try {
        const { action, userIds } = req.body;

        if (!action || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: '无效的批量操作参数',
                code: 'INVALID_BATCH_PARAMS'
            });
        }

        const operatorInfo = getOperatorInfo(req);
        const results = [];
        const errors = [];

        // 支持的批量操作
        const allowedActions = ['enable', 'disable', 'reset-password'];
        if (!allowedActions.includes(action)) {
            return res.status(400).json({
                success: false,
                message: '不支持的批量操作类型',
                code: 'UNSUPPORTED_BATCH_ACTION'
            });
        }

        // 逐个处理用户
        for (const userId of userIds) {
            try {
                const numericUserId = parseInt(userId);
                if (isNaN(numericUserId)) {
                    errors.push({ userId, error: '无效的用户ID' });
                    continue;
                }

                let result;
                switch (action) {
                    case 'enable':
                        result = await UserManagementService.updateUser(
                            numericUserId, 
                            { status: true }, 
                            operatorInfo
                        );
                        break;
                    case 'disable':
                        result = await UserManagementService.updateUser(
                            numericUserId, 
                            { status: false }, 
                            operatorInfo
                        );
                        break;
                    case 'reset-password':
                        result = await UserManagementService.resetPassword(numericUserId, operatorInfo);
                        break;
                }
                
                results.push({ userId: numericUserId, success: true, data: result });
            } catch (error) {
                errors.push({ userId, error: error.message });
            }
        }

        res.json({
            success: true,
            message: `批量操作完成`,
            data: {
                action,
                successCount: results.length,
                errorCount: errors.length,
                results,
                errors
            }
        });

    } catch (error) {
        logger.error('批量操作失败', {
            error: error.message,
            operatorId: req.user.id,
            batchData: req.body
        });

        res.status(500).json({
            success: false,
            message: '批量操作失败',
            code: 'BATCH_ACTION_ERROR'
        });
    }
});

// 获取审计日志（仅管理员）
router.get('/audit/logs', requireAdmin, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            operatorId,
            targetUserId,
            operationType,
            startDate,
            endDate
        } = req.query;

        const options = {
            page: parseInt(page),
            limit: Math.min(parseInt(limit), 100),
            operatorId: operatorId ? parseInt(operatorId) : undefined,
            targetUserId: targetUserId ? parseInt(targetUserId) : undefined,
            operationType,
            startDate,
            endDate
        };

        const result = await UserManagementService.getAuditLogs(options);

        res.json({
            success: true,
            message: '获取审计日志成功',
            data: result
        });

    } catch (error) {
        logger.error('获取审计日志失败', {
            error: error.message,
            operatorId: req.user.id,
            query: req.query
        });

        res.status(500).json({
            success: false,
            message: '获取审计日志失败',
            code: 'GET_AUDIT_LOGS_ERROR'
        });
    }
});

module.exports = router;
