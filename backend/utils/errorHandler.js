/**
 * 统一错误处理工具
 * 提供错误分类、重试机制、错误恢复等功能
 */

const logger = require('./asyncLogger');
const config = require('../config/config');

// 自定义错误类
class AppError extends Error {
    constructor(message, code, statusCode = 500, details = {}) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.timestamp = new Date().toISOString();
        
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            details: this.details,
            timestamp: this.timestamp
        };
    }
}

// 业务错误类
class BusinessError extends AppError {
    constructor(message, code, details) {
        super(message, code, 400, details);
        this.name = 'BusinessError';
    }
}

// 验证错误类
class ValidationError extends AppError {
    constructor(message, field, value) {
        super(message, 'VALIDATION_ERROR', 400, { field, value });
        this.name = 'ValidationError';
    }
}

// 认证错误类
class AuthenticationError extends AppError {
    constructor(message = '认证失败') {
        super(message, 'AUTHENTICATION_ERROR', 401);
        this.name = 'AuthenticationError';
    }
}

// 权限错误类
class AuthorizationError extends AppError {
    constructor(message = '权限不足') {
        super(message, 'AUTHORIZATION_ERROR', 403);
        this.name = 'AuthorizationError';
    }
}

// 网络错误类
class NetworkError extends AppError {
    constructor(message, details) {
        super(message, 'NETWORK_ERROR', 503, details);
        this.name = 'NetworkError';
    }
}

// 数据库错误类
class DatabaseError extends AppError {
    constructor(message, query, details) {
        super(message, 'DATABASE_ERROR', 500, { query, ...details });
        this.name = 'DatabaseError';
    }
}

/**
 * 重试机制装饰器
 */
