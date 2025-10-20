# 生产环境更新指南

## 快速开始

### 一键更新命令
```bash
# 在生产服务器上执行
cd C:\log_analysis
production-update.bat
```

---

## 更新流程说明

### 前提条件

1. **Git已配置**
   - 生产环境已初始化Git仓库
   - Git凭证已保存（Windows凭证管理器）
   - 可以访问GitHub仓库

2. **Node.js环境**
   - Node.js版本 >= 14.x
   - npm已安装

3. **备份空间**
   - 磁盘空间充足（建议至少1GB）

---

## 脚本功能详解

### 1. production-cleanup.bat - 清理脚本

**用途**：清理生产环境中的开发文件和文档

**删除的内容**：
- ✅ 所有 `.md` 文档文件
- ✅ `docs/` 目录
- ✅ `tools/` 目录
- ✅ 多余的部署脚本（20+个）
- ✅ 7天前的旧日志文件

**保留的内容**：
- ✅ `backend/`, `frontend/`, `database/`
- ✅ `node_modules/`, `logs/`
- ✅ `.env`, `package.json`, `ecosystem.config.js`
- ✅ 启动脚本

**使用方法**：
```bash
# 在生产服务器上执行
cd C:\log_analysis
production-cleanup.bat
```

**预期结果**：
- 删除约25个文件和2个目录
- 节省磁盘空间约1-2MB
- 生产环境更加简洁

---

### 2. production-update.bat - 更新脚本

**用途**：自动化拉取最新代码并更新生产环境

**执行步骤**：

#### 步骤1：停止服务
```
- 停止Windows服务（如果存在）
- 停止所有Node.js进程
- 等待进程完全停止
```

#### 步骤2：备份当前版本
```
- 创建备份目录 backup/backup_YYYY-MM-DD_HH-MM-SS/
- 备份 backend/, frontend/, package.json, .env
- 记录备份信息
```

#### 步骤3：拉取最新代码
```
- git fetch origin main
- git reset --hard origin/main
- 显示最新提交信息
```

#### 步骤4：安装/更新依赖
```
- 清理旧的 node_modules/
- npm install --production
- 验证依赖完整性
```

#### 步骤5：重启服务
```
- 启动Windows服务（如果存在）
- 验证服务状态
- 显示更新摘要
```

**使用方法**：
```bash
# 在生产服务器上执行
cd C:\log_analysis
production-update.bat
```

**配置说明**：

脚本顶部的配置区域可以修改：

```batch
REM 生产环境路径
set "PROD_PATH=C:\log_analysis"

REM GitHub仓库信息
set "GIT_REPO=https://github.com/agrayLee/SAM_Log_Analysis.git"
set "GIT_BRANCH=main"

REM 服务名称（如果使用Windows服务）
set "SERVICE_NAME=LogAnalysis"
```

---

## 手动更新步骤（如果脚本失败）

### 步骤1：停止服务
```bash
# 方式1：停止Windows服务
net stop LogAnalysis

# 方式2：停止Node进程
taskkill /f /im node.exe
```

### 步骤2：备份
```bash
# 创建备份
mkdir backup\manual_backup_%date%
xcopy /e backend backup\manual_backup_%date%\backend\
xcopy /e frontend backup\manual_backup_%date%\frontend\
copy package.json backup\manual_backup_%date%\
copy .env backup\manual_backup_%date%\
```

### 步骤3：拉取代码
```bash
# 拉取最新代码
git fetch origin main
git reset --hard origin/main
```

### 步骤4：安装依赖
```bash
# 清理并重新安装
rmdir /s /q node_modules
npm install --production
```

### 步骤5：启动服务
```bash
# 方式1：启动Windows服务
net start LogAnalysis

# 方式2：手动启动
start.bat
```

---

## 故障排查

### 问题1：Git拉取失败

**错误信息**：
```
fatal: unable to access 'https://github.com/...': Failed to connect
```

**解决方案**：
```bash
# 1. 检查网络连接
ping github.com

# 2. 检查Git凭证
git config --list | findstr credential

# 3. 重新配置凭证
git config credential.helper manager
```

### 问题2：npm install失败

**错误信息**：
```
npm ERR! code ENOTFOUND
```

**解决方案**：
```bash
# 1. 使用国内镜像源
npm config set registry https://registry.npmmirror.com

# 2. 清理缓存
npm cache clean --force

# 3. 重新安装
npm install --production
```

### 问题3：服务启动失败

**错误信息**：
```
服务未响应控制功能
```

