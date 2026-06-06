<template>
  <div class="page-container profile">
    <el-row :gutter="20">
      <el-col :lg="8" :md="10" :xs="24">
        <el-card class="profile-card">
          <div class="avatar-section">
            <el-avatar :size="120" :src="userStore.userInfo?.avatar">
              {{ userStore.userInfo?.real_name?.charAt(0) }}
            </el-avatar>
            <h2 class="user-name">{{ userStore.userInfo?.real_name }}</h2>
            <el-tag :type="getRoleTagType(userStore.userInfo?.role)" size="large">
              {{ userStore.userInfo?.role_name }}
            </el-tag>
            <p class="dept-name">{{ userStore.userInfo?.department_name || '未分配部门' }}</p>
          </div>
          <el-divider />
          <div class="info-list">
            <div class="info-item">
              <span class="info-label">用户名</span>
              <span class="info-value">{{ userStore.userInfo?.username }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">邮箱</span>
              <span class="info-value">{{ userStore.userInfo?.email || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">电话</span>
              <span class="info-value">{{ userStore.userInfo?.phone || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">注册时间</span>
              <span class="info-value">{{ formatDateTime(userStore.userInfo?.created_at) }}</span>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :lg="16" :md="14" :xs="24">
        <el-card class="edit-card">
          <template #header>
            <div class="card-header">
              <span>编辑个人信息</span>
            </div>
          </template>
          <el-form
            :model="profileForm"
            :rules="profileRules"
            ref="profileFormRef"
            label-width="100px"
          >
            <el-form-item label="姓名" prop="real_name">
              <el-input v-model="profileForm.real_name" placeholder="请输入姓名" />
            </el-form-item>
            <el-form-item label="邮箱" prop="email">
              <el-input v-model="profileForm.email" placeholder="请输入邮箱" />
            </el-form-item>
            <el-form-item label="电话" prop="phone">
              <el-input v-model="profileForm.phone" placeholder="请输入电话" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="saveProfile">保存修改</el-button>
              <el-button @click="resetForm">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card class="edit-card" style="margin-top: 20px;">
          <template #header>
            <div class="card-header">
              <span>修改密码</span>
            </div>
          </template>
          <el-form
            :model="passwordForm"
            :rules="passwordRules"
            ref="passwordFormRef"
            label-width="100px"
          >
            <el-form-item label="旧密码" prop="old_password">
              <el-input v-model="passwordForm.old_password" type="password" show-password placeholder="请输入旧密码" />
            </el-form-item>
            <el-form-item label="新密码" prop="new_password">
              <el-input v-model="passwordForm.new_password" type="password" show-password placeholder="请输入新密码" />
            </el-form-item>
            <el-form-item label="确认密码" prop="confirm_password">
              <el-input v-model="passwordForm.confirm_password" type="password" show-password placeholder="请再次输入新密码" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="passwordSaving" @click="savePassword">修改密码</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { useUserStore } from '@/store/user'
import { updateProfile, changePassword } from '@/api/user'

const userStore = useUserStore()

const profileFormRef = ref(null)
const passwordFormRef = ref(null)
const saving = ref(false)
const passwordSaving = ref(false)

const profileForm = reactive({
  real_name: '',
  email: '',
  phone: ''
})

const passwordForm = reactive({
  old_password: '',
  new_password: '',
  confirm_password: ''
})

const profileRules = {
  real_name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  email: [
    { type: 'email', message: '请输入正确的邮箱', trigger: 'blur' }
  ],
  phone: [
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ]
}

const passwordRules = {
  old_password: [{ required: true, message: '请输入旧密码', trigger: 'blur' }],
  new_password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ],
  confirm_password: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== passwordForm.new_password) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

function getRoleTagType(role) {
  const typeMap = {
    'super_admin': 'danger',
    'admin': 'warning',
    'dept_admin': 'success',
    'employee': 'info'
  }
  return typeMap[role] || 'info'
}

function formatDateTime(datetime) {
  return datetime ? dayjs(datetime).format('YYYY-MM-DD HH:mm:ss') : '-'
}

function resetForm() {
  if (userStore.userInfo) {
    profileForm.real_name = userStore.userInfo.real_name
    profileForm.email = userStore.userInfo.email || ''
    profileForm.phone = userStore.userInfo.phone || ''
  }
}

async function saveProfile() {
  if (!profileFormRef.value) return
  
  await profileFormRef.value.validate(async (valid) => {
    if (valid) {
      saving.value = true
      try {
        const res = await updateProfile(profileForm)
        userStore.updateUserInfo(res.data)
        ElMessage.success('个人信息更新成功')
      } catch (error) {
        console.error('Update profile failed:', error)
      } finally {
        saving.value = false
      }
    }
  })
}

async function savePassword() {
  if (!passwordFormRef.value) return
  
  await passwordFormRef.value.validate(async (valid) => {
    if (valid) {
      passwordSaving.value = true
      try {
        await changePassword({
          old_password: passwordForm.old_password,
          new_password: passwordForm.new_password
        })
        ElMessage.success('密码修改成功')
        passwordForm.old_password = ''
        passwordForm.new_password = ''
        passwordForm.confirm_password = ''
      } catch (error) {
        console.error('Change password failed:', error)
      } finally {
        passwordSaving.value = false
      }
    }
  })
}

onMounted(() => {
  if (userStore.userInfo) {
    resetForm()
  } else if (localStorage.getItem('token')) {
    userStore.fetchUserInfo().then(() => {
      resetForm()
    })
  }
})
</script>

<style lang="scss" scoped>
.profile {
  .profile-card {
    text-align: center;

    .avatar-section {
      .user-name {
        margin: 16px 0 8px 0;
        font-size: 24px;
        font-weight: 600;
        color: #303133;
      }

      .dept-name {
        margin: 8px 0 0 0;
        color: #909399;
        font-size: 14px;
      }
    }

    .info-list {
      text-align: left;

      .info-item {
        display: flex;
        justify-content: space-between;
        padding: 12px 0;
        border-bottom: 1px solid #f0f2f5;

        &:last-child {
          border-bottom: none;
        }

        .info-label {
          color: #909399;
        }

        .info-value {
          color: #303133;
        }
      }
    }
  }

  .edit-card {
    .card-header {
      font-weight: 600;
      font-size: 16px;
    }
  }
}
</style>
