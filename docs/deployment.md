# 部署文档

## 概述
本文档提供网络共享日志验证程序的部署指南，包括环境准备、安装配置和运行维护。

## 系统要求

### 硬件要求
- **CPU**: Intel/AMD 双核 2.0GHz 或更高
- **内存**: 4GB RAM 或更高（推荐8GB）
- **磁盘**: 1GB 可用空间（用于日志和临时文件）
- **网络**: 稳定的网络连接，能访问10.21.189.125

### 软件要求
- **操作系统**: Windows 10/11（64位）
- **Node.js**: 版本14.0.0或更高
- **PowerShell**: 5.1或更高版本
- **网络权限**: 能够访问Windows网络共享

## 环境准备

### 1. Node.js安装
1. 访问 [Node.js官网](https://nodejs.org/)
2. 下载LTS版本（推荐16.x或18.x）
3. 运行安装程序，保持默认设置
4. 验证安装：
   ```cmd
   node --version
   npm --version
   ```

### 2. 网络环境配置
1. **网络连通性测试**
   ```cmd
   ping 10.21.189.125
   ```

2. **SMB协议确认**
   ```powershell
   Get-WindowsFeature | Where-Object Name -like "*SMB*"
   ```

3. **防火墙配置**
   - 允许"文件和打印机共享"
   - 确保445端口（SMB）可访问

### 3. 权限设置
1. **用户权限**
   - 确保当前用户有网络访问权限
   - 验证域认证信息有效

2. **文件系统权限**
   ```cmd
   # 确保程序目录可写
   icacls . /grant %USERNAME%:F
   ```

## 安装部署

### 方式一：完整安装
1. **下载项目文件**
   ```cmd
   # 解压到目标目录
   cd C:\LogAnalysis
   ```

2. **验证文件完整性**
   ```cmd
   dir /s
   # 确认所有必需文件存在
   ```

3. **依赖安装**
   ```cmd
   npm install
   ```

4. **初始化检查**
   ```cmd
   npm run health-check
   ```

### 方式二：便携部署
1. **创建部署包**
   ```cmd
   # 将整个项目文件夹复制到目标机器
   xcopy /s /e LogAnalysis C:\LogAnalysis\
   ```

2. **快速验证**
   ```cmd
   cd C:\LogAnalysis
   node src/index.js
   ```

## 配置说明

### 网络配置
在 `src/networkShare.js` 中修改连接参数：
```javascript
this.shareHost = '10.21.189.125';
this.sharePath = '\\\\10.21.189.125\\Logs';
this.username = 'PRC/Administrator';
this.password = 'Password2024';
```

### 日志配置
在 `src/logger.js` 中调整日志级别：
```javascript
// 生产环境建议使用INFO级别
this.currentLevel = this.levels.INFO;
```

### 性能配置
在 `src/logParser.js` 中调整处理参数：
```javascript
// 调整读取缓冲区大小
const fileStream = createReadStream(filePath, {
  encoding: 'utf8',
  highWaterMark: 64 * 1024 // 64KB缓冲区
});
```

## 运行部署

### 交互式运行
```cmd
# 进入项目目录
cd C:\LogAnalysis

# 运行程序
npm start
```

### 批处理运行
创建 `run.bat` 文件：
```batch
@echo off
cd /d C:\LogAnalysis
echo 开始运行日志分析程序...
npm start
pause
```

### 定时任务运行
1. **创建PowerShell脚本** (`run-analysis.ps1`):
   ```powershell
   Set-Location "C:\LogAnalysis"
   
   # 记录开始时间
   $startTime = Get-Date
   Write-Output "[$startTime] 开始执行日志分析"
   
   # 运行程序
   try {
       npm start
       Write-Output "程序执行成功"
   } catch {
       Write-Error "程序执行失败: $_"
   }
   
   # 记录结束时间
   $endTime = Get-Date
   $duration = $endTime - $startTime
   Write-Output "[$endTime] 执行完成，耗时: $duration"
   ```

2. **创建计划任务**：
   ```cmd
   schtasks /create /tn "LogAnalysis" /tr "powershell.exe -File C:\LogAnalysis\run-analysis.ps1" /sc daily /st 09:00
   ```

## 监控和维护

### 健康检查
建议每日执行：
```cmd
npm run health-check
```

### 日志轮转
创建日志清理脚本 (`cleanup-logs.ps1`):
```powershell
$logDir = "C:\LogAnalysis\logs"
$cutoffDate = (Get-Date).AddDays(-30)

# 删除30天前的日志文件
Get-ChildItem $logDir -Filter "*.log" | Where-Object { $_.LastWriteTime -lt $cutoffDate } | Remove-Item

Write-Output "日志清理完成"
```

### 性能监控
创建性能监控脚本：
```powershell
# 监控程序运行状态
$processes = Get-Process -Name "node" -ErrorAction SilentlyContinue

if ($processes) {
    foreach ($proc in $processes) {
        $memoryMB = [math]::Round($proc.WorkingSet64 / 1MB, 2)
        Write-Output "Node进程 $($proc.Id): 内存使用 ${memoryMB}MB"
    }
} else {
    Write-Output "没有发现Node.js进程"
}
```

## 故障排查

### 常见问题
1. **程序无法启动**
   - 检查Node.js版本
   - 验证文件权限
   - 查看错误日志

2. **网络连接失败**
   - 测试网络连通性
   - 验证认证信息
   - 检查防火墙设置

3. **性能问题**
   - 监控内存使用
   - 检查磁盘空间
   - 调整缓冲区大小

### 诊断工具
```cmd
# 完整诊断
npm run health-check

# 日志分析
npm run analyze-logs

# 系统信息收集
systeminfo > system-info.txt
```

## 安全考虑

### 认证信息保护
1. **代码混淆**：
   ```cmd
   # 使用混淆工具保护敏感信息
   npm install -g javascript-obfuscator
   javascript-obfuscator src/networkShare.js --output dist/networkShare.js
   ```

2. **环境变量**：
   ```cmd
   # 使用环境变量存储密码
   set SHARE_PASSWORD=Password2024
   ```

3. **文件权限**：
   ```cmd
   # 限制文件访问权限
   icacls src /inheritance:r /grant:r %USERNAME%:F
   ```

### 网络安全
1. **VPN连接**：在不安全网络中使用VPN
2. **加密传输**：确保SMB加密启用
3. **访问控制**：限制网络共享访问权限

## 备份和恢复

### 备份策略
1. **程序文件备份**：
   ```cmd
   # 创建完整备份
   xcopy /s /e C:\LogAnalysis C:\Backup\LogAnalysis_%date%\
   ```

2. **配置文件备份**：
   - `package.json`
   - `src/networkShare.js`（注意敏感信息）
   - 自定义配置文件

3. **日志文件备份**：
   ```cmd
   # 备份重要日志
   xcopy C:\LogAnalysis\logs\*.log C:\Backup\Logs\
   ```

### 恢复流程
1. **系统恢复**：
   ```cmd
   # 从备份恢复
   xcopy /s /e C:\Backup\LogAnalysis C:\LogAnalysis\
   ```

2. **验证恢复**：
   ```cmd
   cd C:\LogAnalysis
   npm run health-check
   ```

## 性能优化

### 硬件优化
1. **SSD存储**：将程序部署在SSD上提高读写速度
2. **内存升级**：增加内存提高大文件处理能力
3. **网络优化**：使用有线连接确保网络稳定

### 软件优化
1. **Node.js优化**：
   ```cmd
   # 增加内存限制
   node --max-old-space-size=4096 src/index.js
   ```

2. **进程优先级**：
   ```cmd
   # 提高进程优先级
   wmic process where name="node.exe" CALL setpriority "above normal"
   ```

## 升级维护

### 版本升级
1. **备份当前版本**
2. **下载新版本文件**
3. **合并配置文件**
4. **运行测试验证**
5. **部署到生产环境**

### 依赖更新
```cmd
# 检查过时依赖
npm outdated

# 更新依赖
npm update
```

### 兼容性测试
在升级前执行完整测试：
```cmd
npm test
npm run health-check
```

## 生产环境清单

### 部署前检查
- [ ] Node.js版本正确
- [ ] 网络连接正常
- [ ] 权限配置完成
- [ ] 防火墙规则设置
- [ ] 备份策略就位

### 部署后验证
- [ ] 程序能正常启动
- [ ] 网络连接成功
- [ ] 日志文件生成
- [ ] 解析功能正常
- [ ] 性能满足要求

### 运维监控
- [ ] 健康检查定时执行
- [ ] 日志轮转正常
- [ ] 性能监控就位
- [ ] 备份任务运行
- [ ] 故障告警配置

---
**更新时间：** 2024年8月11日  
**版本：** 1.0.0  
**维护者：** 产品经理团队
