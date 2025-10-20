/**
 * 系统配置管理
 * 集中管理所有配置，支持环境变量覆盖
 */

const path = require('path');
const fs = require('fs');

// 加载环境变量
if (fs.existsSync(path.join(__dirname, '../../.env'))) {
    require('dotenv').config({ path: path.join(__dirname, '../../.env') });
}

const config = {
    // 服务器配置
    server: {
        port: process.env.PORT || 3001,
        env: process.env.NODE_ENV || 'development',
        isDevelopment: (process.env.NODE_ENV || 'development') === 'development',
        isProduction: process.env.NODE_ENV === 'production'
    },

    // 数据库配置
    database: {
        path: process.env.DB_PATH || path.join(__dirname, '../database/sam_logs.db'),
        connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
        enableWAL: process.env.DB_ENABLE_WAL === 'true',
        queryTimeout: parseInt(process.env.QUERY_TIMEOUT) || 30000
    },

    // Session配置
    session: {
        secret: process.env.SESSION_SECRET || 'sam-log-system-secret-key-2024-please-change-in-production',
        maxAge: parseInt(process.env.SESSION_MAX_AGE) || 8 * 60 * 60 * 1000, // 8小时
        secure: false, // 强制设为false以支持HTTP localhost
        resave: false,
        saveUninitialized: false
    },

    // 网络共享配置
    network: {
        shareHost: process.env.NETWORK_SHARE_HOST || '10.21.189.125',
        sharePath: process.env.NETWORK_SHARE_PATH || '\\\\10.21.189.125\\Logs',
        username: process.env.NETWORK_USERNAME || 'Administrator',
        password: process.env.NETWORK_PASSWORD || 'Password2024',
        timeout: parseInt(process.env.NETWORK_TIMEOUT) || 30000,
        retryTimes: 3,
        retryDelay: 2000
    },

    // 日志配置
    logging: {
        dir: process.env.LOG_DIR || path.join(__dirname, '../../logs'),
        level: process.env.LOG_LEVEL || 'INFO',
        maxFiles: parseInt(process.env.LOG_MAX_FILES) || 30,
        maxSize: parseInt(process.env.LOG_MAX_SIZE) || 10 * 1024 * 1024, // 10MB
        enableConsole: process.env.LOG_CONSOLE !== 'false',
        enableFile: process.env.LOG_FILE !== 'false'
    },

    // 定时任务配置
    scheduler: {
        syncInterval: parseInt(process.env.SYNC_INTERVAL) || 15 * 60, // 15分钟
        fullScanInterval: parseInt(process.env.FULL_SCAN_INTERVAL) || 60 * 60, // 1小时
        cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL) || 24 * 60 * 60, // 24小时
        enabled: process.env.SCHEDULER_ENABLED !== 'false'
    },

    // 性能配置
    performance: {
        maxRecordsPerPage: parseInt(process.env.MAX_RECORDS_PER_PAGE) || 50,
        maxExportRecords: parseInt(process.env.MAX_EXPORT_RECORDS) || 10000,
        cacheTTL: parseInt(process.env.CACHE_TTL) || 5 * 60, // 5分钟
        enableCache: process.env.ENABLE_CACHE !== 'false'
    },

    // 安全配置
    security: {
        rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15分钟
        rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
        corsOrigin: process.env.CORS_ORIGIN ? 
            process.env.CORS_ORIGIN.split(',') : 
            ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080', 'http://172.21.63.63:3001'],
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 10,
        enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false'
    },

    // 监控配置
    monitoring: {
        enabled: process.env.ENABLE_MONITORING === 'true',
        alertEmail: process.env.ALERT_EMAIL || '',
        healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 60000,
        metricsEnabled: process.env.ENABLE_METRICS === 'true'
    },

    // 默认用户配置（仅用于开发和初始化）
    defaultUser: {
        username: 'admin',
        password: 'admin123' // 生产环境应该强制修改
    }
};

// 验证必要的配置
function validateConfig() {
    const errors = [];

    // 生产环境检查
    if (config.server.isProduction) {
        if (config.session.secret === 'sam-log-system-secret-key-2024-please-change-in-production') {
            errors.push('生产环境必须设置SESSION_SECRET环境变量');
        }
        if (config.network.password === 'Password2024') {
            errors.push('生产环境建议通过环境变量设置网络密码');
        }
        if (!config.session.secure) {
            console.warn('警告：生产环境建议启用secure cookie（SESSION_SECURE=true）');
        }
    }

    // 路径检查
    if (!fs.existsSync(config.logging.dir)) {
        try {
            fs.mkdirSync(config.logging.dir, { recursive: true });
            console.log('创建日志目录:', config.logging.dir);
        } catch (error) {
            errors.push(`无法创建日志目录: ${error.message}`);
        }
    }

    if (errors.length > 0) {
        console.error('配置验证失败:');
        errors.forEach(err => console.error(`  - ${err}`));
        if (config.server.isProduction) {
            process.exit(1);
        }
    }

    return errors.length === 0;
}

// 获取配置摘要（隐藏敏感信息）
function getConfigSummary() {
    return {
        server: {
            port: config.server.port,
            env: config.server.env
        },
        database: {
            path: config.database.path,
            connectionLimit: config.database.connectionLimit
        },
        network: {
            shareHost: config.network.shareHost,
            username: config.network.username,
            passwordSet: !!config.network.password
        },
        logging: {
            level: config.logging.level,
            dir: config.logging.dir
        },
        scheduler: {
            syncInterval: `${config.scheduler.syncInterval}秒`,
            enabled: config.scheduler.enabled
        },
        security: {
            rateLimitEnabled: config.security.enableRateLimit,
            corsOrigin: config.security.corsOrigin
        }
    };
}

// 导出配置
module.exports = {
    ...config,
    validateConfig,
    getConfigSummary
};
