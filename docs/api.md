# API 文档

## 概述
本文档描述网络共享日志验证程序的主要模块和API接口。

## 核心模块

### Logger 模块
日志记录系统，提供多级别日志功能。

#### 方法

##### `logger.error(message, meta)`
记录错误级别日志
- **参数：**
  - `message` (string): 错误消息
  - `meta` (object): 额外的元数据
- **示例：**
  ```javascript
  logger.error('网络连接失败', { host: '10.21.189.125', error: 'timeout' });
  ```

##### `logger.warn(message, meta)`
记录警告级别日志
- **参数：**
  - `message` (string): 警告消息
  - `meta` (object): 额外的元数据

##### `logger.info(message, meta)`
记录信息级别日志
- **参数：**
  - `message` (string): 信息消息
  - `meta` (object): 额外的元数据

##### `logger.debug(message, meta)`
记录调试级别日志
- **参数：**
  - `message` (string): 调试消息
  - `meta` (object): 额外的元数据

##### `logger.performance(operation, duration, meta)`
记录性能信息
- **参数：**
  - `operation` (string): 操作名称
  - `duration` (number): 耗时（毫秒）
  - `meta` (object): 额外的元数据

##### `logger.network(action, target, status, meta)`
记录网络操作
- **参数：**
  - `action` (string): 操作类型
  - `target` (string): 目标地址
  - `status` (string): 状态
  - `meta` (object): 额外的元数据

### NetworkShareManager 模块
网络共享文件夹管理。

#### 构造函数
```javascript
const manager = new NetworkShareManager();
```

#### 方法

##### `async connect()`
连接到网络共享文件夹
- **返回值：** `Promise<boolean>` - 连接是否成功

##### `async disconnect()`
断开网络共享连接
- **返回值：** `Promise<void>`

##### `checkConnection()`
检查当前连接状态
- **返回值：** `boolean` - 是否已连接

##### `getTodayFolderPath()`
获取今天日期对应的文件夹路径
- **返回值：** `string` - 文件夹路径

##### `listFiles(dirPath)`
列出目录中的文件
- **参数：**
  - `dirPath` (string): 目录路径
- **返回值：** `Array<string>` - 文件列表

##### `fileExists(filePath)`
检查文件是否存在
- **参数：**
  - `filePath` (string): 文件路径
- **返回值：** `boolean` - 文件是否存在

##### `getFileSize(filePath)`
获取文件大小
- **参数：**
  - `filePath` (string): 文件路径
- **返回值：** `number` - 文件大小（字节）

### LogParser 模块
日志解析引擎。

#### 构造函数
```javascript
const parser = new LogParser();
```

#### 方法

##### `identifyLogFiles(dateFolder, baseFileName)`
识别日志文件
- **参数：**
  - `dateFolder` (string): 日期文件夹路径
  - `baseFileName` (string): 基础文件名
- **返回值：** `Array<Object>` - 文件信息列表

##### `async parseLogFile(filePath, maxRecords)`
解析日志文件
- **参数：**
  - `filePath` (string): 文件路径
  - `maxRecords` (number): 最大记录数（0表示不限制）
- **返回值：** `Promise<Array>` - 解析结果

##### `async testFilePerformance(filePath)`
测试文件读取性能
- **参数：**
  - `filePath` (string): 文件路径
- **返回值：** `Promise<Object>` - 性能测试结果

##### `formatResults(results)`
格式化解析结果
- **参数：**
  - `results` (Array): 解析结果
- **返回值：** `string` - 格式化的结果字符串

### LogAnalysisApp 模块
主应用程序类。

#### 构造函数
```javascript
const app = new LogAnalysisApp();
```

#### 方法

##### `async initialize()`
初始化应用程序
- **返回值：** `Promise<boolean>` - 初始化是否成功

##### `async performNetworkValidation()`
执行网络连接验证
- **返回值：** `Promise<boolean>` - 验证是否成功

##### `async performFileIdentification()`
执行文件识别
- **返回值：** `Promise<Array>` - 识别到的文件列表

##### `async performLogParsing(logFiles, maxRecords)`
执行日志解析
- **参数：**
  - `logFiles` (Array): 日志文件列表
  - `maxRecords` (number): 最大解析记录数
- **返回值：** `Promise<Array>` - 解析结果

##### `async performPerformanceTest(logFiles)`
执行性能测试
- **参数：**
  - `logFiles` (Array): 日志文件列表
- **返回值：** `Promise<void>`

