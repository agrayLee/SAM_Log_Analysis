# 故障排查手册

## 概述
本文档提供网络共享日志验证程序的详细故障排查指南，帮助快速定位和解决常见问题。

## 快速诊断工具

### 自动诊断
```bash
# 运行完整健康检查
npm run health-check

# 分析系统日志
npm run analyze-logs

# 验证数据完整性
npm run validate-data logs/parsed-data.json
```

### 手动检查清单
- [ ] Node.js版本 >= 14.0.0
- [ ] 网络连接到 10.21.189.125 正常
- [ ] logs目录存在且可写
- [ ] 所有依赖文件完整

## 🆕 最新问题解决方案 (v1.4.0)

### 界面显示问题

#### 问题：字体颜色在深紫色背景下不清晰
**症状**：页面副标题在深紫色背景下难以阅读，对比度不足
**原因**：CSS颜色设置使用了透明度，在深色背景下可见性差
**解决方案**：
```css
.page-subtitle {
  color: #ffffff;  /* 使用纯白色 */
  opacity: 1;      /* 移除透明度 */
  font-weight: 500; /* 增加字体权重 */
}
```

### 搜索功能问题

#### 问题：车牌号模糊搜索失败，提示"格式不正确"
**症状**：输入部分车牌号（如"736"）时返回400错误
**原因**：后端安全验证过于严格，要求完整车牌号格式
**解决方案**：
1. 修改后端验证策略，支持模糊搜索
2. 长度小于7位的输入跳过严格格式验证
3. 保留基本安全检查，防止特殊字符注入

#### 问题：日期筛选时提示"开始日期格式不正确"
**症状**：选择日期范围后点击搜索返回400错误
**原因**：前后端日期格式不匹配
- 前端发送：`2025-08-15 14:30:00`（空格分隔）
- 后端期望：`2025-08-15T14:30:00`（ISO格式）
**解决方案**：
```javascript
// 后端支持多种日期格式
const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/,                     // 只有日期
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,  // 空格分隔
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/   // ISO格式
];
```

### 系统启动问题

#### 问题：页面显示网络连接失败、ERR_CONNECTION_REFUSED
**症状**：浏览器显示无法连接，红色错误提示
**原因**：后端服务未启动或端口冲突
**解决方案**：
1. 确认后端服务启动：`npm start`
2. 检查端口占用：`netstat -ano | findstr :3001`
3. 访问正确地址：`http://localhost:3001`

### 开发环境问题

#### 问题：前端修改不生效
**症状**：修改前端代码后，浏览器中看不到变化
**原因**：系统使用构建后的静态文件，不是开发服务器
**解决方案**：
```bash
# 重新构建前端
cd frontend
npm run build

# 重启后端服务
cd ..
npm start
```

### 用户体验问题

#### 问题：日期选择器默认行为不便
**症状**：选择结束日期时默认为00:00:00，无法获取当天完整数据
**解决方案**：添加智能时间调整
```javascript
// 自动将结束日期调整为23:59:59
if (endDate && endDate.endsWith('00:00:00')) {
  const endDateOnly = endDate.split(' ')[0];
  filters.dateRange[1] = `${endDateOnly} 23:59:59`;
}
```

### 登录安全问题

#### 问题：登录限制过于严格
**症状**：多次输错密码后被锁定时间过长
**原因**：15分钟内只允许5次尝试
**解决方案**：调整为10次尝试，平衡安全性和易用性

## 问题分类和解决方案

### 🚫 启动问题

#### 问题1：程序无法启动
**症状：**
- 运行 `npm start` 无响应
- 出现 "模块未找到" 错误
- Node.js版本报错

**诊断步骤：**
1. 检查Node.js版本
   ```bash
   node --version
   npm --version
   ```

2. 验证项目结构
   ```bash
   ls -la src/
   # 应该包含：index.js, logger.js, networkShare.js, logParser.js
   ```

3. 检查依赖项
   ```bash
   cat package.json
   # 确认main字段指向正确文件
   ```

**解决方案：**
- **版本过低**：升级Node.js到14+版本
- **文件缺失**：重新下载完整的项目文件
- **权限问题**：以管理员权限运行PowerShell
- **路径错误**：确保在项目根目录执行命令

#### 问题2：模块加载错误
**症状：**
```
Error: Cannot find module './logger'
Error: Cannot find module '../src/networkShare'
```

