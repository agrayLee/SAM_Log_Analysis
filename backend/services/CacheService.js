/**
 * 缓存服务
 * 提供内存缓存功能，提高查询性能
 */

const crypto = require('crypto');
const config = require('../config/config');
const logger = require('../utils/asyncLogger');

class CacheService {
    constructor() {
        this.cache = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            size: 0
        };
        this.maxSize = 100 * 1024 * 1024; // 100MB最大缓存
        this.currentSize = 0;
        this.ttl = config.performance.cacheTTL * 1000; // 转换为毫秒
        
        // 定期清理过期缓存
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // 每分钟清理
        
        // 定期报告缓存统计
        this.statsInterval = setInterval(() => this.reportStats(), 300000); // 每5分钟报告
    }

    /**
     * 生成缓存键
     */
    generateKey(prefix, params) {
        const hash = crypto
            .createHash('md5')
            .update(JSON.stringify(params))
            .digest('hex');
        return `${prefix}:${hash}`;
    }

    /**
     * 获取缓存
     */
    get(key) {
        const entry = this.cache.get(key);
        
        if (!entry) {
            this.stats.misses++;
            return null;
        }

        // 检查是否过期
        if (entry.expiry && Date.now() > entry.expiry) {
            this.delete(key);
            this.stats.misses++;
            return null;
        }

        // 更新访问时间（LRU）
        entry.lastAccess = Date.now();
        entry.accessCount++;
        
        this.stats.hits++;
        return entry.value;
    }

    /**
     * 设置缓存
     */
    set(key, value, ttl = this.ttl) {
        try {
            const serialized = JSON.stringify(value);
            const size = Buffer.byteLength(serialized);
            
            // 检查单个项目大小
            if (size > 10 * 1024 * 1024) { // 单项最大10MB
                logger.debug('缓存项过大，跳过缓存', { key, size });
                return false;
            }

            // 如果超过最大缓存大小，执行LRU淘汰
            if (this.currentSize + size > this.maxSize) {
                this.evictLRU(size);
            }

            const entry = {
                value,
                size,
                expiry: ttl > 0 ? Date.now() + ttl : null,
                created: Date.now(),
                lastAccess: Date.now(),
                accessCount: 0
            };

            // 如果key已存在，先减去旧的大小
            const oldEntry = this.cache.get(key);
            if (oldEntry) {
                this.currentSize -= oldEntry.size;
            }

            this.cache.set(key, entry);
            this.currentSize += size;
            this.stats.sets++;
            this.stats.size = this.cache.size;
            
            return true;
            
        } catch (error) {
            logger.error('设置缓存失败', { key, error: error.message });
            return false;
        }
    }

    /**
     * 删除缓存
     */
    delete(key) {
        const entry = this.cache.get(key);
        if (entry) {
            this.currentSize -= entry.size;
            this.cache.delete(key);
            this.stats.deletes++;
            this.stats.size = this.cache.size;
            return true;
        }
        return false;
    }

    /**
     * 清除所有缓存
     */
    clear() {
        this.cache.clear();
        this.currentSize = 0;
        this.stats.size = 0;
        logger.info('缓存已清空');
    }

    /**
     * 根据前缀清除缓存
     */
    clearByPrefix(prefix) {
        let count = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (key.startsWith(prefix)) {
                this.currentSize -= entry.size;
                this.cache.delete(key);
                count++;
            }
        }
        this.stats.size = this.cache.size;
        logger.info(`清除缓存项`, { prefix, count });
        return count;
    }

    /**
     * LRU淘汰策略
     */
    evictLRU(requiredSpace) {
        const entries = Array.from(this.cache.entries())
            .map(([key, entry]) => ({ key, ...entry }))
            .sort((a, b) => {
                // 优先淘汰访问次数少的
                if (a.accessCount !== b.accessCount) {
                    return a.accessCount - b.accessCount;
                }
                // 其次淘汰最久未访问的
                return a.lastAccess - b.lastAccess;
            });

        let freedSpace = 0;
        for (const entry of entries) {
            if (freedSpace >= requiredSpace) break;
            
            freedSpace += entry.size;
            this.delete(entry.key);
            logger.debug('LRU淘汰缓存项', { 
                key: entry.key, 
                size: entry.size,
                accessCount: entry.accessCount 
            });
        }
    }

    /**
     * 清理过期缓存
     */
    cleanup() {
        let count = 0;
        const now = Date.now();
        
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiry && now > entry.expiry) {
                this.delete(key);
                count++;
            }
        }

        if (count > 0) {
            logger.debug('清理过期缓存', { count });
        }
    }

    /**
     * 获取缓存统计
     */
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
            : 0;

        return {
            ...this.stats,
            hitRate: `${hitRate}%`,
            currentSize: `${(this.currentSize / 1024 / 1024).toFixed(2)}MB`,
            maxSize: `${(this.maxSize / 1024 / 1024).toFixed(2)}MB`,
            usage: `${(this.currentSize / this.maxSize * 100).toFixed(2)}%`
        };
    }

    /**
     * 报告缓存统计
     */
    reportStats() {
        const stats = this.getStats();
        logger.info('缓存统计报告', stats);
    }

    /**
     * 预热缓存
     */
    async warmup(dataLoader) {
        try {
            logger.info('开始预热缓存');
            
            // 预热常用数据
            const warmupTasks = [
                // 预热最近7天的统计数据
                async () => {
                    const endDate = new Date();
                    const startDate = new Date();
                    startDate.setDate(startDate.getDate() - 7);
                    
                    const stats = await dataLoader.getStatistics({ 
                        startDate: startDate.toISOString(), 
                        endDate: endDate.toISOString() 
                    });
                    
                    const key = this.generateKey('stats', { 
                        startDate: startDate.toISOString(), 
                        endDate: endDate.toISOString() 
                    });
                    
                    this.set(key, stats, 3600000); // 缓存1小时
                }
            ];

            await Promise.all(warmupTasks.map(task => task().catch(err => {
                logger.error('缓存预热任务失败', { error: err.message });
            })));

            logger.info('缓存预热完成', this.getStats());
            
        } catch (error) {
            logger.error('缓存预热失败', { error: error.message });
        }
    }

    /**
     * 关闭缓存服务
     */
    close() {
        clearInterval(this.cleanupInterval);
        clearInterval(this.statsInterval);
        this.clear();
    }
}

// 创建缓存装饰器
function cached(prefix, ttl) {
    return function(target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        
        descriptor.value = async function(...args) {
            const cache = cacheService;
            const key = cache.generateKey(`${prefix}:${propertyKey}`, args);
            
            // 尝试从缓存获取
            const cachedResult = cache.get(key);
            if (cachedResult !== null) {
                logger.debug('缓存命中', { method: propertyKey, key });
                return cachedResult;
            }
            
            // 执行原方法
            const result = await originalMethod.apply(this, args);
            
            // 存入缓存
            cache.set(key, result, ttl);
            
            return result;
        };
        
        return descriptor;
    };
}

// 创建单例
const cacheService = new CacheService();

module.exports = {
    cacheService,
    cached
};
