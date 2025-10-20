import { createRouter, createWebHistory } from 'vue-router'
import { checkAuth, hasPermission } from './utils/auth'

// 导入页面组件
import Login from './views/Login.vue'
import Layout from './components/Layout.vue'
import LogRecords from './views/LogRecords.vue'
import Settings from './views/Settings.vue'
import UserManagement from './views/UserManagement.vue'
import Profile from './views/Profile.vue'

const routes = [
  {
    path: '/',
    redirect: '/records'
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { 
      requiresAuth: false,
      title: '登录'
    }
  },
  {
    path: '/',
    component: Layout,
    meta: { requiresAuth: true },
    children: [
      {
        path: 'records',
        name: 'LogRecords',
        component: LogRecords,
        meta: { 
          title: '日志记录'
        }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: Settings,
        meta: { 
          title: '系统设置'
        }
      },
      // 用户管理功能已临时禁用
      // {
      //   path: 'users',
      //   name: 'UserManagement',
      //   component: UserManagement,
      //   meta: { 
      //     title: '账号管理',
      //     requiresAdmin: true
      //   }
      // },
      {
        path: 'profile',
        name: 'Profile',
        component: Profile,
        meta: { 
          title: '个人资料'
        }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach(async (to, from, next) => {
  // 设置页面标题
  document.title = to.meta.title ? `${to.meta.title} - 山姆日志查询系统` : '山姆日志查询系统'

  // 检查是否需要认证
  if (to.meta.requiresAuth) {
    const authResult = await checkAuth()
    
    if (authResult === 'FIRST_LOGIN_PASSWORD_REQUIRED') {
      next('/profile')
      return
    }
    
    if (!authResult) {
      next('/login')
      return
    }
    
    // 检查是否需要管理员权限
    if (to.meta.requiresAdmin && !hasPermission('user_management')) {
      next('/records')
      return
    }
  }

  // 如果已登录用户访问登录页，重定向到日志记录页
  if (to.name === 'Login') {
    const isAuthenticated = await checkAuth()
    if (isAuthenticated) {
      next('/records')
      return
    }
  }

  next()
})

export default router
