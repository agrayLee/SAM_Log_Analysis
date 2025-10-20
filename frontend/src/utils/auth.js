import { api } from '../api/index'

// 本地存储的key
const USER_KEY = 'sam_log_user'
const TOKEN_KEY = 'sam_log_token'

// 用户状态管理
let currentUser = null

// 获取当前用户
export function getCurrentUser() {
  if (!currentUser) {
    const userStr = localStorage.getItem(USER_KEY)
    if (userStr) {
      try {
        currentUser = JSON.parse(userStr)
      } catch (e) {
        console.warn('解析用户信息失败:', e)
        removeUserInfo()
      }
    }
  }
  return currentUser
}

// 设置用户信息
export function setCurrentUser(user) {
  currentUser = user
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } else {
    removeUserInfo()
  }
}

// 移除用户信息
export function removeUserInfo() {
  currentUser = null
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(TOKEN_KEY)
}

// 检查认证状态
export async function checkAuth() {
  try {
    const response = await api.get('/auth/status')
    
    if (response.data.success && response.data.data.isAuthenticated) {
      setCurrentUser(response.data.data.user)
      return true
    } else {
      removeUserInfo()
      return false
    }
  } catch (error) {
    // 如果是首次登录需要修改密码的错误，返回特殊状态
    if (error.response?.status === 460) {
      return 'FIRST_LOGIN_PASSWORD_REQUIRED'
    }
    
    console.warn('检查认证状态失败:', error)
    removeUserInfo()
    return false
  }
}

// 登录
export async function login(username, password) {
  try {
    const response = await api.post('/auth/login', {
      username,
      password
    })

    if (response.data.success) {
      setCurrentUser(response.data.data.user)
      return {
        success: true,
        user: response.data.data.user
      }
    } else {
      return {
        success: false,
        message: response.data.message || '登录失败'
      }
    }
  } catch (error) {
    console.error('登录请求失败:', error)
    
    if (error.response && error.response.data) {
      return {
        success: false,
        message: error.response.data.message || '登录失败'
      }
    }
    
    return {
      success: false,
      message: '网络错误，请检查服务器连接'
    }
  }
}

// 登出
export async function logout() {
  try {
    await api.post('/auth/logout')
  } catch (error) {
    console.warn('登出请求失败:', error)
  } finally {
    removeUserInfo()
  }
}

// 获取用户资料
export async function getUserProfile() {
  try {
    const response = await api.get('/auth/profile')
    
    if (response.data.success) {
      setCurrentUser(response.data.data.user)
      return response.data.data.user
    }
    
    return null
  } catch (error) {
    console.error('获取用户资料失败:', error)
    return null
  }
}

// 检查用户是否为管理员
export function isAdmin() {
  const user = getCurrentUser()
  return user?.role === 'admin'
}

// 检查用户权限
export function hasPermission(permission) {
  const user = getCurrentUser()
  if (!user) return false
  
  // 管理员拥有所有权限
  if (user.role === 'admin') {
    return true
  }
  
  // 根据不同权限类型判断
  switch (permission) {
    case 'user_management':
      return user.role === 'admin'
    case 'audit_logs':
      return user.role === 'admin'
    case 'system_settings':
      return user.role === 'admin'
    case 'profile_edit':
      return true // 所有用户都可以编辑自己的资料
    default:
      return false
  }
}

// 检查是否可以访问指定用户的资源
export function canAccessUser(targetUserId) {
  const user = getCurrentUser()
  if (!user) return false
  
  // 管理员可以访问所有用户
  if (user.role === 'admin') {
    return true
  }
  
  // 普通用户只能访问自己的资源
  return user.id === targetUserId
}

// 获取用户角色显示名称
export function getRoleDisplayName(role) {
  const roleMap = {
    admin: '管理员',
    user: '普通用户'
  }
  return roleMap[role] || role
}

// 获取用户状态显示名称
export function getStatusDisplayName(status) {
  return status ? '正常' : '已禁用'
}