function retry(options = {}) {
    const {
        times = 3,
        delay = 1000,
        backoff = 2,
        condition = null,
        onRetry = null
    } = options;

    return function(target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function(...args) {
            let lastError;
            
            for (let attempt = 1; attempt <= times; attempt++) {
                try {
                    const result = await originalMethod.apply(this, args);
                    return result;
                } catch (error) {
                    lastError = error;
                    
                    // 检查是否应该重试
                    if (condition && !condition(error)) {
                        throw error;
                    }
                    
                    // 如果是最后一次尝试，直接抛出错误
                    if (attempt === times) {
                        logger.error(`${propertyKey} 重试失败`, {
                            method: propertyKey,
                            attempts: attempt,
                            error: error.message
                        });
                        throw error;
                    }
                    
                    // 计算延迟时间
                    const waitTime = delay * Math.pow(backoff, attempt - 1);
                    
                    logger.warn(`${propertyKey} 执行失败，准备重试`, {
                        method: propertyKey,
                        attempt,
                        maxAttempts: times,
                        waitTime,
                        error: error.message
                    });
                    
                    // 触发重试回调
                    if (onRetry) {
                        await onRetry(error, attempt);
                    }
                    
                    // 等待后重试
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
            
            throw lastError;
        };

        return descriptor;
    };
}

/**
 * 错误处理装饰器
 */
function errorHandler(options = {}) {
    const {
        logLevel = 'error',
        rethrow = true,
        defaultValue = undefined
    } = options;

    return function(target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function(...args) {
            try {
                const result = await originalMethod.apply(this, args);
                return result;
            } catch (error) {
                // 记录错误
                logger[logLevel](`${propertyKey} 执行出错`, {
                    method: propertyKey,
                    error: error.message,
                    stack: error.stack,
                    args: args.length > 0 ? args : undefined
                });

                // 转换为应用错误
                if (!(error instanceof AppError)) {
                    error = new AppError(
                        error.message || '未知错误',
                        'UNKNOWN_ERROR',
                        500,
                        { originalError: error.name }
                    );
                }

                // 是否重新抛出
                if (rethrow) {
                    throw error;
                }

                // 返回默认值
                return defaultValue;
            }
        };

        return descriptor;
    };
}

/**
 * 全局错误处理中间件
 */
const globalErrorHandler = (err, req, res, next) => {
    // 如果响应已发送，交给默认处理器
    if (res.headersSent) {
        return next(err);
    }

    // 转换为应用错误
    let error = err;
    if (!(error instanceof AppError)) {
        error = new AppError(
            err.message || '服务器内部错误',
            'INTERNAL_ERROR',
            err.statusCode || 500,
            { originalError: err.name }
        );
    }

    // 记录错误
    logger.error('请求处理错误', {
        url: req.url,
        method: req.method,
        ip: req.ip,
        user: req.session?.user?.username,
        error: error.toJSON(),
        stack: err.stack
    });

    // 准备响应
    const response = {
        success: false,
        message: error.message,
        code: error.code
    };

    // 开发环境添加详细信息
    if (config.server.isDevelopment) {
        response.details = error.details;
        response.stack = err.stack;
    }

    // 发送响应
    res.status(error.statusCode).json(response);
};

/**
 * 异步错误包装器
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * 错误恢复策略
 */
class ErrorRecovery {
    static async withFallback(primaryFn, fallbackFn) {
        try {
            return await primaryFn();
        } catch (error) {
            logger.warn('主方法失败，使用备用方案', {
                error: error.message
            });
            return await fallbackFn(error);
        }
    }

    static async withTimeout(fn, timeout = 30000) {
        return Promise.race([
            fn(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new AppError('操作超时', 'TIMEOUT', 408)), timeout)
            )
        ]);
    }

    static async withCircuitBreaker(fn, options = {}) {
        const {
            threshold = 5,
            timeout = 60000,
            resetTimeout = 30000
        } = options;

        // 简单的熔断器实现
        if (!this.circuitBreakers) {
            this.circuitBreakers = new Map();
        }

        const key = fn.name || 'anonymous';
        let breaker = this.circuitBreakers.get(key);

        if (!breaker) {
            breaker = {
                failures: 0,
                lastFailTime: 0,
                state: 'CLOSED' // CLOSED, OPEN, HALF_OPEN
            };
            this.circuitBreakers.set(key, breaker);
        }

        // 检查熔断器状态
        if (breaker.state === 'OPEN') {
            if (Date.now() - breaker.lastFailTime > resetTimeout) {
                breaker.state = 'HALF_OPEN';
                logger.info('熔断器半开启', { key });
            } else {
                throw new AppError('服务暂时不可用', 'CIRCUIT_BREAKER_OPEN', 503);
            }
        }

        try {
            const result = await this.withTimeout(fn, timeout);
            
            // 成功，重置失败计数
            if (breaker.state === 'HALF_OPEN') {
                breaker.state = 'CLOSED';
                logger.info('熔断器关闭', { key });
            }
            breaker.failures = 0;
            
            return result;
        } catch (error) {
            breaker.failures++;
            breaker.lastFailTime = Date.now();

            if (breaker.failures >= threshold) {
                breaker.state = 'OPEN';
                logger.error('熔断器开启', { 
                    key, 
                    failures: breaker.failures,
                    threshold 
                });
            }

            throw error;
        }
    }
}

/**
 * 验证工具
 */
class Validator {
    static required(value, fieldName) {
        if (value === undefined || value === null || value === '') {
            throw new ValidationError(`${fieldName}不能为空`, fieldName, value);
        }
        return value;
    }

    static email(value, fieldName = '邮箱') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            throw new ValidationError(`${fieldName}格式不正确`, fieldName, value);
        }
        return value;
    }

    static minLength(value, min, fieldName = '字段') {
        if (value.length < min) {
            throw new ValidationError(
                `${fieldName}长度不能少于${min}位`,
                fieldName,
                value
            );
        }
        return value;
    }

    static maxLength(value, max, fieldName = '字段') {
        if (value.length > max) {
            throw new ValidationError(
                `${fieldName}长度不能超过${max}位`,
                fieldName,
                value
            );
        }
        return value;
    }

    static range(value, min, max, fieldName = '值') {
        const num = Number(value);
        if (isNaN(num) || num < min || num > max) {
            throw new ValidationError(
                `${fieldName}必须在${min}到${max}之间`,
                fieldName,
                value
            );
        }
        return num;
    }

    static pattern(value, pattern, fieldName = '字段', message) {
        if (!pattern.test(value)) {
            throw new ValidationError(
                message || `${fieldName}格式不正确`,
                fieldName,
                value
            );
        }
        return value;
    }
}

module.exports = {
    AppError,
    BusinessError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NetworkError,
    DatabaseError,
    retry,
    errorHandler,
    globalErrorHandler,
    asyncHandler,
    ErrorRecovery,
    Validator
};
