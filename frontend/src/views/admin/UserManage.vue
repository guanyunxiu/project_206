<template>
  <div class="page-container admin-page">
    <div class="page-header">
      <h2 class="page-title">用户管理</h2>
      <el-button type="primary" :icon="Plus" @click="openAddDialog">新增用户</el-button>
    </div>

    <div class="search-bar">
      <el-input
        v-model="searchForm.keyword"
        placeholder="搜索用户名、姓名、邮箱"
        :prefix-icon="Search"
        clearable
        style="width: 250px; margin-right: 12px;"
        @keyup.enter="fetchUsers"
      />
      <el-select v-model="searchForm.role" placeholder="角色筛选" clearable style="width: 150px; margin-right: 12px;">
        <el-option label="普通员工" value="employee" />
        <el-option label="部门管理员" value="dept_admin" />
        <el-option label="行政管理员" value="admin" />
        <el-option label="超级管理员" value="super_admin" />
      </el-select>
      <el-select v-model="searchForm.department_id" placeholder="部门筛选" clearable style="width: 180px; margin-right: 12px;">
        <el-option
          v-for="dept in departmentList"
          :key="dept.id"
          :label="dept.name"
          :value="dept.id"
        />
      </el-select>
      <el-button type="primary" :icon="Search" @click="fetchUsers">搜索</el-button>
    </div>

    <el-table :data="userList" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column label="头像" width="80">
        <template #default="{ row }">
          <el-avatar :size="40" :src="row.avatar || ''">
            {{ row.name?.charAt(0) || row.username?.charAt(0) }}
          </el-avatar>
        </template>
      </el-table-column>
      <el-table-column prop="username" label="用户名" width="120" />
      <el-table-column prop="name" label="姓名" width="100" />
      <el-table-column label="部门" width="120">
        <template #default="{ row }">{{ row.department_name || '-' }}</template>
      </el-table-column>
      <el-table-column prop="email" label="邮箱" min-width="180" />
      <el-table-column prop="phone" label="电话" width="130" />
      <el-table-column label="角色" width="120">
        <template #default="{ row }">
          <el-tag :type="getRoleType(row.role)" size="small">
            {{ getRoleText(row.role) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
            {{ row.status === 1 ? '正常' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" link @click="openEditDialog(row)">编辑</el-button>
          <el-button type="danger" size="small" link @click="deleteUser(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-container">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.page_size"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        :page-sizes="[10, 20, 50, 100]"
        @size-change="handleSizeChange"
        @current-change="fetchUsers"
      />
    </div>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑用户' : '新增用户'" width="600px">
      <el-form :model="userForm" :rules="userRules" ref="userFormRef" label-width="100px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="userForm.username" placeholder="请输入用户名" :disabled="isEdit" />
        </el-form-item>
        <el-form-item v-if="!isEdit" label="密码" prop="password">
          <el-input v-model="userForm.password" type="password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="userForm.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="userForm.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="电话" prop="phone">
          <el-input v-model="userForm.phone" placeholder="请输入电话" />
        </el-form-item>
        <el-form-item label="部门" prop="department_id">
          <el-select v-model="userForm.department_id" placeholder="请选择部门" style="width: 100%;">
            <el-option
              v-for="dept in departmentList"
              :key="dept.id"
              :label="dept.name"
              :value="dept.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="userForm.role" placeholder="请选择角色" style="width: 100%;">
            <el-option label="普通员工" value="employee" />
            <el-option label="部门管理员" value="dept_admin" />
            <el-option label="行政管理员" value="admin" />
            <el-option label="超级管理员" value="super_admin" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="userForm.status">
            <el-radio :value="1">正常</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveUser">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { getUserList, createUser, updateUser, deleteUser, getDepartmentList } from '@/api/user'

const userList = ref([])
const departmentList = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const userFormRef = ref(null)
const currentId = ref(null)

const searchForm = reactive({
  keyword: '',
  role: '',
  department_id: ''
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const userForm = reactive({
  username: '',
  password: '',
  name: '',
  email: '',
  phone: '',
  department_id: '',
  role: 'employee',
  status: 1
})

const userRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }
  ],
  department_id: [{ required: true, message: '请选择部门', trigger: 'change' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }]
}

const roleMap = {
  employee: { text: '普通员工', type: 'info' },
  dept_admin: { text: '部门管理员', type: 'warning' },
  admin: { text: '行政管理员', type: 'primary' },
  super_admin: { text: '超级管理员', type: 'danger' }
}

function getRoleText(role) {
  return roleMap[role]?.text || role
}

function getRoleType(role) {
  return roleMap[role]?.type || 'info'
}

async function fetchDepartments() {
  try {
    const res = await getDepartmentList({ page: 1, pageSize: 100 })
    departmentList.value = res.data.list || res.data || []
  } catch (error) {
    console.error('Fetch departments failed:', error)
  }
}

async function fetchUsers() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.page_size,
      ...searchForm
    }
    if (!searchForm.role) delete params.role
    if (!searchForm.department_id) delete params.department_id
    const res = await getUserList(params)
    userList.value = res.data.list
    pagination.total = res.data.total
  } catch (error) {
    console.error('Fetch users failed:', error)
  } finally {
    loading.value = false
  }
}

function handleSizeChange(size) {
  pagination.page_size = size
  pagination.page = 1
  fetchUsers()
}

function openAddDialog() {
  isEdit.value = false
  currentId.value = null
  Object.assign(userForm, {
    username: '',
    password: '123456',
    name: '',
    email: '',
    phone: '',
    department_id: '',
    role: 'employee',
    status: 1
  })
  dialogVisible.value = true
}

function openEditDialog(row) {
  isEdit.value = true
  currentId.value = row.id
  Object.assign(userForm, {
    username: row.username,
    password: '',
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    department_id: row.department_id || '',
    role: row.role,
    status: row.status
  })
  dialogVisible.value = true
}

async function saveUser() {
  if (!userFormRef.value) return
  
  await userFormRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true
      try {
        const data = { ...userForm }
        if (isEdit.value && !data.password) {
          delete data.password
        }
        if (isEdit.value) {
          await updateUser(currentId.value, data)
          ElMessage.success('更新成功')
        } else {
          await createUser(data)
          ElMessage.success('创建成功')
        }
        dialogVisible.value = false
        fetchUsers()
      } catch (error) {
        console.error('Save user failed:', error)
      } finally {
        submitting.value = false
      }
    }
  })
}

async function deleteUser(row) {
  ElMessageBox.confirm(`确定要删除用户「${row.name}」吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await deleteUser(row.id)
      ElMessage.success('删除成功')
      fetchUsers()
    } catch (error) {
      console.error('Delete user failed:', error)
    }
  }).catch(() => {})
}

onMounted(() => {
  fetchDepartments()
  fetchUsers()
})
</script>

<style lang="scss" scoped>
.admin-page {
  .search-bar {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
  }

  .pagination-container {
    margin-top: 20px;
    text-align: right;
  }
}
</style>
