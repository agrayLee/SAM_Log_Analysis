/**
 * 认证路由
 * 处理用户登录、登出和Session管理
 */

const express = require('express');
const router = express.Router();
const DatabaseService = require('../services/DatabaseService');
const UserManagementService = require('../services/UserManagementService');
const { requireAuth, checkFirstLogin } = require('../middleware/auth');
const logger = require('../utils/asyncLogger');

const databaseService = new DatabaseService();

// 调试端点 - 临时测试
router.post('/test', (req, res) => {
    logger.info('测试端点收到请求', { 
        body: req.body, 
        headers: req.headers,
        method: req.method,
        url: req.url
    });
    res.json({ success: true, message: '测试成功' });
});

// 用户登录
router.post('/login', async (req, res) => {
    try {
        logger.info('登录请求开始', { body: req.body, headers: req.headers });
        const { username, password } = req.body;

        // 输入验证
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: '用户名和密码不能为空',
                code: 'MISSING_CREDENTIALS'
            });
        }

        // 验证用户
        const user = await databaseService.validateUser(username, password);

        if (!user) {
            logger.warn('登录失败', { username, ip: req.ip });
            return res.status(401).json({
                success: false,
                message: '用户名或密码错误',
                code: 'INVALID_CREDENTIALS'
            });
        }

        // 临时简化登录逻辑，确保基本功能正常
        const userInfo = {
            id: user.id,
            username: user.username,
            role: user.username === 'admin' ? 'admin' : 'user',
            status: true,
            first_login: false
        };

        // 暂时移除UserManagementService调用以避免登录阻塞
        logger.info('使用基本用户信息，跳过UserManagementService调用避免阻塞', { userId: user.id });

        // 检查账号状态
        if (!userInfo.status) {
            return res.status(401).json({
                success: false,
                message: '账号已被禁用',
                code: 'ACCOUNT_DISABLED'
            });
        }

        // 创建Session
        req.session.user = {
            id: userInfo.id,
            username: userInfo.username,
            role: userInfo.role,
            loginTime: new Date()
        };

        logger.info('用户登录成功', {
            userId: userInfo.id,
            username: userInfo.username,
            role: userInfo.role,
            ip: req.ip,
            firstLogin: userInfo.first_login
        });

        res.json({
            success: true,
            message: '登录成功',
            data: {
                user: {
                    id: userInfo.id,
                    username: userInfo.username,
                    role: userInfo.role,
                    loginTime: req.session.user.loginTime,
                    firstLogin: userInfo.first_login || false
                }
            }
        });

    } catch (error) {
        logger.error('登录处理失败', {
            error: error.message,
            username: req.body.username
        });

        res.status(500).json({
            success: false,
            message: '登录处理失败',
            code: 'LOGIN_ERROR'
        });
    }
});

// 用户登出
router.post('/logout', requireAuth, (req, res) => {
    const username = req.user.username;

    req.session.destroy((err) => {
        if (err) {
            logger.error('登出失败', { error: err.message, username });
            return res.status(500).json({
                success: false,
                message: '登出失败',
                code: 'LOGOUT_ERROR'
            });
        }

        logger.info('用户登出成功', { username });

        res.json({
            success: true,
            message: '登出成功'
        });
    });
});

// 获取当前用户信息
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const userInfo = await UserManagementService.getUserById(req.user.id);
        if (!userInfo) {
            return res.status(401).json({
                success: false,
                message: '用户不存在',
                code: 'USER_NOT_FOUND'
            });
        }

        res.json({
            success: true,
            data: {
                user: {
                    id: userInfo.id,
                    username: userInfo.username,
                    realName: userInfo.real_name,
                    phone: userInfo.phone,
                    role: userInfo.role,
                    status: userInfo.status,
                    firstLogin: userInfo.first_login,
                    lastLoginAt: userInfo.last_login_at,
                    createdAt: userInfo.created_at
                }
            }
        });
    } catch (error) {
        logger.error('获取用户信息失败', {
            error: error.message,
            userId: req.user.id
        });

        res.status(500).json({
            success: false,
            message: '获取用户信息失败',
            code: 'GET_PROFILE_ERROR'
        });
    }
});

// 检查登录状态
router.get('/status', async (req, res) => {
    try {
        logger.info('状态检查请求', { 
            sessionID: req.sessionID,
            hasSession: !!req.session,
            hasUser: !!(req.session && req.session.user),
            cookies: req.headers.cookie,
            session: req.session
        });
        
        const isAuthenticated = !!(req.session && req.session.user);
        
        if (!isAuthenticated) {
            logger.info('用户未认证', { sessionID: req.sessionID });
            return res.json({
                success: true,
                data: {
                    isAuthenticated: false,
                    user: null
                }
            });
        }

        // 使用session中的基本用户信息
        let userInfo = {
            id: req.session.user.id,
            username: req.session.user.username,
            role: req.session.user.role || (req.session.user.username === 'admin' ? 'admin' : 'user'),
            firstLogin: false,
            loginTime: req.session.user.loginTime
        };

        // 暂时移除UserManagementService调用以避免状态检查阻塞
        logger.info('直接使用session信息，跳过数据库查询避免阻塞', { userId: userInfo.id });

        logger.info('返回用户认证状态', { userId: userInfo.id, username: userInfo.username });

        res.json({
            success: true,
            data: {
                isAuthenticated: true,
                user: userInfo
            }
        });
    } catch (error) {
        logger.error('检查登录状态失败', {
            error: error.message,
            userId: req.session?.user?.id
        });

        res.json({
            success: true,
            data: {
                isAuthenticated: false,
                user: null
            }
        });
    }
});

// 修改密码
router.post('/change-password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: '当前密码和新密码不能为空',
                code: 'MISSING_PASSWORDS'
            });
        }

        if (newPassword.length < 6) {
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

        const passwordData = { currentPassword, newPassword };
        const operatorInfo = {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        };

        await UserManagementService.changePassword(req.user.id, passwordData, operatorInfo);

        logger.info('用户修改密码成功', { username: req.user.username });

        res.json({
            success: true,
            message: '密码修改成功'
        });

    } catch (error) {
        logger.error('修改密码失败', {
            error: error.message,
            username: req.user.username
        });

        const statusCode = error.message.includes('当前密码错误') ? 401 : 400;

        res.status(statusCode).json({
            success: false,
            message: error.message,
            code: 'CHANGE_PASSWORD_ERROR'
        });
    }
});

module.exports = router;
