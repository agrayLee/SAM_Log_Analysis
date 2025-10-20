<template>
  <div class="user-management">
    <!-- 页面标题 -->
    <el-card class="title-card" shadow="never">
      <div class="title-content">
        <h2>账号管理</h2>
        <p>管理系统用户账号、权限和状态</p>
      </div>
    </el-card>

    <!-- 操作区域 -->
    <el-card class="action-card" shadow="never">
      <div class="action-content">
        <!-- 搜索和筛选 -->
        <div class="search-area">
          <el-input
            v-model="searchQuery"
            placeholder="搜索用户名、姓名或手机号"
            clearable
            style="width: 300px; margin-right: 16px;"
            @input="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          
          <el-select
            v-model="roleFilter"
            placeholder="角色筛选"
            clearable
            style="width: 120px; margin-right: 16px;"
            @change="handleSearch"
          >
            <el-option label="全部" value="all" />
            <el-option label="管理员" value="admin" />
            <el-option label="普通用户" value="user" />
          </el-select>
          
          <el-select
            v-model="statusFilter"
            placeholder="状态筛选"
            clearable
            style="width: 120px; margin-right: 16px;"
            @change="handleSearch"
          >
            <el-option label="全部" value="all" />
            <el-option label="启用" value="1" />
            <el-option label="禁用" value="0" />
          </el-select>
        </div>

        <!-- 操作按钮 -->
        <div class="button-area">
          <el-button type="primary" @click="showCreateDialog">
            <el-icon><Plus /></el-icon>
            新增用户
          </el-button>
          
          <el-dropdown @command="handleBatchAction" v-if="selectedUsers.length > 0">
            <el-button type="default">
              批量操作({{ selectedUsers.length }})
              <el-icon class="el-icon--right"><arrow-down /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="enable">
                  <el-icon><Check /></el-icon>
                  批量启用
                </el-dropdown-item>
                <el-dropdown-item command="disable">
                  <el-icon><Close /></el-icon>
                  批量禁用
                </el-dropdown-item>
                <el-dropdown-item command="reset-password" divided>
                  <el-icon><Refresh /></el-icon>
                  批量重置密码
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </el-card>

    <!-- 用户列表 -->
    <el-card class="table-card" shadow="never">
      <el-table
        :data="userList"
        v-loading="loading"
        @selection-change="handleSelectionChange"
        style="width: 100%"
      >
        <el-table-column type="selection" width="55" />
        
        <el-table-column prop="username" label="用户名" min-width="120">
          <template #default="{ row }">
            <div style="display: flex; align-items: center;">
              <el-avatar size="small" style="margin-right: 8px;">
                {{ row.username.charAt(0).toUpperCase() }}
              </el-avatar>
              <span>{{ row.username }}</span>
              <el-tag v-if="row.first_login" type="warning" size="small" style="margin-left: 8px;">
                首次登录
              </el-tag>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="real_name" label="真实姓名" min-width="100">
          <template #default="{ row }">
            {{ row.real_name || '-' }}
          </template>
        </el-table-column>
        
        <el-table-column prop="phone" label="手机号" min-width="120">
          <template #default="{ row }">
            {{ row.phone || '-' }}
          </template>
        </el-table-column>
        
        <el-table-column prop="role" label="角色" width="100">
          <template #default="{ row }">
            <el-tag :type="row.role === 'admin' ? 'danger' : 'success'" size="small">
              {{ row.role === 'admin' ? '管理员' : '普通用户' }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status ? 'success' : 'danger'" size="small">
              {{ row.status ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="last_login_at" label="最后登录" min-width="150">
          <template #default="{ row }">
            {{ formatTime(row.last_login_at) }}
          </template>
        </el-table-column>
        
        <el-table-column prop="created_at" label="创建时间" min-width="150">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button 
              type="primary" 
              size="small" 
              link 
              @click="showEditDialog(row)"
            >
              编辑
            </el-button>
            
            <el-button 
              type="warning" 
              size="small" 
              link 
              @click="resetPassword(row)"
            >
              重置密码
            </el-button>
            
            <el-button 
              :type="row.status ? 'danger' : 'success'" 
              size="small" 
              link 
              @click="toggleUserStatus(row)"
              :disabled="row.id === currentUser?.id"
            >
              {{ row.status ? '禁用' : '启用' }}
            </el-button>
            
            <el-button 
              type="danger" 
              size="small" 
              link 
              @click="deleteUser(row)"
              :disabled="row.id === currentUser?.id || row.role === 'admin'"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <!-- 分页 -->
      <div style="margin-top: 20px; text-align: right;">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="getUserList"
          @size-change="getUserList"
        />
      </div>
    </el-card>

    <!-- 创建/编辑用户弹窗 -->
    <el-dialog
      :title="dialogMode === 'create' ? '新增用户' : '编辑用户'"
      v-model="dialogVisible"
      width="500px"
      @close="resetForm"
    >
      <el-form
        ref="userFormRef"
        :model="userForm"
        :rules="userFormRules"
        label-width="100px"
      >
        <el-form-item label="用户名" prop="username">
          <el-input 
            v-model="userForm.username" 
            placeholder="请输入用户名"
            :disabled="dialogMode === 'edit'"
          />
          <div class="form-help">用户名只能包含字母、数字和下划线，至少3位</div>
        </el-form-item>
        
        <el-form-item label="真实姓名" prop="realName">
          <el-input v-model="userForm.realName" placeholder="请输入真实姓名" />
        </el-form-item>
        
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="userForm.phone" placeholder="请输入手机号" />
        </el-form-item>
        
        <el-form-item label="角色" prop="role">
          <el-select v-model="userForm.role" style="width: 100%;">
            <el-option label="管理员" value="admin" />
            <el-option label="普通用户" value="user" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="状态" prop="status" v-if="dialogMode === 'edit'">
          <el-switch 
            v-model="userForm.status"
            active-text="启用"
            inactive-text="禁用"
            :disabled="userForm.id === currentUser?.id"
          />
        </el-form-item>
        
        <div v-if="dialogMode === 'create'" class="password-notice">
          <el-alert
            title="默认密码为：123456"
            description="用户首次登录时会被要求修改密码"
            type="info"
            :closable="false"
            show-icon
          />
        </div>
      </el-form>
      
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">
          {{ dialogMode === 'create' ? '创建' : '保存' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 审计日志弹窗 -->
    <el-dialog
      title="操作审计日志"
      v-model="auditLogVisible"
      width="80%"
      top="5vh"
    >
      <el-table :data="auditLogs" v-loading="auditLoading" style="width: 100%">
        <el-table-column prop="operator_username" label="操作者" width="120" />
        <el-table-column prop="target_username" label="目标用户" width="120" />
        <el-table-column prop="operation_type" label="操作类型" width="150">
          <template #default="{ row }">
            <el-tag size="small">{{ getOperationTypeText(row.operation_type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="ip_address" label="IP地址" width="130" />
        <el-table-column prop="created_at" label="操作时间" width="160">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="operation_details" label="操作详情" min-width="200">
          <template #default="{ row }">
            <el-button size="small" link @click="showOperationDetails(row)">
              查看详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <div style="margin-top: 20px; text-align: right;">
        <el-pagination
          v-model:current-page="auditCurrentPage"
          v-model:page-size="auditPageSize"
          :total="auditTotal"
          layout="prev, pager, next"
          @current-change="getAuditLogs"
        />
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { userAPI } from '../api/index'
import { getCurrentUser } from '../utils/auth'
import { formatTime } from '../utils/format'

export default {
  name: 'UserManagement',
  setup() {
    const currentUser = ref(getCurrentUser())
    
    // 列表相关
    const userList = ref([])
    const loading = ref(false)
    const currentPage = ref(1)
    const pageSize = ref(20)
    const total = ref(0)
    
    // 搜索筛选
    const searchQuery = ref('')
    const roleFilter = ref('all')
    const statusFilter = ref('all')
    
    // 选择相关
    const selectedUsers = ref([])
    
    // 弹窗相关
    const dialogVisible = ref(false)
    const dialogMode = ref('create') // create | edit
    const submitting = ref(false)
    
    // 表单相关
    const userFormRef = ref()
    const userForm = reactive({
      id: null,
      username: '',
      realName: '',
      phone: '',
      role: 'user',
      status: true
    })
    
    // 表单验证规则
    const userFormRules = {
      username: [
        { required: true, message: '请输入用户名', trigger: 'blur' },
        { min: 3, message: '用户名长度不能少于3位', trigger: 'blur' },
        { pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线', trigger: 'blur' }
      ],
      phone: [
        { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
      ],
      role: [
        { required: true, message: '请选择用户角色', trigger: 'change' }
      ]
    }
    
    // 审计日志相关
    const auditLogVisible = ref(false)
    const auditLogs = ref([])
    const auditLoading = ref(false)
    const auditCurrentPage = ref(1)
    const auditPageSize = ref(20)
    const auditTotal = ref(0)
    
    // 获取用户列表
    const getUserList = async () => {
      loading.value = true
      try {
        const params = {
          page: currentPage.value,
          limit: pageSize.value,
          search: searchQuery.value,
          role: roleFilter.value === 'all' ? '' : roleFilter.value,
          status: statusFilter.value === 'all' ? '' : statusFilter.value
        }
        
        const response = await userAPI.getUsers(params)
        if (response.data.success) {
          userList.value = response.data.data.users
          total.value = response.data.data.pagination.total
        }
      } catch (error) {
        ElMessage.error('获取用户列表失败')
      } finally {
        loading.value = false
      }
    }
    
    // 搜索处理
    const handleSearch = () => {
      currentPage.value = 1
      getUserList()
    }
    
    // 选择变化
    const handleSelectionChange = (selection) => {
      selectedUsers.value = selection
    }
    
    // 显示创建弹窗
    const showCreateDialog = () => {
      dialogMode.value = 'create'
      dialogVisible.value = true
    }
    
    // 显示编辑弹窗
    const showEditDialog = (user) => {
      dialogMode.value = 'edit'
      userForm.id = user.id
      userForm.username = user.username
      userForm.realName = user.real_name || ''
      userForm.phone = user.phone || ''
      userForm.role = user.role
      userForm.status = user.status
      dialogVisible.value = true
    }
    
    // 重置表单
    const resetForm = () => {
      userFormRef.value?.resetFields()
      Object.assign(userForm, {
        id: null,
        username: '',
        realName: '',
        phone: '',
        role: 'user',
        status: true
      })
    }
    
    // 提交表单
    const submitForm = async () => {
      try {
        await userFormRef.value.validate()
        submitting.value = true
        
        const formData = {
          username: userForm.username,
          realName: userForm.realName,
          phone: userForm.phone,
          role: userForm.role
        }
        
        let response
        if (dialogMode.value === 'create') {
          response = await userAPI.createUser(formData)
          if (response.data.success) {
            ElMessage.success(`用户创建成功！默认密码：${response.data.data.defaultPassword}`)
          }
        } else {
          formData.status = userForm.status
          response = await userAPI.updateUser(userForm.id, formData)
          if (response.data.success) {
            ElMessage.success('用户信息更新成功')
          }
        }
        
        dialogVisible.value = false
        getUserList()
      } catch (error) {
        ElMessage.error(error.response?.data?.message || '操作失败')
      } finally {
        submitting.value = false
      }
    }
    
    // 重置密码
    const resetPassword = async (user) => {
      try {
        await ElMessageBox.confirm(
          `确定要重置用户 "${user.username}" 的密码吗？`, 
          '重置密码', 
          { type: 'warning' }
        )
        
        const response = await userAPI.resetPassword(user.id)
        if (response.data.success) {
          ElMessage.success(`密码重置成功！新密码：${response.data.data.defaultPassword}`)
        }
      } catch (error) {
        if (error !== 'cancel') {
          ElMessage.error(error.response?.data?.message || '重置密码失败')
        }
      }
    }
    
    // 切换用户状态
    const toggleUserStatus = async (user) => {
      const action = user.status ? '禁用' : '启用'
      try {
        await ElMessageBox.confirm(
          `确定要${action}用户 "${user.username}" 吗？`, 
          `${action}用户`, 
          { type: 'warning' }
        )
        
        const response = await userAPI.updateUser(user.id, { status: !user.status })
        if (response.data.success) {
          ElMessage.success(`用户${action}成功`)
          getUserList()
        }
      } catch (error) {
        if (error !== 'cancel') {
          ElMessage.error(error.response?.data?.message || `${action}用户失败`)
        }
      }
    }
    
    // 删除用户
    const deleteUser = async (user) => {
      try {
        await ElMessageBox.confirm(
          `确定要删除用户 "${user.username}" 吗？此操作不可恢复！`, 
          '删除用户', 
          { type: 'warning' }
        )
        
        const response = await userAPI.deleteUser(user.id)
        if (response.data.success) {
          ElMessage.success('用户删除成功')
          getUserList()
        }
      } catch (error) {
        if (error !== 'cancel') {
          ElMessage.error(error.response?.data?.message || '删除用户失败')
        }
      }
    }
    
    // 批量操作
    const handleBatchAction = async (command) => {
      if (selectedUsers.value.length === 0) {
        ElMessage.warning('请先选择要操作的用户')
        return
      }
      
      const userIds = selectedUsers.value.map(user => user.id)
      const actionMap = {
        enable: '启用',
        disable: '禁用',
        'reset-password': '重置密码'
      }
      
      try {
        await ElMessageBox.confirm(
          `确定要${actionMap[command]}选中的 ${userIds.length} 个用户吗？`, 
          '批量操作', 
          { type: 'warning' }
        )
        
        const response = await userAPI.batchAction({
          action: command,
          userIds
        })
        
        if (response.data.success) {
          const { successCount, errorCount, results } = response.data.data
          
          if (errorCount === 0) {
            ElMessage.success(`批量${actionMap[command]}成功，共处理 ${successCount} 个用户`)
          } else {
            ElMessage.warning(`批量操作完成，成功 ${successCount} 个，失败 ${errorCount} 个`)
          }
          
          // 如果是重置密码，显示新密码
          if (command === 'reset-password' && results.length > 0) {
            const passwords = results
              .filter(r => r.success && r.data.defaultPassword)
              .map(r => `${selectedUsers.value.find(u => u.id === r.userId)?.username}: ${r.data.defaultPassword}`)
              .join('\n')
            
            if (passwords) {
              ElMessageBox.alert(passwords, '新密码', { type: 'info' })
            }
          }
          
          getUserList()
        }
      } catch (error) {
        if (error !== 'cancel') {
          ElMessage.error(error.response?.data?.message || '批量操作失败')
        }
      }
    }
    
    // 获取审计日志
    const getAuditLogs = async () => {
      auditLoading.value = true
      try {
        const response = await userAPI.getAuditLogs({
          page: auditCurrentPage.value,
          limit: auditPageSize.value
        })
        
        if (response.data.success) {
          auditLogs.value = response.data.data.logs
          auditTotal.value = response.data.data.pagination.total
        }
      } catch (error) {
        ElMessage.error('获取审计日志失败')
      } finally {
        auditLoading.value = false
      }
    }
    
    // 显示操作详情
    const showOperationDetails = (log) => {
      const details = typeof log.operation_details === 'string' 
        ? log.operation_details 
        : JSON.stringify(log.operation_details, null, 2)
      
      ElMessageBox.alert(details, '操作详情', { type: 'info' })
    }
    
    // 获取操作类型文本
    const getOperationTypeText = (type) => {
      const typeMap = {
        'CREATE_USER': '创建用户',
        'UPDATE_USER': '更新用户',
        'DELETE_USER': '删除用户',
        'RESET_PASSWORD': '重置密码',
        'CHANGE_PASSWORD': '修改密码'
      }
      return typeMap[type] || type
    }
    
    // 初始化
    onMounted(() => {
      getUserList()
    })
    
    return {
      currentUser,
      userList,
      loading,
      currentPage,
      pageSize,
      total,
      searchQuery,
      roleFilter,
      statusFilter,
      selectedUsers,
      dialogVisible,
      dialogMode,
      submitting,
      userFormRef,
      userForm,
      userFormRules,
      auditLogVisible,
      auditLogs,
      auditLoading,
      auditCurrentPage,
      auditPageSize,
      auditTotal,
      getUserList,
      handleSearch,
      handleSelectionChange,
      showCreateDialog,
      showEditDialog,
      resetForm,
      submitForm,
      resetPassword,
      toggleUserStatus,
      deleteUser,
      handleBatchAction,
      getAuditLogs,
      showOperationDetails,
      getOperationTypeText,
      formatTime
    }
  }
}
</script>

<style scoped>
.user-management {
  max-width: 1400px;
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

.action-card {
  margin-bottom: 20px;
}

.action-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.search-area {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.button-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.table-card {
  background: #fff;
}

.form-help {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.password-notice {
  margin-top: 16px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .action-content {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-area {
    justify-content: center;
  }
  
  .search-area .el-input,
  .search-area .el-select {
    width: 100% !important;
    margin-right: 0 !important;
    margin-bottom: 8px;
  }
  
  .button-area {
    justify-content: center;
  }
}
</style>