**解决方案：**
1. 检查文件路径
   ```bash
   # 确认文件存在
   ls src/logger.js
   ls src/networkShare.js
   ls src/logParser.js
   ```

2. 检查文件编码
   - 确保所有文件是UTF-8编码
   - 检查是否有隐藏字符

3. 重新创建package.json
   ```bash
   npm init -y
   # 然后手动修改main字段
   ```

### 🌐 网络连接问题

#### 问题3：无法连接到网络共享
**症状：**
- 显示 "网络共享连接失败"
- 认证错误提示
- 超时错误

**详细诊断：**
1. **网络连通性测试**
   ```bash
   ping 10.21.189.125
   # 应该看到TTL响应
   ```

2. **端口连接测试**
   ```bash
   telnet 10.21.189.125 445
   # SMB端口应该可达
   ```

3. **手动连接测试**
   ```cmd
   net use \\\\10.21.189.125\\Logs Password2024 /user:PRC/Administrator
   # 测试手动连接
   ```

4. **查看连接状态**
   ```cmd
   net use
   # 查看当前网络连接
   ```

**分步解决方案：**

**步骤1：基本网络检查**
- 确认计算机连接到公司网络
- 检查VPN连接状态（如果适用）
- 验证DNS解析正常

**步骤2：认证信息验证**
- 用户名：`PRC/Administrator`（注意域名前缀）
- 密码：`Password2024`（区分大小写）
- 确认账户未被锁定

**步骤3：系统设置检查**
- 启用"网络发现"
- 启用"文件和打印机共享"
- 检查Windows防火墙设置

**步骤4：高级网络诊断**
```bash
# 清除DNS缓存
ipconfig /flushdns

# 重置网络连接
netsh winsock reset

# 检查SMB协议版本
Get-SmbServerConfiguration | Select EnableSMB1Protocol,EnableSMB2Protocol
```

#### 问题4：网络连接不稳定
**症状：**
- 连接时断时续
- 文件读取中断
- 超时错误频繁

**解决方案：**
1. **调整超时设置**
   - 在networkShare.js中增加超时时间
   - 添加自动重试机制

2. **网络优化**
   ```cmd
   # 检查网络质量
   ping -t 10.21.189.125
   
   # 检查网络拥塞
   netstat -s
   ```

3. **缓存优化**
   ```cmd
   # 清理网络缓存
   net use * /delete /y
   ipconfig /flushdns
   ```

### 📁 文件访问问题

#### 问题5：找不到日志文件
**症状：**
- "未找到任何相关的日志文件"
- "今天的日期文件夹不存在"
- 文件列表为空

**诊断步骤：**
1. **手动验证文件存在**
   ```cmd
   # 直接访问共享文件夹
   dir \\10.21.189.125\Logs

   # 检查今天日期文件夹
   dir \\10.21.189.125\Logs\20240811
   ```

2. **检查日期计算**
   ```javascript
   // 在Node.js中验证日期计算
   const today = new Date();
   const dateStr = today.getFullYear().toString() + 
                  (today.getMonth() + 1).toString().padStart(2, '0') + 
                  today.getDate().toString().padStart(2, '0');
   console.log('计算的日期文件夹:', dateStr);
   ```

3. **权限检查**
   ```cmd
   # 检查文件夹权限
   icacls \\10.21.189.125\Logs\20240811
   ```

**解决方案：**
- **日期文件夹不存在**：检查是否是工作日，或者日志系统是否正常运行
- **文件名格式错误**：验证实际文件名是否符合 `JieLink_Center_Comm_YYYYMMDD.log` 格式
- **权限不足**：联系系统管理员确认读取权限

#### 问题6：文件读取错误
**症状：**
- "文件流读取错误"
- "权限被拒绝"
- 文件部分读取失败

**解决方案：**
1. **检查文件占用**
   ```cmd
   # 查看文件是否被其他程序占用
   openfiles /query /fo table | findstr "JieLink_Center_Comm"
   ```

2. **权限修复**
   ```cmd
   # 重新获取权限
   net use \\10.21.189.125\Logs /delete
   net use \\10.21.189.125\Logs Password2024 /user:PRC/Administrator
   ```

3. **文件完整性检查**
   - 检查文件大小是否合理
   - 用文本编辑器打开文件查看内容

### 💾 内存和性能问题

