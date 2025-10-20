<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">日志记录查询</h1>
      <p class="page-subtitle">查询和管理山姆接口日志记录</p>
    </div>
    
    <div class="page-content">
      <!-- 筛选条件 -->
      <el-card class="filter-container" style="margin-bottom: 20px;">
        <template #header>
          <span>筛选条件</span>
        </template>
        
        <el-form :model="filters" inline>
          <el-form-item label="车牌号:">
            <el-input
              v-model="filters.plateNumber"
              placeholder="请输入车牌号"
              clearable
              style="width: 200px;"
            />
          </el-form-item>
          
          <el-form-item label="查询时间:">
            <el-date-picker
              v-model="filters.dateRange"
              type="datetimerange"
              range-separator="至"
              start-placeholder="开始时间"
              end-placeholder="结束时间"
              format="YYYY-MM-DD HH:mm:ss"
              value-format="YYYY-MM-DD HH:mm:ss"
              style="width: 320px;"
              @change="handleDateRangeChange"
            />
          </el-form-item>
          
          <el-form-item label="减免状态:">
            <el-select v-model="filters.freeParking" placeholder="请选择" clearable style="width: 150px;">
              <el-option label="全部" value="" />
              <el-option label="成功减免" value="true" />
              <el-option label="减免失败" value="false" />
            </el-select>
          </el-form-item>
          
          <el-form-item>
            <el-button type="primary" @click="handleSearch" :loading="loading">
              <el-icon><Search /></el-icon>
              查询
            </el-button>
            <el-button @click="handleReset">
              <el-icon><Refresh /></el-icon>
              重置
            </el-button>
            <el-button type="success" @click="handleExport" :loading="exporting">
              <el-icon><Download /></el-icon>
              导出
            </el-button>
            <el-button type="warning" @click="handleProcessLatest" :loading="processingLatest">
              <el-icon><Lightning /></el-icon>
              查询最新
            </el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 实时查询 -->
      <el-card style="margin-bottom: 20px;">
        <template #header>
          <span>实时车牌查询</span>
        </template>
        
        <el-form inline>
          <el-form-item label="车牌号:">
            <el-input
              v-model="realtimeQuery.plateNumber"
              placeholder="输入车牌号进行实时查询"
              style="width: 250px;"
              @keyup.enter="handleRealtimeSearch"
            />
          </el-form-item>
          
          <el-form-item label="查询天数:">
            <el-select v-model="realtimeQuery.days" style="width: 120px;">
              <el-option label="3天" :value="3" />
              <el-option label="7天" :value="7" />
              <el-option label="15天" :value="15" />
              <el-option label="30天" :value="30" />
            </el-select>
          </el-form-item>
          
          <el-form-item>
            <el-button type="warning" @click="handleRealtimeSearch" :loading="realtimeLoading">
              <el-icon><Lightning /></el-icon>
              实时查询
            </el-button>
          </el-form-item>
        </el-form>
        
        <!-- 实时查询结果 -->
        <div v-if="realtimeResults.length > 0" style="margin-top: 16px;">
          <el-alert
            :title="`找到 ${realtimeResults.length} 条相关记录`"
            type="success"
            :closable="false"
            style="margin-bottom: 12px;"
          />
          
          <el-table :data="realtimeResults" size="small" max-height="200">
            <el-table-column prop="plate_number" label="车牌号" width="120" />
            <el-table-column prop="call_time" label="查询时间" width="180">
              <template #default="{ row }">
                {{ formatTime(row.call_time) }}
              </template>
            </el-table-column>
            <el-table-column prop="free_parking" label="减免状态" width="120">
              <template #default="{ row }">
                <el-tag :type="row.free_parking ? 'success' : 'danger'" size="small">
                  {{ row.free_parking ? '✅成功' : '❌失败' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="reject_reason" label="失败原因" show-overflow-tooltip />

          </el-table>
        </div>
      </el-card>

      <!-- 数据表格 -->
      <el-card>
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>日志记录 (共 {{ pagination.total }} 条)</span>
            <div>
              <el-button size="small" @click="handleRefresh" :loading="loading">
                <el-icon><Refresh /></el-icon>
                刷新
              </el-button>
            </div>
          </div>
        </template>
        
        <el-table
          :data="records"
          v-loading="loading"
          style="width: 100%"
          stripe
          @sort-change="handleSortChange"
        >
          <el-table-column type="index" label="#" width="60" />
          
          <el-table-column prop="plate_number" label="车牌号" width="120" sortable="custom">
            <template #default="{ row }">
              <el-button type="text" @click="handleViewPlateHistory(row.plate_number)">
                {{ row.plate_number }}
              </el-button>
            </template>
          </el-table-column>
          
          <el-table-column prop="call_time" label="查询时间" width="180" sortable="custom">
            <template #default="{ row }">
              {{ formatTime(row.call_time) }}
            </template>
          </el-table-column>
          
          <el-table-column prop="response_time" label="响应时间" width="180">
            <template #default="{ row }">
              {{ row.response_time ? formatTime(row.response_time) : '-' }}
            </template>
          </el-table-column>
          
          <el-table-column prop="free_parking" label="减免状态" width="120">
            <template #default="{ row }">
              <el-tag :type="row.free_parking ? 'success' : 'danger'" size="small">
                {{ row.free_parking ? '✅成功' : '❌失败' }}
              </el-tag>
            </template>
          </el-table-column>
          
          <el-table-column prop="reject_reason" label="失败原因" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <span v-if="row.reject_reason" style="color: #f56c6c;">
                {{ row.reject_reason }}
              </span>
              <span v-else style="color: #909399;">-</span>
            </template>
          </el-table-column>
          

          
          <el-table-column prop="created_at" label="入库时间" width="180">
            <template #default="{ row }">
              {{ formatTime(row.created_at) }}
            </template>
          </el-table-column>
          
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button type="text" size="small" @click="handleViewDetails(row)">
                详情
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 分页 -->
        <div style="margin-top: 20px; text-align: center;">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.limit"
            :page-sizes="[20, 50, 100, 200]"
            :total="pagination.total"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handlePageSizeChange"
            @current-change="handlePageChange"
          />
        </div>
      </el-card>
    </div>

    <!-- 记录详情对话框 -->
    <el-dialog v-model="detailVisible" title="记录详情" width="600px">
      <div v-if="selectedRecord">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="车牌号">
            {{ selectedRecord.plate_number }}
          </el-descriptions-item>
          <el-descriptions-item label="查询时间">
            {{ formatTime(selectedRecord.call_time) }}
          </el-descriptions-item>
          <el-descriptions-item label="响应时间">
            {{ selectedRecord.response_time ? formatTime(selectedRecord.response_time) : '无响应' }}
          </el-descriptions-item>
          <el-descriptions-item label="减免状态">
            <el-tag :type="selectedRecord.free_parking ? 'success' : 'danger'">
              {{ selectedRecord.free_parking ? '成功减免' : '减免失败' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="失败原因">
            {{ selectedRecord.reject_reason || '无' }}
          </el-descriptions-item>

          <el-descriptions-item label="入库时间">
            {{ formatTime(selectedRecord.created_at) }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>

    <!-- 最新日志处理进度对话框 -->
    <el-dialog 
      v-model="progressVisible" 
      title="查询最新日志" 
      width="700px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <div class="progress-container">
        <!-- 总体进度 -->
        <div class="progress-header">
          <h4>处理进度</h4>
          <el-progress 
            :percentage="progressInfo.percentage" 
            :status="progressInfo.status"
            :stroke-width="12"
          />
        </div>

        <!-- 当前步骤 -->
        <div class="current-step" v-if="progressInfo.currentMessage">
          <el-alert 
            :title="progressInfo.currentMessage" 
            :type="progressInfo.alertType"
            :closable="false"
            style="margin: 16px 0;"
          />
        </div>

        <!-- 进度日志 -->
        <div class="progress-logs">
          <div class="logs-header">
            <span>处理日志</span>
            <el-button 
              size="small" 
              type="text" 
              @click="clearProgressLogs"
              v-if="progressLogs.length > 0"
            >
              清空
            </el-button>
          </div>
          
          <div class="logs-content" ref="logsContainer">
            <div 
              v-for="(log, index) in progressLogs" 
              :key="index"
              class="log-item"
              :class="[
                'log-' + log.type,
                { 'log-expanded': log.expanded }
              ]"
            >
              <div class="log-main" @click="toggleLogExpand(index)">
                <span class="log-time">{{ formatTime(log.timestamp) }}</span>
                <span class="log-type" :class="'type-' + log.type">
                  {{ getLogTypeText(log.type) }}
                </span>
                <span class="log-message">{{ log.message }}</span>
                <el-icon v-if="log.data" class="expand-icon">
                  <ArrowRight v-if="!log.expanded" />
                  <ArrowDown v-else />
                </el-icon>
              </div>
              
              <!-- 详细数据 -->
              <div v-if="log.expanded && log.data" class="log-details">
                <pre>{{ JSON.stringify(log.data, null, 2) }}</pre>
              </div>

              <!-- 错误堆栈 -->
              <div v-if="log.expanded && log.error" class="log-error">
                <p><strong>错误详情：</strong>{{ log.error }}</p>
                <pre v-if="log.stack">{{ log.stack }}</pre>
              </div>
            </div>

            <!-- 空状态 -->
            <div v-if="progressLogs.length === 0" class="empty-logs">
              暂无处理日志
            </div>
          </div>
        </div>

        <!-- 汇总信息 -->
        <div v-if="progressSummary" class="progress-summary">
          <el-descriptions title="处理汇总" :column="2" border size="small">
            <el-descriptions-item label="处理文件数">
              {{ progressSummary.processedFiles || 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="新增记录数">
              {{ progressSummary.totalNewRecords || 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="开始时间">
              {{ progressSummary.timeRange?.from ? formatTime(progressSummary.timeRange.from) : '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="结束时间">
              {{ progressSummary.timeRange?.to ? formatTime(progressSummary.timeRange.to) : '-' }}
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button 
            @click="stopProcessLatest" 
            :disabled="!processingLatest"
            type="danger"
          >
            停止处理
          </el-button>
          <el-button 
            @click="closeProgressDialog" 
            type="primary"
            :disabled="processingLatest"
          >
            关闭
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { logsAPI } from '../api/index'
import dayjs from 'dayjs'

export default {
  name: 'LogRecords',
  setup() {
    // 响应式数据
    const loading = ref(false)
    const exporting = ref(false)
    const realtimeLoading = ref(false)
    const detailVisible = ref(false)
    const processingLatest = ref(false)
    const progressVisible = ref(false)
    
    const records = ref([])
    const selectedRecord = ref(null)
    const realtimeResults = ref([])
    
    // 筛选条件
    const filters = reactive({
      plateNumber: '',
      dateRange: [],
      freeParking: ''
    })
    
    // 实时查询
    const realtimeQuery = reactive({
      plateNumber: '',
      days: 7
    })
    
    // 分页信息
    const pagination = reactive({
      page: 1,
      limit: 50,
      total: 0,
      orderBy: 'call_time',
      orderDirection: 'DESC'
    })

    // 最新日志处理相关
    const progressInfo = reactive({
      percentage: 0,
      status: '',
      currentMessage: '',
      alertType: 'info'
    })
    
    const progressLogs = ref([])
    const progressSummary = ref(null)
    let sseConnection = null
    
    // 格式化时间
    const formatTime = (time) => {
      if (!time) return '-'
      
      // 处理不同的时间格式
      let parsedTime
      
      // 如果是带逗号的格式 (2025-08-11 22:39:09,129)
      if (typeof time === 'string' && time.includes(',')) {
        parsedTime = dayjs(time.replace(',', '.'))
      }
      // 如果是ISO格式或其他标准格式
      else {
        parsedTime = dayjs(time)
      }
      
      // 检查是否是有效日期
      if (!parsedTime.isValid()) {
        console.warn('Invalid date:', time)
        return '-'
      }
      
      // 格式化为本地时间
      return parsedTime.format('YYYY-MM-DD HH:mm:ss')
    }
    
    // 加载数据
    const loadRecords = async () => {
      try {
        loading.value = true
        
        const params = {
          page: pagination.page,
          limit: pagination.limit,
          orderBy: pagination.orderBy,
          orderDirection: pagination.orderDirection
        }
        
        // 添加筛选条件
        if (filters.plateNumber) {
          params.plateNumber = filters.plateNumber
        }
        
        if (filters.dateRange && filters.dateRange.length === 2) {
          // 确保日期格式正确 - 转换为标准格式
          const startDate = dayjs(filters.dateRange[0]).format('YYYY-MM-DD HH:mm:ss')
          const endDate = dayjs(filters.dateRange[1]).format('YYYY-MM-DD HH:mm:ss')
          params.startDate = startDate
          params.endDate = endDate
        }
        
        if (filters.freeParking !== '') {
          params.freeParking = filters.freeParking
        }
        
        const response = await logsAPI.getRecords(params)
        
        if (response.data.success) {
          const data = response.data.data
          records.value = data.records
          pagination.total = data.pagination.total
        }
        
      } catch (error) {
        console.error('加载记录失败:', error)
        ElMessage.error('加载数据失败')
      } finally {
        loading.value = false
      }
    }
    
    // 处理日期范围变化（优化UX：结束日期自动设为当天23:59:59）
    const handleDateRangeChange = (dateRange) => {
      if (dateRange && dateRange.length === 2) {
        const [startDate, endDate] = dateRange
        
        // 如果结束日期的时间部分是00:00:00，自动调整为23:59:59
        if (endDate && endDate.endsWith('00:00:00')) {
          const endDateOnly = endDate.split(' ')[0] // 获取日期部分
          filters.dateRange[1] = `${endDateOnly} 23:59:59`
        }
      }
    }
    
    // 搜索
    const handleSearch = () => {
      pagination.page = 1
      loadRecords()
    }
    
    // 重置
    const handleReset = () => {
      filters.plateNumber = ''
      filters.dateRange = []
      filters.freeParking = ''
      realtimeResults.value = []
      pagination.page = 1
      loadRecords()
    }
    
    // 刷新
    const handleRefresh = () => {
      loadRecords()
    }
    
    // 排序
    const handleSortChange = ({ prop, order }) => {
      if (prop) {
        pagination.orderBy = prop
        pagination.orderDirection = order === 'ascending' ? 'ASC' : 'DESC'
        loadRecords()
      }
    }
    
    // 分页变化
    const handlePageChange = (page) => {
      pagination.page = page
      loadRecords()
    }
    
    const handlePageSizeChange = (size) => {
      pagination.limit = size
      pagination.page = 1
      loadRecords()
    }
    
    // 实时查询
    const handleRealtimeSearch = async () => {
      if (!realtimeQuery.plateNumber.trim()) {
        ElMessage.warning('请输入车牌号')
        return
      }
      
      try {
        realtimeLoading.value = true
        
        const response = await logsAPI.getRealtimeRecords(
          realtimeQuery.plateNumber,
          { days: realtimeQuery.days }
        )
        
        if (response.data.success) {
          realtimeResults.value = response.data.data.records
          
          if (realtimeResults.value.length === 0) {
            ElMessage.info(`未找到车牌 ${realtimeQuery.plateNumber} 的相关记录`)
          } else {
            ElMessage.success(`找到 ${realtimeResults.value.length} 条相关记录`)
          }
        }
        
      } catch (error) {
        console.error('实时查询失败:', error)
        ElMessage.error('实时查询失败')
      } finally {
        realtimeLoading.value = false
      }
    }
    
    // 查看车牌历史
    const handleViewPlateHistory = (plateNumber) => {
      filters.plateNumber = plateNumber
      filters.dateRange = []
      filters.freeParking = ''
      pagination.page = 1
      loadRecords()
      
      // 滚动到筛选区域
      document.querySelector('.filter-container')?.scrollIntoView({ 
        behavior: 'smooth' 
      })
    }
    
    // 查看详情
    const handleViewDetails = (record) => {
      selectedRecord.value = record
      detailVisible.value = true
    }
    
    // 导出数据
    const handleExport = async () => {
      try {
        await ElMessageBox.confirm(
          '确定要导出当前筛选条件下的数据吗？', 
          '确认导出', 
          { type: 'warning' }
        )
        
        exporting.value = true
        
        const params = {
          format: 'csv'
        }
        
        // 添加筛选条件
        if (filters.plateNumber) {
          params.plateNumber = filters.plateNumber
        }
        
        if (filters.dateRange && filters.dateRange.length === 2) {
          // 确保日期格式正确 - 转换为标准格式
          const startDate = dayjs(filters.dateRange[0]).format('YYYY-MM-DD HH:mm:ss')
          const endDate = dayjs(filters.dateRange[1]).format('YYYY-MM-DD HH:mm:ss')
          params.startDate = startDate
          params.endDate = endDate
        }
        
        if (filters.freeParking !== '') {
          params.freeParking = filters.freeParking
        }
        
        const response = await logsAPI.exportData(params)
        
        // 创建下载链接
        const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `sam_logs_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        
        ElMessage.success('数据导出成功')
        
      } catch (error) {
        if (error !== 'cancel') {
          console.error('导出失败:', error)
          ElMessage.error('数据导出失败')
        }
      } finally {
        exporting.value = false
      }
    }

    // 处理最新日志查询
    const handleProcessLatest = async () => {
      try {
        await ElMessageBox.confirm(
          '确定要查询最新日志吗？\n系统将从上次处理时间开始分析到当前时间的所有新记录。', 
          '确认查询最新日志', 
          { 
            type: 'warning',
            confirmButtonText: '开始查询',
            cancelButtonText: '取消'
          }
        )

        // 重置进度信息
        resetProgressInfo()
        
        // 显示进度对话框
        progressVisible.value = true
        processingLatest.value = true

        // 启动SSE连接
        sseConnection = logsAPI.processLatest(
          // 事件处理函数
          (eventType, data) => {
            handleSSEEvent(eventType, data)
          },
          // 错误处理函数
          (error) => {
            console.error('SSE连接错误:', error)
            addProgressLog('error', 'SSE连接出错', null, error.message)
            stopProcessLatest()
          }
        )

      } catch (error) {
        if (error !== 'cancel') {
          console.error('启动最新日志查询失败:', error)
          ElMessage.error('启动查询失败')
        }
      }
    }

    // 处理SSE事件
    const handleSSEEvent = (eventType, data) => {
      console.log('SSE事件:', eventType, data)

      switch (eventType) {
        case 'start':
          progressInfo.currentMessage = data.message
          progressInfo.alertType = 'info'
          progressInfo.percentage = 0
          progressInfo.status = ''
          addProgressLog('start', data.message)
          break

        case 'progress':
          progressInfo.currentMessage = data.message
          progressInfo.alertType = 'info'
          progressInfo.percentage = data.progress || 0
          progressInfo.status = ''
          addProgressLog('progress', data.message, data.data)
          break

        case 'warning':
          progressInfo.alertType = 'warning'
          addProgressLog('warning', data.message, data.data)
          break

        case 'error':
          progressInfo.currentMessage = data.message
          progressInfo.alertType = 'error'
          progressInfo.status = 'exception'
          addProgressLog('error', data.message, data.data, data.error)
          
          // 如果是严重错误，自动停止
          if (data.code === 'NETWORK_CONNECTION_FAILED') {
            setTimeout(() => {
              stopProcessLatest()
            }, 3000)
          }
          break

        case 'completed':
          progressInfo.currentMessage = data.message
          progressInfo.alertType = 'success'
          progressInfo.percentage = 100
          progressInfo.status = 'success'
          progressSummary.value = data.summary
          addProgressLog('completed', data.message, data.summary)
          
          // 处理完成，自动刷新数据
          setTimeout(() => {
            loadRecords()
            ElMessage.success(`处理完成！新增 ${data.summary?.totalNewRecords || 0} 条记录`)
          }, 1000)
          
          // 3秒后自动停止
          setTimeout(() => {
            stopProcessLatest()
          }, 3000)
          break

        default:
          console.warn('未知SSE事件类型:', eventType)
      }

      // 自动滚动到日志底部
      nextTick(() => {
        scrollLogsToBottom()
      })
    }

    // 停止处理最新日志
    const stopProcessLatest = () => {
      if (sseConnection) {
        sseConnection.close()
        sseConnection = null
      }
      
      processingLatest.value = false
      
      if (progressInfo.status !== 'success') {
        progressInfo.currentMessage = '处理已停止'
        progressInfo.alertType = 'warning'
        addProgressLog('stop', '用户停止了处理')
      }
    }

    // 关闭进度对话框
    const closeProgressDialog = () => {
      if (processingLatest.value) {
        stopProcessLatest()
      }
      
      progressVisible.value = false
    }

    // 重置进度信息
    const resetProgressInfo = () => {
      progressInfo.percentage = 0
      progressInfo.status = ''
      progressInfo.currentMessage = ''
      progressInfo.alertType = 'info'
      progressLogs.value = []
      progressSummary.value = null
    }

    // 添加进度日志
    const addProgressLog = (type, message, data = null, error = null) => {
      progressLogs.value.push({
        type,
        message,
        data,
        error,
        timestamp: new Date().toISOString(),
        expanded: false
      })

      // 限制日志数量，避免内存占用过多
      if (progressLogs.value.length > 100) {
        progressLogs.value = progressLogs.value.slice(-50)
      }
    }

    // 清空进度日志
    const clearProgressLogs = () => {
      progressLogs.value = []
    }

    // 切换日志展开状态
    const toggleLogExpand = (index) => {
      const log = progressLogs.value[index]
      if (log && (log.data || log.error)) {
        log.expanded = !log.expanded
      }
    }

    // 获取日志类型文本
    const getLogTypeText = (type) => {
      const typeMap = {
        start: '开始',
        progress: '进度',
        warning: '警告',
        error: '错误',
        completed: '完成',
        stop: '停止'
      }
      return typeMap[type] || type
    }

    // 滚动日志到底部
    const scrollLogsToBottom = () => {
      const container = document.querySelector('.logs-content')
      if (container) {
        container.scrollTop = container.scrollHeight
      }
    }
    
    // 初始化
    onMounted(() => {
      loadRecords()
    })
    
    return {
      loading,
      exporting,
      realtimeLoading,
      detailVisible,
      processingLatest,
      progressVisible,
      records,
      selectedRecord,
      realtimeResults,
      filters,
      realtimeQuery,
      pagination,
      progressInfo,
      progressLogs,
      progressSummary,
      formatTime,
      handleDateRangeChange,
      handleSearch,
      handleReset,
      handleRefresh,
      handleSortChange,
      handlePageChange,
      handlePageSizeChange,
      handleRealtimeSearch,
      handleViewPlateHistory,
      handleViewDetails,
      handleExport,
      handleProcessLatest,
      stopProcessLatest,
      closeProgressDialog,
      clearProgressLogs,
      toggleLogExpand,
      getLogTypeText
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
  opacity: 1;
  margin: 0;
  color: #ffffff;
  font-weight: 500;
}

.page-content {
  padding: 24px;
}

.filter-container {
  background: #f8f9fa;
}

:deep(.el-card__header) {
  background: #fff;
  border-bottom: 1px solid #e6e6e6;
}

:deep(.el-table th) {
  background: #fafafa;
}

:deep(.el-button--text) {
  color: #409eff;
}

:deep(.el-button--text:hover) {
  color: #66b1ff;
}

/* 进度对话框样式 */
.progress-container {
  max-height: 600px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.progress-header {
  margin-bottom: 20px;
}

.progress-header h4 {
  margin: 0 0 12px 0;
  color: #333;
  font-size: 16px;
}

.current-step {
  margin-bottom: 16px;
}

.progress-logs {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 200px;
  max-height: 300px;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 600;
  color: #666;
}

.logs-content {
  flex: 1;
  overflow-y: auto;
  border: 1px solid #e6e6e6;
  border-radius: 6px;
  background: #fafafa;
  padding: 12px;
  max-height: 250px;
}

.log-item {
  margin-bottom: 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.log-main {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.log-main:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

.log-time {
  font-size: 12px;
  color: #999;
  margin-right: 12px;
  min-width: 60px;
}

.log-type {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 12px;
  margin-right: 12px;
  font-weight: 500;
  min-width: 50px;
  text-align: center;
}

.type-start {
  background: #e1f3d8;
  color: #67c23a;
}

.type-progress {
  background: #e6f7ff;
  color: #409eff;
}

.type-warning {
  background: #fdf6ec;
  color: #e6a23c;
}

.type-error {
  background: #fef0f0;
  color: #f56c6c;
}

.type-completed {
  background: #f0f9ff;
  color: #67c23a;
}

.type-stop {
  background: #f5f5f5;
  color: #909399;
}

.log-message {
  flex: 1;
  font-size: 14px;
  color: #333;
}

.expand-icon {
  margin-left: 8px;
  color: #999;
  font-size: 12px;
  transition: transform 0.2s;
}

.log-expanded .expand-icon {
  transform: rotate(90deg);
}

.log-details {
  margin-top: 8px;
  padding: 12px;
  background: #fff;
  border: 1px solid #e6e6e6;
  border-radius: 4px;
  margin-left: 24px;
}

.log-details pre {
  margin: 0;
  font-size: 12px;
  color: #666;
  white-space: pre-wrap;
  word-break: break-all;
}

.log-error {
  margin-top: 8px;
  padding: 12px;
  background: #fef0f0;
  border: 1px solid #fbc4c4;
  border-radius: 4px;
  margin-left: 24px;
}

.log-error p {
  margin: 0 0 8px 0;
  color: #f56c6c;
  font-size: 14px;
}

.log-error pre {
  margin: 0;
  font-size: 12px;
  color: #999;
  white-space: pre-wrap;
  word-break: break-all;
}

.empty-logs {
  text-align: center;
  color: #999;
  padding: 40px;
  font-size: 14px;
}

.progress-summary {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e6e6e6;
}

/* 不同日志类型的左边框样式 */
.log-start {
  border-left: 3px solid #67c23a;
}

.log-progress {
  border-left: 3px solid #409eff;
}

.log-warning {
  border-left: 3px solid #e6a23c;
}

.log-error {
  border-left: 3px solid #f56c6c;
}

.log-completed {
  border-left: 3px solid #67c23a;
}

.log-stop {
  border-left: 3px solid #909399;
}

/* 对话框底部按钮样式 */
.dialog-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
</style>
