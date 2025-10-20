# 山姆日志系统 - 超简单部署指南

> 版本: 2.0 - 极简版
> 更新时间: 2025-10-17
> 目标: 5分钟内完成Windows服务器部署

---

## 📦 部署前准备

### 1. 系统要求
- **操作系统**: Windows Server 2012+ 或 Windows 10/11
- **Node.js**: 14.0.0 或更高版本
- **管理员权限**: 需要（仅安装自启动时）

### 2. 检查Node.js
打开命令提示符，运行：
```bash
node --version
```
如果显示版本号（如 v18.x.x），则已安装。否则请先安装Node.js。

---

## 🚀 部署步骤（3步）

### 第1步：上传项目文件
将整个项目文件夹复制到服务器，例如：
```
D:\sam-log-system\
```

### 第2步：安装依赖
在项目目录下打开命令提示符，运行：
```bash
npm install
```
等待安装完成（约1-2分钟）。

### 第3步：启动系统
双击 `start.bat` 文件。

看到以下输出表示启动成功：
```
🚀 山姆日志查询系统启动成功！

📱 Web界面: http://localhost:3001
🔧 API接口: http://localhost:3001/api
❤️  健康检查: http://localhost:3001/health
```

访问 http://localhost:3001 即可使用系统。

---

## 🔄 开机自启动（可选）

如果需要开机自动启动：

### 安装自启动
1. 右键点击 `install-autostart.bat`
2. 选择 **"以管理员身份运行"**
3. 等待安装完成

### 卸载自启动
1. 右键点击 `uninstall-autostart.bat`
2. 选择 **"以管理员身份运行"**
3. 等待卸载完成

---

## 📂 核心文件说明

| 文件名 | 用途 | 是否必需 |
|--------|------|----------|
| `start.bat` | 启动系统 | ✅ 必需 |
| `install-autostart.bat` | 安装开机自启动 | ⭕ 可选 |
| `uninstall-autostart.bat` | 卸载开机自启动 | ⭕ 可选 |
| `backend/` | 后端代码 | ✅ 必需 |
| `frontend/dist/` | 前端页面 | ✅ 必需 |
| `package.json` | 项目配置 | ✅ 必需 |
| `.env` | 环境配置 | ✅ 必需 |

---

## 🔧 常见问题

### Q1: 端口已被占用
**现象**: 启动时提示端口3001已被占用

**解决**:
1. 修改 `.env` 文件中的 `PORT=3001` 改为其他端口
2. 重新运行 `start.bat`

### Q2: 找不到node命令
**现象**: 提示 'node' 不是内部或外部命令

**解决**:
1. 安装Node.js: https://nodejs.org/
2. 重启命令提示符
3. 再次运行 `start.bat`

### Q3: 自启动不工作
**现象**: 重启电脑后系统没有自动启动

**解决**:
1. 打开"任务计划程序"（搜索 taskschd.msc）
2. 找到 "SamLogSystem" 任务
3. 右键 → "运行" 测试是否能启动
4. 如果失败，查看任务历史记录中的错误信息

### Q4: 如何查看日志
**日志位置**: `logs/` 目录

查看方式：
```bash
# 查看最新错误日志
type logs\error-最新日期.log

# 查看最新信息日志
type logs\info-最新日期.log
```

### Q5: 如何停止系统
**方法1**: 在启动窗口按 `Ctrl + C`

**方法2**: 关闭启动窗口

**方法3**: 使用任务管理器结束 node.exe 进程

---

## 📊 系统验证

部署完成后，依次验证以下功能：

### 1. 健康检查
访问: http://localhost:3001/health

预期结果:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2025-10-17T08:00:00.000Z"
}
```

### 2. 登录系统
访问: http://localhost:3001

默认账号:
- 用户名: `admin`
- 密码: `admin123`

### 3. 查询功能
登录后在主页面输入车牌号测试查询功能。

---

## 🎯 生产环境建议

### 1. 修改默认密码
首次登录后立即修改admin密码。

### 2. 配置网络共享
在 `.env` 文件中配置网络共享路径：
```env
NETWORK_SHARE_PATH=\\\\服务器IP\\共享文件夹
NETWORK_SHARE_USERNAME=用户名
NETWORK_SHARE_PASSWORD=密码
```

### 3. 定期备份数据库
数据库文件位置: `backend/database/sam_logs.db`

建议每天自动备份到其他位置。

### 4. 开启HTTPS（可选）
如需外网访问，建议配置HTTPS反向代理（使用Nginx或IIS）。

---

## 📞 技术支持

如遇到部署问题：

1. 查看 `TROUBLESHOOTING.md` 故障排查文档
2. 查看系统日志: `logs/` 目录
3. 查看 `README.md` 完整文档

---

## 🔄 升级说明

当有新版本时：

1. 备份数据库文件 `backend/database/sam_logs.db`
2. 停止当前运行的系统
3. 用新版本文件覆盖（保留.env和数据库）
4. 运行 `npm install` 更新依赖
5. 重新启动系统

---

**就是这么简单！**

只需要3个核心文件：
- ✅ `start.bat` - 启动
- ✅ `install-autostart.bat` - 自启动
- ✅ `uninstall-autostart.bat` - 卸载自启动

其他复杂的迁移、部署、验证脚本全部移除，让部署回归简单！
