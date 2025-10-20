/**
 * 山姆日志查询系统 - Express主应用
 * 基于验证项目的核心功能，提供Web API服务
 */

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const config = require('./config/config');
const logger = require('./utils/asyncLogger');
const DatabaseInitializer = require('./database/init');
const TimezoneMigration = require('./database/migrate-timezone');
const UserManagementMigration = require('./database/migrate-user-management');
const LogScheduler = require('./services/LogScheduler');
const databasePool = require('./services/DatabasePool');
const { cacheService } = require('./services/CacheService');
const { 
    rateLimiters, 
    securityHeaders, 
    sqlInjectionProtection, 
    inputValidation,
    auditLog,
    antiBruteForce,
    mongoSanitize,
    xssClean 
} = require('./middleware/security');

// 导入路由
const authRoutes = require('./routes/auth');
const logsRoutes = require('./routes/logs');
const usersRoutes = require('./routes/users-disabled');

class SamLogSystemApp {
    constructor() {
        this.app = express();
        this.port = config.server.port;
        this.logScheduler = null;
        
        // 验证配置
        config.validateConfig();
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    // 配置中间件
    setupMiddleware() {
        // 安全头部
        this.app.use(securityHeaders);
        
        // CORS配置
        this.app.use(cors({
            origin: config.security.corsOrigin,
            credentials: true
        }));

        // 请求清理和保护
        this.app.use(mongoSanitize()); // 防止NoSQL注入
        this.app.use(xssClean()); // XSS清理
        
        // 请求解析
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Session配置
        this.app.use(session({
            secret: config.session.secret,
            resave: config.session.resave,
            saveUninitialized: config.session.saveUninitialized,
            cookie: {
                secure: config.session.secure,
                httpOnly: true,
                maxAge: config.session.maxAge,
                sameSite: 'lax' // 添加SameSite设置
            },
            name: 'sam.session.id' // 自定义session名称
        }));
        
        // 速率限制
        if (config.security.enableRateLimit) {
            this.app.use('/api/', rateLimiters.api);
            this.app.use('/api/auth/login', rateLimiters.login);
            this.app.use('/api/logs/export', rateLimiters.export);
        }
        
        // SQL注入防护
        this.app.use(sqlInjectionProtection);
        
        // 输入验证
        this.app.use(inputValidation);
        
        // 防暴力破解
        this.app.use(antiBruteForce);
        
        // 审计日志
        this.app.use(auditLog);

        // 静态文件服务（前端构建文件）
        this.app.use(express.static(path.join(__dirname, '../frontend/dist')));

        // 请求日志
        this.app.use((req, res, next) => {
            logger.info('API请求', {
                method: req.method,
                url: req.url,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            next();
        });
    }

    // 配置路由
    setupRoutes() {
        // API路由
        this.app.use('/api/auth', authRoutes);
        this.app.use('/api/logs', logsRoutes);
        this.app.use('/api/users', usersRoutes);

        // 系统状态API
        this.app.get('/api/status', (req, res) => {
            const schedulerStatus = this.logScheduler ? this.logScheduler.getStatus() : null;
            const cacheStats = cacheService.getStats();
            const dbPoolStatus = databasePool.getStatus();
            const loggerStats = logger.getStats();
            
            res.json({
                success: true,
                data: {
                    status: 'running',
                    version: '1.2.0',
                    environment: config.server.env,
                    startTime: this.startTime,
                    scheduler: schedulerStatus,
                    cache: cacheStats,
                    database: dbPoolStatus,
                    logging: loggerStats,
                    uptime: process.uptime(),
                    memory: process.memoryUsage()
                }
            });
        });

        // 健康检查
        this.app.get('/health', async (req, res) => {
            try {
                // 检查数据库连接
                const dbHealthy = await DatabaseInitializer.validateDatabase();
                
                res.json({
                    status: 'healthy',
                    database: dbHealthy ? 'connected' : 'disconnected',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                logger.error('健康检查失败', { error: error.message });
                res.status(503).json({
                    status: 'unhealthy',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // 前端路由回退（SPA支持）
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
        });
    }

    // 错误处理
    setupErrorHandling() {
        // 404处理
        this.app.use((req, res) => {
            logger.warn('404 - 路由未找到', { url: req.url, method: req.method });
            res.status(404).json({
                success: false,
                message: '请求的资源不存在',
                code: 'NOT_FOUND'
            });
        });

        // 全局错误处理
        this.app.use((err, req, res, next) => {
            logger.error('服务器错误', {
                error: err.message,
                stack: err.stack,
                url: req.url,
                method: req.method
            });

            // 不向客户端暴露内部错误详情
            const isDevelopment = process.env.NODE_ENV === 'development';
            
            res.status(err.status || 500).json({
                success: false,
                message: err.message || '服务器内部错误',
                code: err.code || 'INTERNAL_ERROR',
                ...(isDevelopment && { stack: err.stack })
            });
        });
    }

    // 启动服务器
    async start() {
        try {
            // 显示配置摘要
            logger.info('系统配置摘要', config.getConfigSummary());
            
            // 1. 验证数据库
            logger.info('验证数据库连接...');
            const dbHealthy = await DatabaseInitializer.validateDatabase();
            if (!dbHealthy) {
                logger.warn('数据库不存在，开始初始化...');
                const initializer = new DatabaseInitializer();
                await initializer.initialize();
            }
            
            // 1.5. 检查并执行时区迁移
            logger.info('检查数据库时区设置...');
            const migration = new TimezoneMigration();
            const needsMigration = await migration.needsMigration();
            if (needsMigration) {
                logger.info('执行数据库时区迁移...');
                await migration.migrate();
                logger.info('时区迁移完成');
            } else {
                logger.info('数据库时区设置正确，无需迁移');
            }
            
            // 1.6. 检查并执行用户管理功能迁移
            try {
                logger.info('检查用户管理功能迁移...');
                const userMigrationNeeded = await UserManagementMigration.checkMigrationNeeded();
                if (userMigrationNeeded) {
                    logger.info('执行用户管理功能数据库迁移...');
                    const userMigration = new UserManagementMigration();
                    await userMigration.migrate();
                    logger.info('用户管理功能迁移完成');
                } else {
                    logger.info('用户管理功能已是最新版本，无需迁移');
                }
            } catch (error) {
                logger.error('用户管理功能迁移失败', { error: error.message });
                logger.info('系统将继续启动，但用户管理功能可能不可用');
            }
            
            // 2. 初始化数据库连接池
            logger.info('初始化数据库连接池...');
            await databasePool.initialize();
            
            // 3. 预热缓存
            if (config.performance.enableCache) {
                logger.info('预热缓存...');
                // 这里可以添加预热逻辑
            }

            // 4. 启动定时任务
            if (config.scheduler.enabled) {
                logger.info('启动日志定时处理服务...');
                this.logScheduler = new LogScheduler();
                this.logScheduler.start();
            } else {
                logger.info('定时任务已禁用');
            }

            // 5. 启动HTTP服务器
            this.startTime = new Date();
            this.server = this.app.listen(this.port, '0.0.0.0', () => {
                logger.info('山姆日志查询系统启动成功', {
                    port: this.port,
                    environment: config.server.env,
                    startTime: this.startTime,
                    config: config.getConfigSummary()
                });

                console.log(`
🚀 山姆日志查询系统启动成功！

📱 Web界面: http://localhost:${this.port}
📱 内网访问: http://172.21.63.63:${this.port}
🔧 API接口: http://localhost:${this.port}/api
❤️  健康检查: http://localhost:${this.port}/health

💡 默认登录:
   用户名: admin
   密码: admin123

📊 功能说明:
   ✅ 网络共享日志自动同步
   ✅ 山姆接口记录查询和统计
   ✅ 定时任务监控
   ✅ 历史数据分析
   ✅ 用户认证和权限控制
   ⚠️  用户管理功能已临时禁用（确保系统稳定性）
                `);
            });

            // 优雅关闭处理
            this.setupGracefulShutdown();

        } catch (error) {
            logger.error('启动失败', { error: error.message });
            process.exit(1);
        }
    }

    // 优雅关闭
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            logger.info(`收到${signal}信号，开始优雅关闭...`);
            
            // 停止接收新请求
            this.server.close(async () => {
                logger.info('HTTP服务器已关闭');
                
                // 停止定时任务
                if (this.logScheduler) {
                    this.logScheduler.stop();
                    logger.info('定时任务已停止');
                }
                
                // 关闭缓存服务
                cacheService.close();
                logger.info('缓存服务已关闭');
                
                // 关闭数据库连接池
                await databasePool.close();
                logger.info('数据库连接池已关闭');
                
                // 关闭日志系统
                await logger.close();
                
                console.log('应用已完全关闭');
                process.exit(0);
            });

            // 强制关闭超时
            setTimeout(() => {
                logger.error('强制关闭超时');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }
}

// 如果直接运行此文件，启动应用
if (require.main === module) {
    const app = new SamLogSystemApp();
    app.start().catch((error) => {
        console.error('启动失败:', error.message);
        process.exit(1);
    });
}

module.exports = SamLogSystemApp;