##### `async run()`
运行完整的验证流程
- **返回值：** `Promise<void>`

##### `async cleanup()`
清理资源
- **返回值：** `Promise<void>`

## 工具模块

### HealthChecker
系统健康检查工具。

#### 方法
- `async runAllChecks()`: 运行所有健康检查
- `checkNodeVersion()`: 检查Node.js版本
- `checkOperatingSystem()`: 检查操作系统
- `checkProjectStructure()`: 检查项目结构
- `checkNetworkConnectivity()`: 检查网络连通性

### DataValidator
数据验证工具。

#### 方法
- `validateDataset(records)`: 验证数据集合
- `validateRecord(record, index)`: 验证单条记录
- `async validateFromFile(filePath)`: 从文件验证数据

### LogAnalyzer
日志分析工具。

#### 方法
- `async analyzeLogFile(filePath)`: 分析日志文件
- `async analyzeLogDirectory(logDir)`: 分析日志目录
- `generateReport()`: 生成分析报告

## 数据结构

### 解析记录结构
```javascript
{
  requestTimestamp: "2024-08-11 10:30:00",
  responseTimestamp: "2024-08-11 10:30:01", 
  licensePlate: "闽A9L69Y",
  freeParking: true,
  rejectReason: "",
  requestLine: 100,
  responseLine: 105
}
```

### 文件信息结构
```javascript
{
  path: "\\\\10.21.189.125\\Logs\\20240811\\JieLink_Center_Comm_20240811.log",
  name: "JieLink_Center_Comm_20240811.log",
  type: "current", // 或 "slice"
  index: 0
}
```

### 性能测试结果结构
```javascript
{
  fileName: "JieLink_Center_Comm_20240811.log",
  fileSize: "60.25 MB",
  fileSizeBytes: 63168512,
  lineCount: 125436,
  duration: "2500ms",
  durationMs: 2500,
  memoryUsed: "45.2 MB",
  memoryUsedBytes: 47398912,
  throughput: "24.1 MB/s"
}
```

## 配置选项

### 环境变量
- `LOG_LEVEL`: 设置日志级别（ERROR, WARN, INFO, DEBUG）

### 默认配置
```javascript
{
  shareHost: "10.21.189.125",
  sharePath: "\\\\10.21.189.125\\Logs",
  username: "PRC/Administrator", 
  password: "Password2024",
  maxParseRecords: 10,
  maxTimeDiff: 5 * 60 * 1000, // 5分钟
  readTimeout: 30000 // 30秒
}
```

## 错误处理

### 错误类型
1. **网络错误**：连接失败、超时、认证失败
2. **文件错误**：文件不存在、权限不足、读取失败
3. **解析错误**：格式错误、数据损坏、编码问题
4. **系统错误**：内存不足、磁盘空间不足、权限问题

### 错误响应格式
```javascript
{
  success: false,
  error: {
    code: "NETWORK_CONNECTION_FAILED",
    message: "无法连接到网络共享文件夹",
    details: {
      host: "10.21.189.125",
      timeout: 30000
    }
  }
}
```

## 使用示例

### 基本使用
```javascript
const LogAnalysisApp = require('./src/index');

async function main() {
  const app = new LogAnalysisApp();
  
  try {
    await app.initialize();
    await app.run();
  } catch (error) {
    console.error('程序运行失败:', error.message);
  } finally {
    await app.cleanup();
  }
}

main();
```

### 自定义解析
```javascript
const LogParser = require('./src/logParser');
const NetworkShareManager = require('./src/networkShare');

async function customParse() {
  const manager = new NetworkShareManager();
  const parser = new LogParser();
  
  await manager.connect();
  
  const files = parser.identifyLogFiles(
    manager.getTodayFolderPath(),
    'JieLink_Center_Comm'
  );
  
  for (const file of files) {
    const results = await parser.parseLogFile(file.path, 50);
    console.log(`解析 ${file.name}: ${results.length} 条记录`);
  }
  
  await manager.disconnect();
}
```

## 性能考虑

### 内存使用
- 使用流式读取避免大文件内存溢出
- 及时释放不需要的对象引用
- 监控内存使用并在必要时进行垃圾回收

### 网络优化
- 实现连接池减少重复连接开销
- 使用缓存避免重复的网络请求
- 设置合理的超时和重试策略

### 文件处理
- 并行处理多个小文件
- 大文件采用分块处理
- 实现断点续传机制

---
**更新时间：** 2025年8月11日  
**版本：** 1.0.0
