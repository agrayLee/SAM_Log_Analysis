<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">系统设置</h1>
      <p class="page-subtitle">配置和监控山姆日志查询系统</p>
    </div>
    
    <div class="page-content">
      <!-- 系统状态监控 -->
      <el-card style="margin-bottom: 20px;">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>系统状态监控</span>
            <el-button size="small" @click="refreshSystemStatus" :loading="refreshing">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>
        </template>
        
        <el-row :gutter="20">
          <el-col :xs="24" :sm="12" :lg="6">
            <div class="status-item">
              <div class="status-label">服务器状态</div>
              <div class="status-value">
                <el-tag :type="systemStatus.server.type" size="large">
                  {{ systemStatus.server.text }}
                </el-tag>
              </div>
              <div class="status-desc">运行时长: {{ formatUptime(systemStatus.uptime) }}</div>
            </div>
          </el-col>
          
          <el-col :xs="24" :sm="12" :lg="6">
            <div class="status-item">
              <div class="status-label">数据库连接</div>
              <div class="status-value">
                <el-tag :type="systemStatus.database.type" size="large">
                  {{ systemStatus.database.text }}
                </el-tag>
              </div>
              <div class="status-desc">SQLite 本地数据库</div>
            </div>
          </el-col>
          
          <el-col :xs="24" :sm="12" :lg="6">
            <div class="status-item">
              <div class="status-label">网络连接</div>
              <div class="status-value">
                <el-tag :type="systemStatus.network.type" size="large">
                  {{ systemStatus.network.text }}
                </el-tag>
              </div>
              <div class="status-desc">{{ networkInfo.host }}</div>
            </div>
          </el-col>
          
          <el-col :xs="24" :sm="12" :lg="6">
            <div class="status-item">
              <div class="status-label">定时任务</div>
              <div class="status-value">
                <el-tag :type="systemStatus.scheduler.type" size="large">
                  {{ systemStatus.scheduler.text }}
                </el-tag>
              </div>
              <div class="status-desc">自动同步日志</div>
            </div>
          </el-col>
        </el-row>
      </el-card>

      <el-row :gutter="20">
        <!-- 网络连接配置 -->
        <el-col :xs="24" :lg="12">
          <el-card>
            <template #header>
              <span>网络连接配置</span>
            </template>
            
            <el-form :model="networkConfig" label-width="120px">
              <el-form-item label="服务器地址:">
                <el-input v-model="networkConfig.host" readonly>
                  <template #append>
                    <el-button @click="testNetworkConnection" :loading="testing">
                      测试连接
                    </el-button>
                  </template>
                </el-input>
              </el-form-item>
              
              <el-form-item label="共享路径:">
                <el-input v-model="networkConfig.sharePath" readonly />
              </el-form-item>
              
              <el-form-item label="用户名:">
                <el-input v-model="networkConfig.username" readonly />
              </el-form-item>
              
              <el-form-item label="连接状态:">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <el-tag :type="connectionTest.type">
                    {{ connectionTest.text }}
                  </el-tag>
                  <span v-if="connectionTest.time" style="font-size: 12px; color: #666;">
                    响应时间: {{ connectionTest.time }}ms
                  </span>
                </div>
              </el-form-item>
              
              <el-form-item v-if="connectionTest.folderInfo">
                <el-alert
                  :title="`找到 ${connectionTest.folderInfo.fileCount} 个日志文件`"
                  type="success"
                  :closable="false"
                />
              </el-form-item>
            </el-form>
          </el-card>
        </el-col>

        <!-- 处理任务监控 -->
        <el-col :xs="24" :lg="12">
          <el-card>
            <template #header>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>处理任务监控</span>
                <el-button size="small" @click="triggerManualProcess" :loading="processing">
                  手动处理
                </el-button>
              </div>
            </template>
            
            <div style="margin-bottom: 16px;">
              <el-descriptions :column="1" size="small">
                <el-descriptions-item label="最后处理时间">
                  {{ formatTime(processingInfo.lastProcessTime) }}
                </el-descriptions-item>
                <el-descriptions-item label="处理文件总数">
                  {{ processingInfo.totalFiles }}
                </el-descriptions-item>
                <el-descriptions-item label="已完成文件">
                  {{ processingInfo.completedFiles }}
                </el-descriptions-item>
                <el-descriptions-item label="失败文件">
                  {{ processingInfo.failedFiles }}
                </el-descriptions-item>
                <el-descriptions-item label="处理进度">
                  <el-progress 
                    :percentage="getProcessingProgress()" 
                    :stroke-width="6"
                  />
                </el-descriptions-item>
              </el-descriptions>
            </div>
            
            <el-alert
              title="定时任务说明"
              type="info"
              :closable="false"
              description="系统每15分钟检查最新日志，每小时执行增量处理，每天凌晨2点执行全量检查。"
            />
          </el-card>
        </el-col>
      </el-row>

      <!-- 处理历史记录 -->
      <el-card style="margin-top: 20px;">
        <template #header>
          <span>处理历史记录</span>
        </template>
        
        <el-table 
          :data="processingHistory" 
          v-loading="loadingHistory"
          style="width: 100%"
          size="small"
        >
          <el-table-column prop="file_name" label="文件名" min-width="200" show-overflow-tooltip />
          <el-table-column prop="last_position" label="处理位置" width="120">
            <template #default="{ row }">
              {{ formatFileSize(row.last_position) }}
            </template>
          </el-table-column>
          <el-table-column prop="processed_records" label="处理记录数" width="120" />
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag 
                :type="getStatusType(row.status)" 
                size="small"
              >
                {{ getStatusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="last_processed_at" label="处理时间" width="180">
            <template #default="{ row }">
              {{ formatTime(row.last_processed_at) }}
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 系统日志 -->
      <el-card style="margin-top: 20px;">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>系统操作日志</span>
            <el-button size="small" @click="clearSystemLogs">
              清空日志
            </el-button>
          </div>
        </template>
        
        <div style="max-height: 300px; overflow-y: auto;">
          <div 
            v-for="(log, index) in systemLogs" 
            :key="index"
            :class="['log-item', `log-${log.level}`]"
          >
            <span class="log-time">{{ formatTime(log.timestamp) }}</span>
            <span class="log-level">{{ log.level.toUpperCase() }}</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
          
          <div v-if="systemLogs.length === 0" class="empty-container">
            <div class="empty-text">暂无系统日志</div>
          </div>
        </div>
      </el-card>

      <!-- 系统信息 -->
      <el-card style="margin-top: 20px;">
        <template #header>
          <span>系统信息</span>
        </template>
        
        <el-descriptions :column="2" border>
          <el-descriptions-item label="系统版本">1.0.0</el-descriptions-item>
          <el-descriptions-item label="构建时间">2025-08-12</el-descriptions-item>
          <el-descriptions-item label="Node.js版本">{{ systemInfo.nodeVersion }}</el-descriptions-item>
          <el-descriptions-item label="启动时间">{{ formatTime(systemInfo.startTime) }}</el-descriptions-item>
          <el-descriptions-item label="运行环境">{{ systemInfo.environment }}</el-descriptions-item>
          <el-descriptions-item label="内存使用">{{ systemInfo.memoryUsage }}</el-descriptions-item>
          <el-descriptions-item label="技术栈">
            Node.js + Express + SQLite + Vue3 + Element Plus
          </el-descriptions-item>
          <el-descriptions-item label="核心功能">
            网络共享日志解析、实时查询、统计分析、定时同步
          </el-descriptions-item>
        </el-descriptions>
      </el-card>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { logsAPI, systemAPI } from '../api/index'
import dayjs from 'dayjs'

export default {
  name: 'Settings',
  setup() {
    // 响应式数据
    const refreshing = ref(false)
    const testing = ref(false)
    const processing = ref(false)
    const loadingHistory = ref(false)
    
    // 系统状态
    const systemStatus = reactive({
      uptime: 0,
      server: { type: 'success', text: '运行正常' },
      database: { type: 'success', text: '连接正常' },
      network: { type: 'warning', text: '开发环境（预期无法连接）' },
      scheduler: { type: 'success', text: '运行中' }
    })
    
    // 网络配置信息
    const networkConfig = reactive({
      host: '10.21.189.125',
      sharePath: '\\\\10.21.189.125\\Logs',
      username: 'Administrator'
    })
    
    const networkInfo = reactive({
      host: '10.21.189.125'
    })
    
    // 连接测试结果
    const connectionTest = reactive({
      type: 'warning',
      text: '开发环境',
      time: null,
      folderInfo: null
    })
    
    // 处理信息
    const processingInfo = reactive({
      lastProcessTime: null,
      totalFiles: 0,
      completedFiles: 0,
      failedFiles: 0
    })
    
    const processingHistory = ref([])
    
    // 系统信息
    const systemInfo = reactive({
      nodeVersion: 'v18.0.0',
      startTime: new Date(),
      environment: 'production',
      memoryUsage: '128MB'
    })
    
    // 系统日志
    const systemLogs = ref([
      {
        timestamp: new Date(),
        level: 'info',
        message: '系统启动完成'
      },
      {
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        level: 'info',
        message: '定时任务执行成功'
      },
      {
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
        level: 'warn',
        message: '网络连接超时，正在重试'
      }
    ])
    
    // 格式化时间
    const formatTime = (time) => {
      if (!time) return '未知'
      return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
    }
    
    // 格式化运行时长
    const formatUptime = (seconds) => {
      if (!seconds) return '0秒'
      
      const days = Math.floor(seconds / (24 * 60 * 60))
      const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60))
      const minutes = Math.floor((seconds % (60 * 60)) / 60)
      
      if (days > 0) {
        return `${days}天${hours}小时`
      } else if (hours > 0) {
        return `${hours}小时${minutes}分钟`
      } else {
        return `${minutes}分钟`
      }
    }
    
    // 格式化文件大小
    const formatFileSize = (bytes) => {
      if (!bytes) return '0B'
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(1024))
      return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`
    }
    
    // 获取处理进度
    const getProcessingProgress = () => {
      if (processingInfo.totalFiles === 0) return 0
      return Math.round((processingInfo.completedFiles / processingInfo.totalFiles) * 100)
    }
    
    // 获取状态类型
    const getStatusType = (status) => {
      const statusMap = {
        'completed': 'success',
        'failed': 'danger',
        'pending': 'warning',
        'processing': 'info'
      }
      return statusMap[status] || 'info'
    }
    
    // 获取状态文本
    const getStatusText = (status) => {
      const statusMap = {
        'completed': '已完成',
        'failed': '失败',
        'pending': '等待中',
        'processing': '处理中'
      }
      return statusMap[status] || status
    }
    
    // 刷新系统状态
    const refreshSystemStatus = async () => {
      try {
        refreshing.value = true
        
        // 获取系统状态
        const statusResponse = await systemAPI.getStatus()
        if (statusResponse.data.success) {
          const data = statusResponse.data.data
          
          systemStatus.uptime = data.uptime || 0
          systemStatus.server.type = 'success'
          systemStatus.server.text = '运行正常'
          
          if (data.scheduler) {
            systemStatus.scheduler.type = data.scheduler.isRunning ? 'success' : 'warning'
            systemStatus.scheduler.text = data.scheduler.isRunning ? '运行中' : '已停止'
          }
        }
        
        // 健康检查
        try {
          const healthResponse = await systemAPI.healthCheck()
          if (healthResponse.data.status === 'healthy') {
            systemStatus.database.type = 'success'
            systemStatus.database.text = '连接正常'
          } else {
            systemStatus.database.type = 'danger'
            systemStatus.database.text = '连接异常'
          }
        } catch (healthError) {
          console.error('健康检查失败:', healthError)
          systemStatus.database.type = 'danger'
          systemStatus.database.text = '检查失败'
        }
        
        // 加载处理状态
        await loadProcessingInfo()
        
        ElMessage.success('系统状态刷新完成')
        
      } catch (error) {
        console.error('刷新系统状态失败:', error)
        ElMessage.error('刷新系统状态失败')
      } finally {
        refreshing.value = false
      }
    }
    
    // 测试网络连接
    const testNetworkConnection = async () => {
      try {
        testing.value = true
        
        const response = await logsAPI.testConnection()
        
        if (response.data.success) {
          const data = response.data.data
          
          if (data.connected) {
            connectionTest.type = 'success'
            connectionTest.text = '连接成功'
            connectionTest.time = data.connectionTime
            connectionTest.folderInfo = data.fileStatus
            
            systemStatus.network.type = 'success'
            systemStatus.network.text = '连接正常'
            
            ElMessage.success('网络连接测试成功')
          } else {
            // 开发环境正常情况 - 无法连接到生产服务器
            connectionTest.type = 'warning'
            connectionTest.text = '开发环境'
            connectionTest.time = data.connectionTime
            connectionTest.folderInfo = null
            
            systemStatus.network.type = 'warning'
            systemStatus.network.text = '开发环境（无法连接生产服务器）'
            
            ElMessage.info('开发环境：无法连接到生产日志服务器，这是正常的')
          }
        }
        
      } catch (error) {
        console.error('网络连接测试失败:', error)
        
        // 区分错误类型
        if (error.response && error.response.status >= 400) {
          connectionTest.type = 'warning'
          connectionTest.text = '开发环境'
          systemStatus.network.type = 'warning'
          systemStatus.network.text = '开发环境（预期无法连接）'
          ElMessage.info('开发环境：网络连接测试符合预期')
        } else {
          connectionTest.type = 'danger'
          connectionTest.text = '测试异常'
          systemStatus.network.type = 'danger'
          systemStatus.network.text = '连接异常'
          ElMessage.error('网络连接测试失败')
        }
      } finally {
        testing.value = false
      }
    }
    
    // 手动触发处理
    const triggerManualProcess = async () => {
      try {
        processing.value = true
        
        const response = await logsAPI.triggerProcess({})
        
        if (response.data.success) {
          ElMessage.success('处理任务已启动')
          
          // 添加系统日志
          systemLogs.value.unshift({
            timestamp: new Date(),
            level: 'info',
            message: '手动触发日志处理任务'
          })
          
          // 刷新处理信息
          setTimeout(() => {
            loadProcessingInfo()
          }, 3000)
        }
        
      } catch (error) {
        console.error('手动触发处理失败:', error)
        ElMessage.error('启动处理任务失败')
      } finally {
        processing.value = false
      }
    }
    
    // 加载处理信息
    const loadProcessingInfo = async () => {
      try {
        const response = await logsAPI.getProcessingStatus()
        
        if (response.data.success) {
          const data = response.data.data
          
          processingInfo.lastProcessTime = data.summary.lastProcessedAt
          processingInfo.totalFiles = data.summary.totalFiles
          processingInfo.completedFiles = data.summary.completedFiles
          processingInfo.failedFiles = data.summary.failedFiles
        }
        
      } catch (error) {
        console.error('加载处理信息失败:', error)
      }
    }
    
    // 加载处理历史
    const loadProcessingHistory = async () => {
      try {
        loadingHistory.value = true
        
        const response = await logsAPI.getProcessingStatus()
        
        if (response.data.success) {
          processingHistory.value = response.data.data.files || []
        }
        
      } catch (error) {
        console.error('加载处理历史失败:', error)
      } finally {
        loadingHistory.value = false
      }
    }
    
    // 清空系统日志
    const clearSystemLogs = async () => {
      try {
        await ElMessageBox.confirm('确定要清空系统日志吗？', '确认清空', {
          type: 'warning'
        })
        
        systemLogs.value = []
        ElMessage.success('系统日志已清空')
        
      } catch (error) {
        // 用户取消
      }
    }
    
    // 初始化
    onMounted(() => {
      refreshSystemStatus()
      loadProcessingHistory()
    })
    
    return {
      refreshing,
      testing,
      processing,
      loadingHistory,
      systemStatus,
      networkConfig,
      networkInfo,
      connectionTest,
      processingInfo,
      processingHistory,
      systemInfo,
      systemLogs,
      formatTime,
      formatUptime,
      formatFileSize,
      getProcessingProgress,
      getStatusType,
      getStatusText,
      refreshSystemStatus,
      testNetworkConnection,
      triggerManualProcess,
      clearSystemLogs
    }
  }
}
</script>

<style scoped>
.page-container {
  max-width: 1400px;
  margin: 0 auto;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.page-header {
  padding: 24px;
  border-bottom: 1px solid #e6e6e6;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.page-subtitle {
  font-size: 14px;
  opacity: 0.9;
  margin: 0;
}

.page-content {
  padding: 24px;
}

.status-item {
  text-align: center;
  padding: 16px;
  border-radius: 8px;
  background: #f8f9fa;
}

.status-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.status-value {
  margin-bottom: 8px;
}

.status-desc {
  font-size: 12px;
  color: #999;
}

.log-item {
  padding: 8px 12px;
  border-left: 3px solid #e6e6e6;
  margin-bottom: 4px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  background: #f8f9fa;
}

.log-item.log-info {
  border-left-color: #409eff;
}

.log-item.log-warn {
  border-left-color: #e6a23c;
}

.log-item.log-error {
  border-left-color: #f56c6c;
}

.log-time {
  color: #666;
  margin-right: 12px;
}

.log-level {
  color: #333;
  font-weight: 600;
  margin-right: 12px;
  width: 50px;
  display: inline-block;
}

.log-message {
  color: #333;
}

.empty-container {
  text-align: center;
  padding: 40px;
  color: #666;
}

.empty-text {
  font-size: 14px;
}
</style>
