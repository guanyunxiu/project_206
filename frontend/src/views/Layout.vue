<template>
  <el-container class="layout-container">
    <el-aside :width="isCollapse ? '64px' : '220px'" class="sidebar">
      <div class="logo">
        <el-icon :size="28" color="#fff"><OfficeBuilding /></el-icon>
        <span v-if="!isCollapse" class="logo-text">会议室管理系统</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapse"
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409EFF"
        router
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <template #title>首页概览</template>
        </el-menu-item>
        <el-menu-item index="/rooms">
          <el-icon><OfficeBuilding /></el-icon>
          <template #title>会议室列表</template>
        </el-menu-item>
        <el-menu-item index="/booking">
          <el-icon><Calendar /></el-icon>
          <template #title>预约会议室</template>
        </el-menu-item>
        <el-menu-item index="/my-bookings">
          <el-icon><List /></el-icon>
          <template #title>我的预约</template>
        </el-menu-item>
        <el-menu-item index="/assets">
          <el-icon><Goods /></el-icon>
          <template #title>资产列表</template>
        </el-menu-item>
        <el-menu-item index="/my-assets">
          <el-icon><Box /></el-icon>
          <template #title>我的借用</template>
        </el-menu-item>
        <el-menu-item index="/my-violations">
          <el-icon><Warning /></el-icon>
          <template #title>违规记录</template>
        </el-menu-item>
        <el-menu-item index="/notifications">
          <el-icon><Bell /></el-icon>
          <template #title>消息通知</template>
        </el-menu-item>
        <el-menu-item index="/big-screen">
          <el-icon><Monitor /></el-icon>
          <template #title>统计大屏</template>
        </el-menu-item>
        <el-sub-menu index="admin" v-if="isAdmin">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span>系统管理</span>
          </template>
          <el-menu-item index="/admin/rooms">会议室管理</el-menu-item>
          <el-menu-item index="/admin/assets">资产管理</el-menu-item>
          <el-menu-item index="/admin/bookings">预约管理</el-menu-item>
          <el-menu-item index="/admin/approvals">审批管理</el-menu-item>
          <el-menu-item index="/admin/checkin">签到管理</el-menu-item>
          <el-menu-item index="/admin/asset-repairs">报修管理</el-menu-item>
          <el-menu-item index="/admin/overdue-assets">逾期管理</el-menu-item>
          <el-menu-item index="/admin/users" v-if="isSuperOrAdmin">用户管理</el-menu-item>
          <el-menu-item index="/admin/departments" v-if="isSuperOrAdmin">部门管理</el-menu-item>
          <el-menu-item index="/admin/exception-rules" v-if="isSuperOrAdmin">异常规则</el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-icon class="collapse-btn" @click="isCollapse = !isCollapse">
            <Fold v-if="!isCollapse" />
            <Expand v-else />
          </el-icon>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item v-for="item in breadcrumbs" :key="item.path">
              {{ item.title }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <div class="user-info">
              <el-avatar :size="32" :src="userStore.userInfo?.avatar">
                {{ userStore.userInfo?.real_name?.charAt(0) }}
              </el-avatar>
              <span class="username">{{ userStore.userInfo?.real_name }}</span>
              <el-tag :type="getRoleTagType(userStore.userInfo?.role)" size="small">
                {{ userStore.userInfo?.role_name }}
              </el-tag>
              <el-icon><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <el-icon><User /></el-icon>个人中心
                </el-dropdown-item>
                <el-dropdown-item command="password">
                  <el-icon><Lock /></el-icon>修改密码
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>

  <el-dialog
    v-model="passwordDialogVisible"
    title="修改密码"
    width="400px"
  >
    <el-form :model="passwordForm" :rules="passwordRules" ref="passwordFormRef">
      <el-form-item label="旧密码" prop="old_password">
        <el-input v-model="passwordForm.old_password" type="password" show-password />
      </el-form-item>
      <el-form-item label="新密码" prop="new_password">
        <el-input v-model="passwordForm.new_password" type="password" show-password />
      </el-form-item>
      <el-form-item label="确认密码" prop="confirm_password">
        <el-input v-model="passwordForm.confirm_password" type="password" show-password />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="passwordDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="passwordLoading" @click="handleChangePassword">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  OfficeBuilding, DataAnalysis, Calendar, List, Goods, Box, Setting,
  User, Lock, SwitchButton, Fold, Expand, ArrowDown, Warning, Bell, Monitor
} from '@element-plus/icons-vue'
import { useUserStore } from '@/store/user'
import { changePassword } from '@/api/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const isCollapse = ref(false)
const activeMenu = ref('/dashboard')
const passwordDialogVisible = ref(false)
const passwordFormRef = ref(null)
const passwordLoading = ref(false)