**解决方案**：
```bash
# 1. 检查端口占用
netstat -ano | findstr :5000

# 2. 停止占用进程
taskkill /f /pid <PID>

# 3. 手动启动测试
node backend/app.js

# 4. 检查日志
type logs\app.log
```

### 问题4：依赖版本冲突

**错误信息**：
```
npm ERR! peer dependency conflict
```

**解决方案**：
```bash
# 1. 删除package-lock.json
del package-lock.json

# 2. 删除node_modules
rmdir /s /q node_modules

# 3. 重新安装
npm install --production --legacy-peer-deps
```

---

## 回滚到旧版本

### 使用备份回滚

```bash
# 1. 停止服务
net stop LogAnalysis
taskkill /f /im node.exe

# 2. 找到备份目录
dir backup\

# 3. 恢复备份（例如：backup_2025-10-20_10-30-00）
cd C:\log_analysis
rmdir /s /q backend frontend
xcopy /e backup\backup_2025-10-20_10-30-00\backend backend\
xcopy /e backup\backup_2025-10-20_10-30-00\frontend frontend\
copy backup\backup_2025-10-20_10-30-00\package.json .
copy backup\backup_2025-10-20_10-30-00\.env .

# 4. 重新安装依赖
npm install --production

# 5. 重启服务
net start LogAnalysis
```

### 使用Git回滚

```bash
# 1. 查看提交历史
git log --oneline -10

# 2. 回滚到指定提交（例如：abc1234）
git reset --hard abc1234

# 3. 重新安装依赖
npm install --production

# 4. 重启服务
net start LogAnalysis
```

---

## 最佳实践

### 更新前检查清单

- [ ] 确认当前服务运行正常
- [ ] 检查磁盘空间充足（至少1GB）
- [ ] 确认网络连接正常
- [ ] 通知用户系统即将维护
- [ ] 准备回滚方案

### 更新时间建议

- **推荐时间**：凌晨2:00-4:00（用户最少时段）
- **避免时间**：工作日9:00-18:00（业务高峰期）
- **更新频率**：每周一次或按需更新

### 验证清单

更新完成后，验证以下功能：

- [ ] 服务正常启动（检查端口监听）
- [ ] 前端页面可以访问
- [ ] 用户登录功能正常
- [ ] 日志查询功能正常
- [ ] 数据库连接正常
- [ ] 无错误日志

### 验证命令

```bash
# 1. 检查服务状态
sc query LogAnalysis
netstat -ano | findstr :5000

# 2. 测试前端访问
curl http://localhost:5000

# 3. 检查后端日志
type logs\app.log | find "Server started"

# 4. 测试数据库连接
node -e "const db = require('./backend/database/db'); db.init();"
```

---

## 自动化部署（高级）

### 使用任务计划程序

1. **打开任务计划程序**
   ```
   taskschd.msc
   ```

2. **创建基本任务**
   - 名称：自动更新日志分析系统
   - 触发器：每周日凌晨2:00
   - 操作：启动程序
   - 程序：C:\log_analysis\production-update.bat

3. **高级设置**
   - 使用最高权限运行
   - 失败后重试3次，间隔10分钟
   - 记录任务历史

### 使用Git Hooks

创建 `.git/hooks/post-merge` 文件：

```bash
#!/bin/sh
# 自动安装依赖
npm install --production

# 重启服务
net stop LogAnalysis
net start LogAnalysis
```

---

## 监控和日志

### 日志位置

```
logs/
├── app.log              # 应用日志
├── error.log            # 错误日志
├── access.log           # 访问日志
└── update.log           # 更新日志（需手动重定向）
```

### 记录更新日志

```bash
# 执行更新并记录日志
production-update.bat > logs\update_%date%.log 2>&1
```

### 监控服务状态

创建 `monitor.bat` 文件：

```batch
@echo off
:loop
sc query LogAnalysis | find "RUNNING" >nul
if %errorlevel% neq 0 (
    echo [%date% %time%] 服务已停止，正在重启... >> logs\monitor.log
    net start LogAnalysis
)
timeout /t 60 /nobreak >nul
goto loop
```

---

## 联系支持

如有问题，请联系：
- **开发者**：agrayLee
- **邮箱**：agray@qq.com
- **仓库**：https://github.com/agrayLee/SAM_Log_Analysis

---

## 更新历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2025-10-20 | 初始版本，创建更新脚本 |

---

**生成时间**: 2025-10-20
**文档版本**: v1.0.0
