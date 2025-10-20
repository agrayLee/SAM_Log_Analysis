/**
 * 用户管理路由 - 临时禁用版本
 * 为确保系统稳定性，暂时禁用所有用户管理功能
 */

const express = require('express');
const router = express.Router();
const { 
    requireAdmin, 
    requireSelfOrAdmin, 
    getOperatorInfo 
} = require('../middleware/auth');
const logger = require('../utils/asyncLogger');

// 统一的禁用响应
const disabledResponse = (req, res, functionality = '用户管理') => {
    logger.info('用户尝试访问已禁用的功能', {
        functionality,
        operator: getOperatorInfo(req),
        url: req.url,
        method: req.method
    });
    
    res.status(503).json({
        success: false,
        message: `${functionality}功能暂时不可用，以确保系统稳定性。如需相关操作，请联系系统管理员。`,
        code: 'USER_MANAGEMENT_DISABLED'
    });
};

// 所有用户管理路由都返回禁用状态

// 获取用户列表（仅管理员）
router.get('/', requireAdmin, (req, res) => {
    disabledResponse(req, res, '用户列表查询');
});

// 创建新用户（仅管理员）
router.post('/', requireAdmin, (req, res) => {
    disabledResponse(req, res, '用户创建');
});

// 获取单个用户信息
router.get('/:id', requireSelfOrAdmin, (req, res) => {
    disabledResponse(req, res, '用户详情查看');
});

// 更新用户信息
router.put('/:id', requireSelfOrAdmin, (req, res) => {
    disabledResponse(req, res, '用户信息修改');
});

// 删除用户（仅管理员）
router.delete('/:id', requireAdmin, (req, res) => {
    disabledResponse(req, res, '用户删除');
});

// 重置用户密码（仅管理员）
router.post('/:id/reset-password', requireAdmin, (req, res) => {
    disabledResponse(req, res, '密码重置');
});

// 修改用户密码
router.post('/:id/change-password', requireSelfOrAdmin, (req, res) => {
    disabledResponse(req, res, '密码修改');
});

// 批量操作（仅管理员）
router.post('/batch-action', requireAdmin, (req, res) => {
    disabledResponse(req, res, '批量用户操作');
});

// 获取审计日志（仅管理员）
router.get('/audit/logs', requireAdmin, (req, res) => {
    disabledResponse(req, res, '审计日志查询');
});

module.exports = router;
