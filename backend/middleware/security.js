/**
 * 安全中间件
 * 包含速率限制、SQL注入防护、XSS防护等
 */

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const config = require('../config/config');
const logger = require('../utils/asyncLogger');

/**
 * 速率限制中间件
 */
const createRateLimiter = (options = {}) => {
    const defaults = {
        windowMs: config.security.rateLimitWindow,
        max: config.security.rateLimitMaxRequests,
        message: '请求过于频繁，请稍后再试',
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            logger.warn('触发速率限制', {
                ip: req.ip,
                path: req.path,
                userAgent: req.get('User-Agent')
            });
            res.status(429).json({
                success: false,
                message: '请求过于频繁，请稍后再试',
                code: 'RATE_LIMIT_EXCEEDED'
            });
        },
        skip: (req) => {
            // 跳过健康检查接口
            return req.path === '/health';
        }
    };

    return rateLimit({ ...defaults, ...options });
};

/**
 * 针对不同接口的速率限制
 */
const rateLimiters = {
    // 通用限制
    general: createRateLimiter(),
    
    // 登录接口限制（平衡安全性和易用性）
    login: createRateLimiter({
        windowMs: 15 * 60 * 1000, // 15分钟
        max: 10, // 最多10次尝试（从5次调整为10次）
        message: '登录尝试次数过多，请15分钟后再试',
        skipSuccessfulRequests: true // 成功的请求不计入限制
    }),
    
    // API接口限制
    api: createRateLimiter({
        windowMs: 1 * 60 * 1000, // 1分钟
        max: 60 // 每分钟60次请求
    }),
    
    // 导出接口限制（资源密集型）
    export: createRateLimiter({
        windowMs: 5 * 60 * 1000, // 5分钟
        max: 10 // 5分钟内最多10次导出
    })
};

/**
 * SQL注入防护中间件
 */
const sqlInjectionProtection = (req, res, next) => {
    // 检查常见的SQL注入模式
    const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER|EXEC|EXECUTE|SCRIPT|JAVASCRIPT)\b)/gi,
        /(--|\||;|\/\*|\*\/|xp_|sp_|0x)/gi,
        /(\bOR\b\s*\d+\s*=\s*\d+)/gi,
        /(\bAND\b\s*\d+\s*=\s*\d+)/gi
    ];

    const checkValue = (value) => {
        if (typeof value === 'string') {
            for (const pattern of sqlPatterns) {
                if (pattern.test(value)) {
                    return true;
                }
            }
        }
        return false;
    };

    // 检查请求参数
    const checkObject = (obj) => {
        for (const key in obj) {
            const value = obj[key];
            if (checkValue(value)) {
                return true;
            }
            if (typeof value === 'object' && value !== null) {
                if (checkObject(value)) {
                    return true;
                }
            }
        }
        return false;
    };

    // 检查各种输入
    if (checkObject(req.query) || checkObject(req.body) || checkObject(req.params)) {
        logger.warn('检测到潜在的SQL注入攻击', {
            ip: req.ip,
            path: req.path,
            method: req.method,
            query: req.query,
            body: req.body
        });
        
        return res.status(400).json({
            success: false,
            message: '请求包含非法字符',
            code: 'INVALID_INPUT'
        });
    }

    next();
};

/**
 * 输入验证中间件
 */
