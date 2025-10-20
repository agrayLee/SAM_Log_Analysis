/**
 * 数据验证工具
 * 验证日志解析结果的准确性和完整性
 */

const fs = require('fs');
const path = require('path');

class DataValidator {
    constructor() {
        this.validationRules = {
            licensePlate: {
                pattern: /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领A-Z]{1}[A-Z]{1}[A-Z0-9]{4}[A-Z0-9挂学警港澳]{1}$/,
                description: '车牌号格式验证（中国车牌号标准）'
            },
            timestamp: {
                pattern: /^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$/,
                description: '时间戳格式验证（YYYY-MM-DD HH:mm:ss）'
            },
            freeParking: {
                type: 'boolean',
                description: '免费停车字段类型验证'
            },
            rejectReason: {
                type: 'string',
                maxLength: 500,
                description: '拒绝原因字段验证'
            }
        };
        
        this.stats = {
            totalRecords: 0,
            validRecords: 0,
            invalidRecords: 0,
            warnings: 0,
            errors: []
        };
    }
    
    /**
     * 输出带颜色的文本
     */
    colorLog(text, color = 'white') {
        const colors = {
            red: '\x1b[31m',
            green: '\x1b[32m',
            yellow: '\x1b[33m',
            blue: '\x1b[34m',
            white: '\x1b[37m',
            reset: '\x1b[0m'
        };
        
        console.log(colors[color] + text + colors.reset);
    }
    
    /**
     * 验证车牌号格式
     * @param {string} licensePlate - 车牌号
     * @returns {Object} 验证结果
     */
    validateLicensePlate(licensePlate) {
        const result = {
            isValid: false,
            errors: [],
            warnings: []
        };
        
        if (!licensePlate) {
            result.errors.push('车牌号为空');
            return result;
        }
        
        if (typeof licensePlate !== 'string') {
            result.errors.push('车牌号必须是字符串类型');
            return result;
        }
        
        const trimmed = licensePlate.trim();
        
        if (trimmed.length === 0) {
            result.errors.push('车牌号为空字符串');
            return result;
        }
        
        if (trimmed.length < 7 || trimmed.length > 8) {
            result.warnings.push(`车牌号长度异常: ${trimmed.length} (标准长度7-8位)`);
        }
        
        // 检查是否包含中文字符（省份简称）
        const hasChineseChar = /[\\u4e00-\\u9fa5]/.test(trimmed);
        if (!hasChineseChar) {
            result.warnings.push('车牌号缺少省份简称');
        }
        
        // 基本格式验证（放宽一些，因为可能有特殊车牌）
        const basicPattern = /^.{7,8}$/;
        if (basicPattern.test(trimmed)) {
            result.isValid = true;
        } else {
            result.errors.push('车牌号格式不符合基本规范');
        }
        
        return result;
    }
    
    /**
     * 验证时间戳格式
     * @param {string} timestamp - 时间戳
     * @returns {Object} 验证结果
     */
    validateTimestamp(timestamp) {
        const result = {
            isValid: false,
            errors: [],
            warnings: []
        };
        
        if (!timestamp) {
            result.errors.push('时间戳为空');
            return result;
        }
        
        if (typeof timestamp !== 'string') {
            result.errors.push('时间戳必须是字符串类型');
            return result;
        }
        
        // 验证格式
        if (!this.validationRules.timestamp.pattern.test(timestamp)) {
            result.errors.push('时间戳格式不正确，期望格式：YYYY-MM-DD HH:mm:ss');
            return result;
        }
        
        // 验证日期有效性
        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) {
                result.errors.push('时间戳表示的日期无效');
                return result;
            }
            
            // 检查时间范围合理性
            const now = new Date();
            const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            const oneDayLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            
            if (date < oneYearAgo) {
                result.warnings.push('时间戳过于久远（超过一年前）');
            } else if (date > oneDayLater) {
                result.warnings.push('时间戳是未来时间');
            }
            
            result.isValid = true;
            
        } catch (error) {
            result.errors.push(`时间戳解析失败: ${error.message}`);
        }
        
        return result;
    }
    
    /**
     * 验证免费停车字段
     * @param {*} freeParking - 免费停车标志
     * @returns {Object} 验证结果
     */
    validateFreeParking(freeParking) {
        const result = {
            isValid: false,
            errors: [],
            warnings: []
        };
        
        if (freeParking === undefined || freeParking === null) {
            result.errors.push('免费停车字段为空');
            return result;
        }
        
        if (typeof freeParking === 'boolean') {
            result.isValid = true;
        } else if (typeof freeParking === 'string') {
            const lowerValue = freeParking.toLowerCase();
            if (lowerValue === 'true' || lowerValue === 'false') {
                result.isValid = true;
                result.warnings.push('免费停车字段是字符串类型，建议转换为布尔类型');
            } else {
                result.errors.push(`免费停车字段值无效: ${freeParking}`);
            }
        } else {
            result.errors.push(`免费停车字段类型错误: ${typeof freeParking}`);
        }
        
        return result;
    }
    
    /**
     * 验证拒绝原因字段
     * @param {string} rejectReason - 拒绝原因
     * @returns {Object} 验证结果
     */
    validateRejectReason(rejectReason) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };
        
        // 拒绝原因可以为空
        if (rejectReason === undefined || rejectReason === null || rejectReason === '') {
            return result;
        }
        
        if (typeof rejectReason !== 'string') {
            result.errors.push('拒绝原因必须是字符串类型');
            result.isValid = false;
            return result;
        }
        
        if (rejectReason.length > this.validationRules.rejectReason.maxLength) {
            result.warnings.push(`拒绝原因过长: ${rejectReason.length} 字符`);
        }
        
        // 检查是否包含常见的错误信息格式
        const commonPatterns = [
            /error/i,
            /exception/i,
            /fail/i,
            /invalid/i,
            /timeout/i
        ];
        
        const hasValidErrorPattern = commonPatterns.some(pattern => pattern.test(rejectReason));
        if (rejectReason.length > 0 && !hasValidErrorPattern) {
            result.warnings.push('拒绝原因格式可能不规范');
        }
        
        return result;
    }
    
    /**
     * 验证单条记录
     * @param {Object} record - 日志记录
     * @param {number} index - 记录索引
     * @returns {Object} 验证结果
     */
    validateRecord(record, index) {
        const result = {
            index,
            isValid: true,
            errors: [],
            warnings: [],
            fields: {}
        };
        
        // 验证记录基本结构
        if (!record || typeof record !== 'object') {
            result.errors.push('记录不是有效的对象');
            result.isValid = false;
            return result;
        }
        
        // 验证必需字段
        const requiredFields = ['licensePlate', 'requestTimestamp', 'responseTimestamp', 'freeParking'];
        const missingFields = requiredFields.filter(field => !(field in record));
        
        if (missingFields.length > 0) {
            result.errors.push(`缺少必需字段: ${missingFields.join(', ')}`);
            result.isValid = false;
        }
        
        // 验证各个字段
        if (record.licensePlate !== undefined) {
            result.fields.licensePlate = this.validateLicensePlate(record.licensePlate);
            if (!result.fields.licensePlate.isValid) {
                result.isValid = false;
            }
        }
        
        if (record.requestTimestamp !== undefined) {
            result.fields.requestTimestamp = this.validateTimestamp(record.requestTimestamp);
            if (!result.fields.requestTimestamp.isValid) {
                result.isValid = false;
            }
        }
        
        if (record.responseTimestamp !== undefined) {
            result.fields.responseTimestamp = this.validateTimestamp(record.responseTimestamp);
            if (!result.fields.responseTimestamp.isValid) {
                result.isValid = false;
            }
        }
        
        if (record.freeParking !== undefined) {
            result.fields.freeParking = this.validateFreeParking(record.freeParking);
            if (!result.fields.freeParking.isValid) {
                result.isValid = false;
            }
        }
        
        if (record.rejectReason !== undefined) {
            result.fields.rejectReason = this.validateRejectReason(record.rejectReason);
            if (!result.fields.rejectReason.isValid) {
                result.isValid = false;
            }
        }
        
        // 验证时间逻辑
        if (record.requestTimestamp && record.responseTimestamp) {
            try {
                const requestTime = new Date(record.requestTimestamp);
                const responseTime = new Date(record.responseTimestamp);
                
                if (responseTime <= requestTime) {
                    result.warnings.push('响应时间早于或等于请求时间');
                }
                
                const timeDiff = responseTime - requestTime;
                if (timeDiff > 5 * 60 * 1000) { // 超过5分钟
                    result.warnings.push(`请求响应时间间隔过长: ${Math.round(timeDiff / 1000)} 秒`);
                }
                
            } catch (error) {
                result.warnings.push('时间逻辑验证失败');
            }
        }
        
        // 收集所有错误和警告
        Object.values(result.fields).forEach(fieldResult => {
            result.errors.push(...fieldResult.errors);
            result.warnings.push(...fieldResult.warnings);
        });
        
        return result;
    }
    
    /**
     * 验证数据集合
     * @param {Array} records - 记录数组
     * @returns {Object} 验证结果
     */
    validateDataset(records) {
        this.colorLog('\\n🔍 ========== 数据验证开始 ==========', 'blue');
        
        if (!Array.isArray(records)) {
            this.colorLog('❌ 输入数据不是数组格式', 'red');
            return {
                isValid: false,
                error: '输入数据不是数组格式'
            };
        }
        
        this.stats.totalRecords = records.length;
        console.log(`\\n📊 开始验证 ${records.length} 条记录...`);
        
        const validationResults = [];
        const errorSummary = {};
        const warningSummary = {};
        
        records.forEach((record, index) => {
            const result = this.validateRecord(record, index);
            validationResults.push(result);
            
            if (result.isValid) {
                this.stats.validRecords++;
            } else {
                this.stats.invalidRecords++;
            }
            
            this.stats.warnings += result.warnings.length;
            
            // 统计错误类型
            result.errors.forEach(error => {
                errorSummary[error] = (errorSummary[error] || 0) + 1;
            });
            
            // 统计警告类型
            result.warnings.forEach(warning => {
                warningSummary[warning] = (warningSummary[warning] || 0) + 1;
            });
        });
        
        this.printValidationSummary(errorSummary, warningSummary);
        this.saveValidationReport(validationResults, errorSummary, warningSummary);
        
        return {
            isValid: this.stats.invalidRecords === 0,
            summary: this.stats,
            details: validationResults,
            errorSummary,
            warningSummary
        };
    }
    
    /**
     * 打印验证摘要
     */
    printValidationSummary(errorSummary, warningSummary) {
        console.log('\\n📋 ========== 验证结果摘要 ==========');
        
        this.colorLog(`📦 总记录数: ${this.stats.totalRecords}`, 'blue');
        this.colorLog(`✅ 有效记录: ${this.stats.validRecords}`, 'green');
        this.colorLog(`❌ 无效记录: ${this.stats.invalidRecords}`, 'red');
        this.colorLog(`⚠️  警告总数: ${this.stats.warnings}`, 'yellow');
        
        if (this.stats.totalRecords > 0) {
            const validPercent = (this.stats.validRecords / this.stats.totalRecords * 100).toFixed(1);
            console.log(`\\n🎯 数据质量评分: ${validPercent}%`);
        }
        
        // 显示常见错误
        if (Object.keys(errorSummary).length > 0) {
            console.log('\\n❌ 常见错误:');
            Object.entries(errorSummary)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .forEach(([error, count]) => {
                    this.colorLog(`   ${error}: ${count} 次`, 'red');
                });
        }
        
        // 显示常见警告
        if (Object.keys(warningSummary).length > 0) {
            console.log('\\n⚠️  常见警告:');
            Object.entries(warningSummary)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .forEach(([warning, count]) => {
                    this.colorLog(`   ${warning}: ${count} 次`, 'yellow');
                });
        }
        
        // 给出建议
        console.log('\\n💡 建议:');
        if (this.stats.invalidRecords === 0) {
            this.colorLog('   ✅ 数据质量良好，可以放心使用', 'green');
        } else if (this.stats.invalidRecords < this.stats.totalRecords * 0.1) {
            this.colorLog('   ⚠️  少量数据异常，建议检查并修复', 'yellow');
        } else {
            this.colorLog('   ❌ 存在较多数据问题，建议检查数据源', 'red');
        }
    }
    
    /**
     * 保存验证报告
     */
    saveValidationReport(validationResults, errorSummary, warningSummary) {
        try {
            const logDir = path.join(__dirname, '..', 'logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const reportFile = path.join(logDir, `data-validation-${timestamp}.json`);
            
            const reportData = {
                timestamp: new Date().toISOString(),
                summary: this.stats,
                errorSummary,
                warningSummary,
                validationRules: this.validationRules,
                details: validationResults
            };
            
            fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2), 'utf8');
            
            console.log(`\\n💾 验证报告已保存到: ${reportFile}`);
            
        } catch (error) {
            this.colorLog(`保存验证报告失败: ${error.message}`, 'red');
        }
    }
    
    /**
     * 从文件加载数据并验证
     * @param {string} filePath - 数据文件路径
     */
    async validateFromFile(filePath) {
        try {
            console.log(`\\n📂 从文件加载数据: ${filePath}`);
            
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(fileContent);
            
            return this.validateDataset(data);
            
        } catch (error) {
            this.colorLog(`文件验证失败: ${error.message}`, 'red');
            return {
                isValid: false,
                error: error.message
            };
        }
    }
}

// 主函数
async function main() {
    const validator = new DataValidator();
    
    // 如果提供了文件路径参数
    const filePath = process.argv[2];
    if (filePath) {
        await validator.validateFromFile(filePath);
    } else {
        console.log('\\n使用方法: node data-validator.js <数据文件路径>');
        console.log('示例: node data-validator.js ../logs/parsed-data.json');
    }
}

// 如果直接运行此文件
if (require.main === module) {
    main().catch(console.error);
}

module.exports = DataValidator;