const passwordForm = ref({
  old_password: '',
  new_password: '',
  confirm_password: ''
})

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
        if (value !== passwordForm.value.new_password) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

const isAdmin = computed(() => {
  const role = userStore.userInfo?.role
  return ['dept_admin', 'admin', 'super_admin'].includes(role)
})

const isSuperOrAdmin = computed(() => {
  const role = userStore.userInfo?.role
  return ['admin', 'super_admin'].includes(role)
})

const breadcrumbs = computed(() => {
  const matched = route.matched.filter(item => item.meta && item.meta.title)
  return matched.map(item => ({
    path: item.path,
    title: item.meta.title
  }))
})

watch(route, (newRoute) => {
  activeMenu.value = newRoute.path
}, { immediate: true })

onMounted(() => {
  if (!userStore.userInfo && localStorage.getItem('token')) {
    userStore.fetchUserInfo()
  }
})

function getRoleTagType(role) {
  const typeMap = {
    'super_admin': 'danger',
    'admin': 'warning',
    'dept_admin': 'success',
    'employee': 'info'
  }
  return typeMap[role] || 'info'
}

function handleCommand(command) {
  if (command === 'profile') {
    router.push('/profile')
  } else if (command === 'password') {
    passwordDialogVisible.value = true
    passwordForm.value = {
      old_password: '',
      new_password: '',
      confirm_password: ''
    }
  } else if (command === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(async () => {
      await userStore.logout()
      ElMessage.success('已退出登录')
      router.push('/login')
    }).catch(() => {})
  }
}

async function handleChangePassword() {
  if (!passwordFormRef.value) return
  
  await passwordFormRef.value.validate(async (valid) => {
    if (valid) {
      passwordLoading.value = true
      try {
        await changePassword({
          old_password: passwordForm.value.old_password,
          new_password: passwordForm.value.new_password
        })
        ElMessage.success('密码修改成功')
        passwordDialogVisible.value = false
      } catch (error) {
        console.error('Change password failed:', error)
      } finally {
        passwordLoading.value = false
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.layout-container {
  height: 100vh;
}

.sidebar {
  background-color: #304156;
  transition: width 0.3s;
  overflow: hidden;

  :deep(.el-menu) {
    border-right: none;
  }

  .logo {
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #2b2f3a;
    padding: 0 16px;
    white-space: nowrap;
    overflow: hidden;

    .logo-text {
      margin-left: 12px;
      color: #fff;
      font-size: 16px;
      font-weight: 600;
    }
  }
}

.header {
  background-color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  z-index: 10;

  .header-left {
    display: flex;
    align-items: center;

    .collapse-btn {
      font-size: 20px;
      cursor: pointer;
      margin-right: 16px;
      color: #606266;
      transition: color 0.3s;

      &:hover {
        color: #409EFF;
      }
    }
  }

  .header-right {
    .user-info {
      display: flex;
      align-items: center;
      cursor: pointer;
      padding: 0 8px;
      height: 60px;

      .username {
        margin: 0 8px 0 12px;
        color: #606266;
      }

      .el-tag {
        margin-right: 8px;
      }
    }
  }
}

.main-content {
  background-color: #f0f2f5;
  padding: 0;
  overflow-y: auto;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