#### 问题7：内存不足
**症状：**
- "内存溢出"错误
- 程序运行缓慢
- 系统响应迟钝

**诊断和解决：**
1. **监控内存使用**
   ```javascript
   // 在程序中添加内存监控
   console.log('内存使用:', process.memoryUsage());
   ```

2. **系统资源检查**
   ```cmd
   # 检查系统内存
   wmic OS get TotalVisibleMemorySize,FreePhysicalMemory
   
   # 检查进程内存使用
   tasklist /fi "imagename eq node.exe"
   ```

3. **优化措施**
   - 减少同时处理的文件数量
   - 使用更小的缓冲区大小
   - 及时释放不需要的变量

#### 问题8：处理速度过慢
**症状：**
- 大文件处理时间过长
- 进度停滞不前
- CPU使用率过高

**性能优化：**
1. **调整读取参数**
   ```javascript
   // 优化流读取参数
   const fileStream = createReadStream(filePath, {
     encoding: 'utf8',
     highWaterMark: 64 * 1024 // 调整缓冲区大小
   });
   ```

2. **并发处理优化**
   - 避免同时处理多个大文件
   - 使用worker threads（如果需要）
   - 实现进度显示

3. **算法优化**
   - 优化正则表达式
   - 减少不必要的字符串操作
   - 使用更高效的匹配算法

### 🔍 数据解析问题

#### 问题9：解析结果不正确
**症状：**
- 找不到山姆接口记录
- 车牌号格式错误
- 时间戳匹配失败

**诊断步骤：**
1. **检查日志格式**
   ```bash
   # 查看实际日志行格式
   head -20 \\10.21.189.125\Logs\20240811\JieLink_Center_Comm_20240811.log
   ```

2. **验证正则表达式**
   ```javascript
   // 测试正则表达式
   const testLine = '查询山姆是否会员，请求地址...';
   const pattern = /查询山姆是否会员，请求地址/;
   console.log('匹配结果:', pattern.test(testLine));
   ```

3. **手动验证数据**
   - 确认日志中确实包含山姆接口调用
   - 验证JSON格式是否正确
   - 检查字段名称是否一致

**解决方案：**
- **日志格式变更**：更新解析规则以适应新格式
- **编码问题**：确保文件编码正确处理
- **时区问题**：检查时间戳时区设置

#### 问题10：数据匹配精度低
**症状：**
- 请求响应匹配不准确
- 时间差过大
- 匹配数量过少

**优化匹配算法：**
1. **调整时间窗口**
   ```javascript
   // 修改时间匹配窗口
   const maxTimeDiff = 10 * 60 * 1000; // 增加到10分钟
   ```

2. **改进匹配策略**
   - 使用更精确的时间戳格式
   - 考虑车牌号作为额外匹配条件
   - 实现模糊匹配机制

### 📊 日志和监控问题

#### 问题11：日志文件未生成
**症状：**
- logs目录为空
- 特定级别日志缺失
- 日志写入失败

**解决步骤：**
1. **权限检查**
   ```cmd
   # 检查logs目录权限
   icacls logs
   
   # 手动创建测试文件
   echo test > logs\test.txt
   ```

2. **目录创建**
   ```cmd
   # 手动创建日志目录
   mkdir logs
   
   # 设置权限
   icacls logs /grant %USERNAME%:F
   ```

3. **代码调试**
   ```javascript
   // 在logger.js中添加调试输出
   console.log('尝试写入日志文件:', filepath);
   console.log('日志目录存在:', fs.existsSync(this.logDir));
   ```

#### 问题12：日志级别过多
**症状：**
- 日志文件过大
- DEBUG信息过多
- 影响性能

**日志优化：**
1. **调整日志级别**
   ```bash
   # 设置环境变量
   set LOG_LEVEL=INFO
   
   # 或在代码中修改
   this.currentLevel = this.levels.INFO;
   ```

2. **日志轮转**
   - 实现按大小轮转
   - 按时间清理旧日志
   - 压缩历史日志

### 🛠️ 工具相关问题

#### 问题13：健康检查失败
**症状：**
- 多项检查未通过
- 工具运行错误
- 报告生成失败

**分步修复：**
1. **手动验证每个检查项**
   ```bash
   # 逐项检查
   node --version
   ping 10.21.189.125
   dir src
   ```