const inputValidation = (req, res, next) => {
    // 限制请求体大小
    if (req.body && JSON.stringify(req.body).length > 1024 * 1024) { // 1MB
        return res.status(413).json({
            success: false,
            message: '请求数据过大',
            code: 'PAYLOAD_TOO_LARGE'
        });
    }

    // 验证车牌号格式（支持模糊搜索）
    if (req.query.plateNumber || req.body.plateNumber || req.params.plateNumber) {
        const plateNumber = req.query.plateNumber || req.body.plateNumber || req.params.plateNumber;
        
        // 允许模糊搜索：长度小于7的输入视为模糊搜索，不进行严格格式验证
        if (plateNumber.length >= 7) {
            const platePattern = /^[\u4e00-\u9fa5][A-Z][A-Z0-9]{5,6}$/;
            
            if (!platePattern.test(plateNumber)) {
                return res.status(400).json({
                    success: false,
                    message: '完整车牌号格式不正确，请使用正确格式（如：闽A12345）或输入部分字符进行模糊搜索',
                    code: 'INVALID_PLATE_NUMBER'
                });
            }
        }
        
        // 基本安全检查：防止特殊字符注入
        const unsafeChars = /[<>'"&;]/;
        if (unsafeChars.test(plateNumber)) {
            return res.status(400).json({
                success: false,
                message: '车牌号包含非法字符',
                code: 'INVALID_CHARACTERS'
            });
        }
    }

    // 验证日期格式（支持多种格式）
    const validateDate = (date) => {
        if (!date) return true;
        
        // 支持的日期格式：
        // 1. YYYY-MM-DD
        // 2. YYYY-MM-DD HH:mm:ss (前端常用格式)
        // 3. YYYY-MM-DDTHH:mm:ss (ISO格式)
        // 4. YYYY-MM-DDTHH:mm:ss.sssZ (完整ISO格式)
        const datePatterns = [
            /^\d{4}-\d{2}-\d{2}$/,                                          // 只有日期
            /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,                       // 空格分隔的日期时间
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,                       // ISO格式（不含毫秒）
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z?$/               // ISO格式（含毫秒）
        ];
        
        return datePatterns.some(pattern => pattern.test(date));
    };

    if (req.query.startDate && !validateDate(req.query.startDate)) {
        return res.status(400).json({
            success: false,
            message: '开始日期格式不正确',
            code: 'INVALID_DATE_FORMAT'
        });
    }

    if (req.query.endDate && !validateDate(req.query.endDate)) {
        return res.status(400).json({
            success: false,
            message: '结束日期格式不正确',
            code: 'INVALID_DATE_FORMAT'
        });
    }

    // 验证分页参数
    if (req.query.page) {
        const page = parseInt(req.query.page);
        if (isNaN(page) || page < 1 || page > 10000) {
            return res.status(400).json({
                success: false,
                message: '页码参数不正确',
                code: 'INVALID_PAGE'
            });
        }
    }

    if (req.query.limit) {
        const limit = parseInt(req.query.limit);
        if (isNaN(limit) || limit < 1 || limit > config.performance.maxRecordsPerPage) {
            return res.status(400).json({
                success: false,
                message: `每页记录数必须在1-${config.performance.maxRecordsPerPage}之间`,
                code: 'INVALID_LIMIT'
            });
        }
    }

    next();
};

/**
 * 安全响应头中间件
 */
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false
});

/**
 * IP白名单中间件（可选）
 */
const ipWhitelist = (whitelist = []) => {
    return (req, res, next) => {
        if (whitelist.length === 0) {
            return next();
        }

        const clientIp = req.ip || req.connection.remoteAddress;
        
        if (!whitelist.includes(clientIp)) {
            logger.warn('IP地址不在白名单中', {
                ip: clientIp,
                path: req.path
            });
            
            return res.status(403).json({
                success: false,
                message: '访问被拒绝',
                code: 'ACCESS_DENIED'
            });
        }

        next();
    };
};

/**
 * 审计日志中间件
 */
const auditLog = (req, res, next) => {
    // 记录敏感操作
    const sensitivePaths = [
        '/api/auth/login',
        '/api/auth/logout',
        '/api/logs/process',
        '/api/logs/export'
    ];

    if (sensitivePaths.includes(req.path)) {
        logger.info('审计日志', {
            action: req.path,
            method: req.method,
            ip: req.ip,
            user: req.session?.user?.username || 'anonymous',
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
        });
    }

    next();
};

/**
 * 防止暴力破解中间件
 */
const bruteForceProtection = new Map();

const antiBruteForce = (req, res, next) => {
    if (req.path !== '/api/auth/login') {
        return next();
    }

    const key = `${req.ip}:${req.body?.username || 'unknown'}`;
    const attempts = bruteForceProtection.get(key) || { count: 0, lastAttempt: Date.now() };

    // 重置计数（如果超过15分钟）
    if (Date.now() - attempts.lastAttempt > 15 * 60 * 1000) {
        attempts.count = 0;
    }

    // 检查尝试次数
    if (attempts.count >= 5) {
        logger.warn('检测到暴力破解尝试', {
            ip: req.ip,
            username: req.body?.username,
            attempts: attempts.count
        });

        return res.status(429).json({
            success: false,
            message: '登录尝试次数过多，请稍后再试',
            code: 'TOO_MANY_ATTEMPTS'
        });
    }

    // 更新尝试记录
    attempts.count++;
    attempts.lastAttempt = Date.now();
    bruteForceProtection.set(key, attempts);

    // 登录成功后清除记录
    const originalJson = res.json;
    res.json = function(data) {
        if (data?.success && req.path === '/api/auth/login') {
            bruteForceProtection.delete(key);
        }
        return originalJson.call(this, data);
    };

    next();
};

// 定期清理暴力破解记录
setInterval(() => {
    const now = Date.now();
    for (const [key, attempts] of bruteForceProtection.entries()) {
        if (now - attempts.lastAttempt > 30 * 60 * 1000) { // 30分钟
            bruteForceProtection.delete(key);
        }
    }
}, 5 * 60 * 1000); // 每5分钟清理一次

module.exports = {
    rateLimiters,
    sqlInjectionProtection,
    inputValidation,
    securityHeaders,
    ipWhitelist,
    auditLog,
    antiBruteForce,
    mongoSanitize,
    xssClean: xss
};
