<template>
  <el-container class="layout-container">
    <!-- 顶部导航 -->
    <el-header class="layout-header" height="60px">
      <div style="display: flex; align-items: center; justify-content: space-between; height: 100%; padding: 0 24px;">
        <div style="display: flex; align-items: center;">
          <h2 style="margin: 0; color: #333; font-size: 18px;">山姆日志查询系统</h2>
          <el-divider direction="vertical" />
          <span style="color: #666;">{{ getPageTitle() }}</span>
        </div>
        
        <div style="display: flex; align-items: center; gap: 16px;">
          <!-- 系统状态指示器 -->
          <el-tooltip content="系统运行状态">
            <el-badge :is-dot="true" :type="systemStatus.type">
              <el-icon size="20"><Monitor /></el-icon>
            </el-badge>
          </el-tooltip>
          
          <!-- 用户菜单 -->
          <el-dropdown @command="handleUserCommand">
            <span style="display: flex; align-items: center; cursor: pointer; color: #333;">
              <el-icon style="margin-right: 8px;"><User /></el-icon>
              {{ currentUser?.username || '用户' }}
              <el-icon style="margin-left: 4px;"><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <el-icon><User /></el-icon>
                  个人资料
                </el-dropdown-item>
                <el-dropdown-item command="settings">
                  <el-icon><Setting /></el-icon>
                  系统设置
                </el-dropdown-item>
                <el-dropdown-item command="users" v-if="currentUser?.role === 'admin'">
                  <el-icon><UserFilled /></el-icon>
                  账号管理
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </el-header>

    <el-container>
      <!-- 侧边导航 -->
      <el-aside class="layout-sidebar" :width="sidebarWidth">
        <el-menu
          :default-active="activeMenu"
          router
          :collapse="isCollapse"
          style="border-right: none; height: 100%;"
        >
          <el-menu-item index="/records">
            <el-icon><Document /></el-icon>
            <span>日志记录</span>
          </el-menu-item>
          <el-menu-item index="/settings">
            <el-icon><Setting /></el-icon>
            <span>系统设置</span>
          </el-menu-item>
          <!-- 用户管理功能已临时禁用
          <el-menu-item index="/users" v-if="currentUser?.role === 'admin'">
            <el-icon><UserFilled /></el-icon>
            <span>账号管理</span>
          </el-menu-item>
          -->
        </el-menu>
        
        <!-- 侧边栏折叠按钮 -->
        <div class="sidebar-toggle" @click="toggleSidebar">
          <el-icon>
            <component :is="isCollapse ? 'Expand' : 'Fold'" />
          </el-icon>
        </div>
      </el-aside>

      <!-- 主内容区 -->
      <el-main class="layout-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getCurrentUser, logout } from '../utils/auth'
import { systemAPI } from '../api/index'

export default {
  name: 'Layout',
  setup() {
    const router = useRouter()
    const route = useRoute()
    
    const currentUser = ref(getCurrentUser())
    const isCollapse = ref(false)
    const systemStatus = ref({
      type: 'success',
      text: '正常'
    })
    
    // 计算属性
    const activeMenu = computed(() => route.path)
    const sidebarWidth = computed(() => isCollapse.value ? '64px' : '240px')
    
    // 获取页面标题
    const getPageTitle = () => {
      const titleMap = {
        '/records': '日志记录',
        '/settings': '系统设置',
        '/users': '账号管理',
        '/profile': '个人资料'
      }
      return titleMap[route.path] || '日志记录'
    }
    
    // 切换侧边栏
    const toggleSidebar = () => {
      isCollapse.value = !isCollapse.value
    }
    
    // 加载系统状态
    const loadSystemStatus = async () => {
      try {
        const response = await systemAPI.getStatus()
        if (response.data.success) {
          systemStatus.value.type = 'success'
          systemStatus.value.text = '正常运行'
        }
      } catch (error) {
        systemStatus.value.type = 'danger'
        systemStatus.value.text = '异常'
      }
    }
    
    // 处理用户菜单
    const handleUserCommand = async (command) => {
      switch (command) {
        case 'profile':
          router.push('/profile')
          break
        case 'settings':
          router.push('/settings')
          break
              // case 'users':
      //   router.push('/users')
      //   break
        case 'logout':
          await handleLogout()
          break
      }
    }
    
    // 退出登录
    const handleLogout = async () => {
      try {
        await ElMessageBox.confirm('确定要退出登录吗？', '确认退出', {
          type: 'warning'
        })
        
        await logout()
        ElMessage.success('已退出登录')
        router.push('/login')
      } catch (error) {
        // 用户取消
      }
    }
    
    // 初始化
    onMounted(() => {
      loadSystemStatus()
      
      // 在小屏幕上默认折叠侧边栏
      if (window.innerWidth < 768) {
        isCollapse.value = true
      }
      
      // 监听窗口大小变化
      window.addEventListener('resize', () => {
        if (window.innerWidth < 768) {
          isCollapse.value = true
        }
      })
    })
    
    return {
      currentUser,
      isCollapse,
      systemStatus,
      activeMenu,
      sidebarWidth,
      getPageTitle,
      toggleSidebar,
      handleUserCommand
    }
  }
}
</script>

<style scoped>
.layout-container {
  min-height: 100vh;
}

.layout-header {
  background: #fff;
  border-bottom: 1px solid #e6e6e6;
  box-shadow: 0 2px 4px rgba(0,0,0,.12), 0 0 6px rgba(0,0,0,.04);
  z-index: 1001;
}

.layout-sidebar {
  background: #fff;
  border-right: 1px solid #e6e6e6;
  position: relative;
  transition: width 0.3s ease;
}

.sidebar-toggle {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  background: #f5f5f5;
  color: #666;
  transition: all 0.3s ease;
}

.sidebar-toggle:hover {
  background: #e6e6e6;
  color: #333;
}

.layout-content {
  background-color: #f5f5f5;
  padding: 20px;
  overflow-y: auto;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .layout-content {
    padding: 16px;
  }
}
</style>
