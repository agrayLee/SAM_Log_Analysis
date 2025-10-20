<template>
  <div class="profile">
    <!-- 页面标题 -->
    <el-card class="title-card" shadow="never">
      <div class="title-content">
        <h2>个人资料</h2>
        <p>查看和管理您的个人信息</p>
      </div>
    </el-card>

    <el-row :gutter="20">
      <!-- 个人信息 -->
      <el-col :span="16">
        <el-card title="基本信息" shadow="never">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 600;">基本信息</span>
              <el-button 
                type="primary" 
                size="small" 
                @click="showEditDialog = true"
              >
                编辑信息
              </el-button>
            </div>
          </template>
          
          <div class="info-list">
            <div class="info-item">
              <label>用户名：</label>
              <span>{{ userInfo.username }}</span>
            </div>
            
            <div class="info-item">
              <label>真实姓名：</label>
              <span>{{ userInfo.realName || '未设置' }}</span>
            </div>
            
            <div class="info-item">
              <label>手机号：</label>
              <span>{{ userInfo.phone || '未设置' }}</span>
            </div>
            
            <div class="info-item">
              <label>用户角色：</label>
              <el-tag :type="userInfo.role === 'admin' ? 'danger' : 'success'" size="small">
                {{ userInfo.role === 'admin' ? '管理员' : '普通用户' }}
              </el-tag>
            </div>
            
            <div class="info-item">
              <label>账号状态：</label>
              <el-tag :type="userInfo.status ? 'success' : 'danger'" size="small">
                {{ userInfo.status ? '正常' : '已禁用' }}
              </el-tag>
            </div>
            
            <div class="info-item">
              <label>最后登录：</label>
              <span>{{ formatTime(userInfo.lastLoginAt) }}</span>
            </div>
            
            <div class="info-item">
              <label>注册时间：</label>
              <span>{{ formatTime(userInfo.createdAt) }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
      
      <!-- 安全设置 -->
      <el-col :span="8">
        <el-card title="安全设置" shadow="never">
          <template #header>
            <span style="font-weight: 600;">安全设置</span>
          </template>
          
          <div class="security-list">
            <div class="security-item">
              <div class="security-info">
                <div class="security-title">登录密码</div>
                <div class="security-desc">定期更换密码保护账号安全</div>
              </div>
              <el-button 
                type="primary" 
                size="small" 
                @click="showPasswordDialog = true"
              >
                修改密码
              </el-button>
            </div>
            
            <div class="security-item" v-if="userInfo.firstLogin">
              <div class="security-info">
                <div class="security-title">首次登录</div>
                <div class="security-desc text-warning">请尽快修改默认密码</div>
              </div>
              <el-tag type="warning" size="small">待处理</el-tag>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 编辑信息弹窗 -->
    <el-dialog
      title="编辑个人信息"
      v-model="showEditDialog"
      width="500px"
      @close="resetEditForm"
    >
      <el-form
        ref="editFormRef"
        :model="editForm"
        :rules="editFormRules"
        label-width="100px"
      >
        <el-form-item label="真实姓名" prop="realName">
          <el-input v-model="editForm.realName" placeholder="请输入真实姓名" />
        </el-form-item>
        
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="editForm.phone" placeholder="请输入手机号" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="updateProfile" :loading="updating">
          保存
        </el-button>
      </template>
    </el-dialog>

    <!-- 修改密码弹窗 -->
    <el-dialog
      title="修改密码"
      v-model="showPasswordDialog"
      width="500px"
      @close="resetPasswordForm"
    >
      <el-form
        ref="passwordFormRef"
        :model="passwordForm"
        :rules="passwordFormRules"
        label-width="100px"
      >
        <el-form-item label="当前密码" prop="currentPassword">
          <el-input 
            v-model="passwordForm.currentPassword" 
            type="password" 
            placeholder="请输入当前密码"
            show-password
          />
        </el-form-item>
        
        <el-form-item label="新密码" prop="newPassword">
          <el-input 
            v-model="passwordForm.newPassword" 
            type="password" 
            placeholder="请输入新密码"
            show-password
          />
          <div class="form-help">密码长度至少6位，必须包含字母和数字</div>
        </el-form-item>
        
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input 
            v-model="passwordForm.confirmPassword" 
            type="password" 
            placeholder="请再次输入新密码"
            show-password
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showPasswordDialog = false">取消</el-button>
        <el-button type="primary" @click="changePassword" :loading="changingPassword">
          修改密码
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { userAPI, authAPI } from '../api/index'
import { getCurrentUser, logout } from '../utils/auth'
import { formatTime } from '../utils/format'

export default {
  name: 'Profile',
  setup() {
    const router = useRouter()
    
    // 用户信息
    const userInfo = ref({})
    const loading = ref(false)
    
    // 编辑信息相关
    const showEditDialog = ref(false)
    const updating = ref(false)
    const editFormRef = ref()
    const editForm = reactive({
      realName: '',
      phone: ''
    })
    
    const editFormRules = {
      phone: [
        { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
      ]
    }
    
    // 修改密码相关
    const showPasswordDialog = ref(false)
    const changingPassword = ref(false)
    const passwordFormRef = ref()
    const passwordForm = reactive({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    })
    
    const passwordFormRules = {
      currentPassword: [
        { required: true, message: '请输入当前密码', trigger: 'blur' }
      ],
      newPassword: [
        { required: true, message: '请输入新密码', trigger: 'blur' },
        { min: 6, message: '密码长度不能少于6位', trigger: 'blur' },
        { 
          pattern: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]/, 
          message: '密码必须包含字母和数字', 
          trigger: 'blur' 
        }
      ],
      confirmPassword: [
        { required: true, message: '请确认新密码', trigger: 'blur' },
        {
          validator: (rule, value, callback) => {
            if (value !== passwordForm.newPassword) {
              callback(new Error('两次输入的密码不一致'))
            } else {
              callback()
            }
          },
          trigger: 'blur'
        }
      ]
    }
    
    // 获取个人信息
    const getProfile = async () => {
      loading.value = true
      try {
        const response = await authAPI.getProfile()
        if (response.data.success) {
          userInfo.value = response.data.data.user
          
          // 填充编辑表单
          editForm.realName = userInfo.value.realName || ''
          editForm.phone = userInfo.value.phone || ''
        }
      } catch (error) {
        ElMessage.error('获取个人信息失败')
      } finally {
        loading.value = false
      }
    }
    
    // 更新个人信息
    const updateProfile = async () => {
      try {
        await editFormRef.value.validate()
        updating.value = true
        
        const response = await userAPI.updateUser(userInfo.value.id, {
          realName: editForm.realName,
          phone: editForm.phone
        })
        
        if (response.data.success) {
          ElMessage.success('个人信息更新成功')
          showEditDialog.value = false
          getProfile() // 重新获取最新信息
        }
      } catch (error) {
        ElMessage.error(error.response?.data?.message || '更新失败')
      } finally {
        updating.value = false
      }
    }
    
    // 修改密码
    const changePassword = async () => {
      try {
        await passwordFormRef.value.validate()
        changingPassword.value = true
        
        const response = await authAPI.changePassword({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
        
        if (response.data.success) {
          ElMessage.success('密码修改成功，请重新登录')
          showPasswordDialog.value = false
          
          // 延迟退出登录
          setTimeout(async () => {
            await logout()
            router.push('/login')
          }, 1500)
        }
      } catch (error) {
        ElMessage.error(error.response?.data?.message || '密码修改失败')
      } finally {
        changingPassword.value = false
      }
    }
    
    // 重置编辑表单
    const resetEditForm = () => {
      editFormRef.value?.resetFields()
      editForm.realName = userInfo.value.realName || ''
      editForm.phone = userInfo.value.phone || ''
    }
    
    // 重置密码表单
    const resetPasswordForm = () => {
      passwordFormRef.value?.resetFields()
      Object.assign(passwordForm, {
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
    }
    
    // 初始化
    onMounted(() => {
      getProfile()
    })
    
    return {
      userInfo,
      loading,
      showEditDialog,
      updating,
      editFormRef,
      editForm,
      editFormRules,
      showPasswordDialog,
      changingPassword,
      passwordFormRef,
      passwordForm,
      passwordFormRules,
      getProfile,
      updateProfile,
      changePassword,
      resetEditForm,
      resetPasswordForm,
      formatTime
    }
  }
}
</script>

<style scoped>
.profile {
  max-width: 1200px;
  margin: 0 auto;
}

.title-card {
  margin-bottom: 20px;
}

.title-content h2 {
  margin: 0 0 8px 0;
  color: #303133;
  font-size: 24px;
  font-weight: 600;
}

.title-content p {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.info-list {
  space: 16px;
}

.info-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.info-item:last-child {
  border-bottom: none;
}

.info-item label {
  width: 100px;
  color: #606266;
  font-weight: 500;
  margin-right: 16px;
}

.info-item span {
  color: #303133;
  flex: 1;
}

.security-list {
  space: 20px;
}

.security-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid #f0f0f0;
}

.security-item:last-child {
  border-bottom: none;
}

.security-info {
  flex: 1;
}

.security-title {
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}

.security-desc {
  font-size: 13px;
  color: #909399;
}

.security-desc.text-warning {
  color: #e6a23c;
}

.form-help {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .el-col {
    margin-bottom: 20px;
  }
  
  .info-item {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .info-item label {
    margin-bottom: 4px;
    margin-right: 0;
  }
  
  .security-item {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .security-info {
    margin-bottom: 12px;
  }
}
</style>