2. **重置环境**
   ```bash
   # 清理临时文件
   del /q logs\health-check-test.log
   
   # 重新初始化
   npm run health-check
   ```

#### 问题14：数据验证工具报错
**症状：**
- 验证规则过严格
- 大量误报警告
- 处理特殊数据失败

**调整验证规则：**
1. **放宽验证条件**
   ```javascript
   // 修改车牌号验证规则
   validateLicensePlate(licensePlate) {
     // 实现更宽松的验证逻辑
   }
   ```

2. **增加异常处理**
   - 处理边缘情况
   - 增加容错机制
   - 提供更详细的错误信息

## 预防措施

### 定期维护
- **每日**：检查日志文件生成情况
- **每周**：运行完整健康检查
- **每月**：清理历史日志文件

### 监控指标
- 网络连接成功率 > 95%
- 文件解析成功率 > 90%
- 内存使用 < 500MB
- 处理时间 < 30秒/100MB

### 备份策略
- 定期备份重要配置文件
- 保存成功运行的程序版本
- 记录环境变化和修改

## 紧急联系

### 技术支持流程
1. **立即措施**：
   - 停止程序运行
   - 保存错误日志
   - 记录错误现象

2. **信息收集**：
   ```bash
   # 收集系统信息
   npm run health-check > system-info.txt
   npm run analyze-logs > analysis-report.txt
   ```

3. **问题报告**：
   - 描述具体问题现象
   - 提供错误日志文件
   - 说明复现步骤

### 常用命令速查表
```bash
# 快速诊断
npm run health-check              # 系统健康检查
npm run analyze-logs             # 日志分析
npm test                         # 运行测试
node --version                   # 检查Node.js版本
ping 10.21.189.125              # 网络连通性
net use                         # 查看网络连接

# 文件操作
dir \\10.21.189.125\Logs        # 列出共享文件
net use /delete /y              # 清除所有网络连接
icacls logs                     # 检查目录权限

# 系统监控
tasklist | findstr node        # 查看Node.js进程
wmic process get name,PageFileUsage | findstr node  # 内存使用
netstat -an | findstr 445      # SMB端口状态
```

## 🚨 用户管理功能问题排查 (v1.2.0)

### 登录卡死问题

#### 问题15：登录页面卡在"登录中"状态
**症状：**
- 用户点击登录后，按钮显示"登录中"但永不响应
- 后端日志显示登录请求开始但没有完成
- 浏览器网络请求超时

**根本原因：**
- `UserManagementService.getUserById()`调用导致数据库连接阻塞
- 登录流程中的数据库查询挂起
- DatabasePool连接获取超时或死锁

**关键诊断：**
```bash
# 检查Node.js进程是否响应
curl -m 5 http://localhost:3001/health

# 查看数据库连接状态
curl http://localhost:3001/api/status | grep -A5 database

# 检查登录API响应
curl -X POST -m 5 http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

**立即修复方案：**
1. **移除登录路径上的UserManagementService调用**
2. **使用基于用户名的角色推断**
3. **避免在认证流程中进行实时数据库查询**

**代码修复示例：**
```javascript
// ❌ 错误做法 - 导致阻塞
const fullUserInfo = await UserManagementService.getUserById(user.id);

