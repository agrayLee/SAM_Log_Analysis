import axios from 'axios'
import { ElMessage } from 'element-plus'

// 创建axios实例
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true, // 支持跨域Cookie
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 添加请求头
    config.headers['Content-Type'] = 'application/json'
    
    // 可以在这里添加token（如果使用token认证）
    // const token = localStorage.getItem('token')
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`
    // }
    
    return config
  },
  (error) => {
    console.error('请求拦截器错误:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    console.error('API请求错误:', error)
    
    // 处理常见错误
    if (error.response) {
      const { status, data } = error.response
      
      switch (status) {
        case 401:
          ElMessage.error('登录已过期，请重新登录')
          // 清除本地用户信息
          localStorage.removeItem('sam_log_user')
          // 跳转到登录页
          if (window.location.pathname !== '/login') {
            window.location.href = '/login'
          }
          break
          
        case 403:
          ElMessage.error('没有权限访问此资源')
          break
          
        case 404:
          ElMessage.error('请求的资源不存在')
          break
          
        case 500:
          ElMessage.error('服务器内部错误')
          break
          
        default:
          const message = data?.message || `请求失败 (${status})`
          ElMessage.error(message)
      }
    } else if (error.request) {
      ElMessage.error('网络连接失败，请检查网络或服务器状态')
    } else {
      ElMessage.error('请求配置错误')
    }
    
    return Promise.reject(error)
  }
)

// API方法封装
export { api }

// 认证相关API
export const authAPI = {
  // 登录
  login: (username, password) => api.post('/auth/login', { username, password }),
  
  // 登出
  logout: () => api.post('/auth/logout'),
  
  // 获取用户信息
  getProfile: () => api.get('/auth/profile'),
  
  // 检查登录状态
  getStatus: () => api.get('/auth/status'),
  
  // 修改密码
  changePassword: (data) => api.post('/auth/change-password', data)
}

// 日志相关API
export const logsAPI = {
  // 获取日志记录
  getRecords: (params) => api.get('/logs/records', { params }),
  
  // 获取统计信息
  getStatistics: (params) => api.get('/logs/statistics', { params }),
  
  // 实时查询车牌
  getRealtimeRecords: (plateNumber, params) => 
    api.get(`/logs/realtime/${plateNumber}`, { params }),
  
  // 手动触发处理
  triggerProcess: (data) => api.post('/logs/process', data),
  
  // 获取处理状态
  getProcessingStatus: () => api.get('/logs/processing-status'),
  
  // 测试网络连接
  testConnection: () => api.get('/logs/test-connection'),
  
  // 导出数据
  exportData: (params) => api.get('/logs/export', { 
    params,
    responseType: 'blob' // 用于文件下载
  }),

  // 增量处理最新日志（Server-Sent Events）
  processLatest: (onEvent, onError) => {
    const eventSource = new EventSource('/api/logs/process-latest', {
      withCredentials: true
    });

    // 监听所有事件类型
    const eventTypes = ['start', 'progress', 'warning', 'error', 'completed'];
    
    eventTypes.forEach(eventType => {
      eventSource.addEventListener(eventType, (event) => {
        try {
          const data = JSON.parse(event.data);
          onEvent(eventType, data);
        } catch (parseError) {
          console.error('解析SSE数据失败:', parseError);
          onError && onError(parseError);
        }
      });
    });

    // 处理连接错误
    eventSource.onerror = (error) => {
      console.error('SSE连接错误:', error);
      onError && onError(error);
      
      // 自动关闭连接
      if (eventSource.readyState === EventSource.CLOSED) {
        console.log('SSE连接已关闭');
      }
    };

    // 返回EventSource实例，以便手动关闭
    return eventSource;
  }
}

// 用户管理API
export const userAPI = {
  // 获取用户列表
  getUsers: (params) => api.get('/users', { params }),
  
  // 获取指定用户信息
  getUser: (id) => api.get(`/users/${id}`),
  
  // 创建用户
  createUser: (data) => api.post('/users', data),
  
  // 更新用户信息
  updateUser: (id, data) => api.put(`/users/${id}`, data),
  
  // 删除用户
  deleteUser: (id) => api.delete(`/users/${id}`),
  
  // 重置密码
  resetPassword: (id) => api.post(`/users/${id}/reset-password`),
  
  // 修改密码
  changePassword: (id, data) => api.post(`/users/${id}/change-password`, data),
  
  // 批量操作
  batchAction: (data) => api.post('/users/batch-action', data),
  
  // 获取审计日志
  getAuditLogs: (params) => api.get('/users/audit/logs', { params })
}

// 系统相关API
export const systemAPI = {
  // 获取系统状态
  getStatus: () => api.get('/status'),
  
  // 健康检查
  healthCheck: () => api.get('/health')
}