// ✅ 正确做法 - 使用基本信息
const userInfo = {
    id: user.id,
    username: user.username,
    role: user.username === 'admin' ? 'admin' : 'user',
    status: true,
    first_login: false
};
```

**预防措施：**
- 登录关键路径不应包含复杂数据库操作
- 用户管理功能应设计为独立模块
- 使用Session缓存用户信息，减少数据库查询
- 定期测试登录流程的响应时间

#### 问题16：用户管理功能不可用
**症状：**
- 账号管理页面加载失败
- 新增用户提交失败
- 用户列表显示错误

**临时解决方案：**
为了保证基础功能正常，用户管理功能可能需要临时禁用：

```javascript
// 在用户管理路由中添加临时禁用逻辑
router.get('/api/users', (req, res) => {
    res.status(503).json({
        success: false,
        message: '用户管理功能暂时不可用，请联系管理员',
        code: 'SERVICE_TEMPORARILY_UNAVAILABLE'
    });
});
```

**长期解决方案：**
1. **重新设计UserManagementService**：
   - 使用连接池优化
   - 添加查询超时保护
   - 实现降级策略

2. **优化数据库访问**：
   - 使用更轻量的查询
   - 实现读写分离
   - 添加查询缓存

3. **分离用户管理逻辑**：
   - 基础认证使用简单逻辑
   - 高级功能使用独立服务
   - 实现优雅降级

## 🆕 优化版本新增问题排查 (v1.1.0)

### 配置相关问题

#### 环境变量未生效
**症状**：修改.env文件后配置没有改变

**解决方案**：
1. 确认.env文件在项目根目录
2. 重启应用使配置生效
3. 检查config.js中的默认值是否覆盖了环境变量
4. 验证配置：
   ```bash
   node -e "require('./backend/config/config').getConfigSummary()"
   ```

#### Session密钥警告
**症状**：启动时提示"生产环境必须设置SESSION_SECRET"

**解决方案**：
```bash
# 编辑.env文件，设置强密钥
SESSION_SECRET=your-very-long-random-string-here-at-least-32-chars
```

### 性能相关问题

#### 数据库连接池耗尽
**症状**：提示"获取数据库连接超时"

**诊断**：
```bash
# 查看连接池状态
curl http://localhost:3001/api/status | json_pp
```

**解决方案**：
1. 增加连接池大小：
   ```
   DB_CONNECTION_LIMIT=20  # 默认10
   ```
2. 检查慢查询
3. 重启应用释放连接

#### 缓存内存占用过高
**症状**：内存使用持续增长

**诊断**：
- 查看缓存统计：访问 /api/status 查看cache部分

**解决方案**：
1. 调整缓存配置：
   ```
   CACHE_TTL=180  # 缩短到3分钟
   ```
2. 手动清理：重启应用
3. 禁用缓存：
   ```
   ENABLE_CACHE=false
   ```

### 安全相关问题

#### 速率限制触发（429错误）
**症状**：返回"请求过于频繁"

**解决方案**：
1. 调整限制参数：
   ```
   RATE_LIMIT_WINDOW=900000  # 15分钟
   RATE_LIMIT_MAX_REQUESTS=200  # 增加请求数
   ```
2. 临时禁用（仅开发环境）：
   ```
   ENABLE_RATE_LIMIT=false
   ```

#### SQL注入防护误报
**症状**：正常请求被拒绝

**诊断**：
- 检查请求参数是否包含SQL关键字（SELECT、DROP等）

**解决方案**：
1. 使用参数化查询
2. 调整security.js中的检测规则
3. 添加白名单路径

### 日志相关问题

#### 异步日志延迟
**症状**：日志不是立即出现

**说明**：
- 这是正常的，异步日志有1秒缓冲期

**调整方法**：
1. 立即刷新：在代码中调用 `logger.flush()`
2. 修改刷新间隔（asyncLogger.js中的flushInterval）

#### 日志文件过大
**症状**：日志目录占用空间过多

**解决方案**：
1. 调整保留天数：
   ```
   LOG_MAX_FILES=7  # 只保留7天
   ```
2. 手动清理旧日志：
   ```bash
   # Windows
   forfiles /p logs /d -30 /c "cmd /c del @file"
   
   # Linux/Mac
   find logs -name "*.log" -mtime +30 -delete
   ```

### 新模块调试

#### 查看各模块状态
```bash
# 获取完整系统状态
curl http://localhost:3001/api/status | json_pp

# 输出包含：
# - cache: 缓存命中率、大小
# - database: 连接池状态
# - logging: 日志统计
# - scheduler: 定时任务状态
```

#### 性能监控
```javascript
// 在代码中添加性能标记
const start = Date.now();
// ... 你的代码
logger.performance('操作名称', Date.now() - start);
```

### 升级后的检查清单

1. **配置验证**
   - [ ] .env文件已创建并配置
   - [ ] SESSION_SECRET已设置
   - [ ] 网络密码已更新

2. **依赖检查**
   - [ ] 运行 `npm install` 成功
   - [ ] 新依赖包已安装（helmet、rate-limit等）

3. **功能测试**
   - [ ] 系统正常启动
   - [ ] 登录功能正常
   - [ ] 查询功能正常
   - [ ] 缓存生效（检查/api/status）

4. **性能验证**
   - [ ] 内存使用正常（<500MB）
   - [ ] 响应时间正常（<1秒）
   - [ ] 并发测试通过

---
**更新时间：** 2024年12月  
**版本：** 1.1.0  
**维护者：** 产品经理团队
