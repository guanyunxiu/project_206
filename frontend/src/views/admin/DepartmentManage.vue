<template>
  <div class="page-container admin-page">
    <div class="page-header">
      <h2 class="page-title">部门管理</h2>
      <el-button type="primary" :icon="Plus" @click="openAddDialog">新增部门</el-button>
    </div>

    <div class="search-bar">
      <el-input
        v-model="searchForm.keyword"
        placeholder="搜索部门名称、描述"
        :prefix-icon="Search"
        clearable
        style="width: 300px; margin-right: 12px;"
        @keyup.enter="fetchDepartments"
      />
      <el-button type="primary" :icon="Search" @click="fetchDepartments">搜索</el-button>
    </div>

    <el-table :data="departmentList" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="name" label="部门名称" min-width="150" />
      <el-table-column prop="description" label="部门描述" min-width="250" show-overflow-tooltip />
      <el-table-column label="部门负责人" width="120">
        <template #default="{ row }">{{ row.manager_name || '-' }}</template>
      </el-table-column>
      <el-table-column label="员工人数" width="100">
        <template #default="{ row }">{{ row.user_count || 0 }} 人</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
            {{ row.status === 1 ? '正常' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="180" />
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" link @click="openEditDialog(row)">编辑</el-button>
          <el-button type="danger" size="small" link @click="deleteDepartment(row)">删除</el-button>
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
        @current-change="fetchDepartments"
      />
    </div>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑部门' : '新增部门'" width="500px">
      <el-form :model="deptForm" :rules="deptRules" ref="deptFormRef" label-width="100px">
        <el-form-item label="部门名称" prop="name">
          <el-input v-model="deptForm.name" placeholder="请输入部门名称" />
        </el-form-item>
        <el-form-item label="部门负责人" prop="manager_id">
          <el-select v-model="deptForm.manager_id" placeholder="请选择负责人" clearable style="width: 100%;">
            <el-option
              v-for="user in userList"
              :key="user.id"
              :label="user.name"
              :value="user.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="部门描述">
          <el-input
            v-model="deptForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入部门描述"
          />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="deptForm.status">
            <el-radio :value="1">正常</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveDepartment">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { getDepartmentList, createDepartment, updateDepartment, deleteDepartment } from '@/api/user'
import { getUserList } from '@/api/user'

const departmentList = ref([])
const userList = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const deptFormRef = ref(null)
const currentId = ref(null)

const searchForm = reactive({
  keyword: ''
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const deptForm = reactive({
  name: '',
  description: '',
  manager_id: '',
  status: 1
})

const deptRules = {
  name: [{ required: true, message: '请输入部门名称', trigger: 'blur' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }]
}

async function fetchUsers() {
  try {
    const res = await getUserList({ page: 1, pageSize: 200, status: 1 })
    userList.value = res.data.list || []
  } catch (error) {
    console.error('Fetch users failed:', error)
  }
}

async function fetchDepartments() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.page_size,
      ...searchForm
    }
    const res = await getDepartmentList(params)
    departmentList.value = res.data.list
    pagination.total = res.data.total
  } catch (error) {
    console.error('Fetch departments failed:', error)
  } finally {
    loading.value = false
  }
}

function handleSizeChange(size) {
  pagination.page_size = size
  pagination.page = 1
  fetchDepartments()
}

function openAddDialog() {
  isEdit.value = false
  currentId.value = null
  Object.assign(deptForm, {
    name: '',
    description: '',
    manager_id: '',
    status: 1
  })
  dialogVisible.value = true
}

function openEditDialog(row) {
  isEdit.value = true
  currentId.value = row.id
  Object.assign(deptForm, {
    name: row.name,
    description: row.description || '',
    manager_id: row.manager_id || '',
    status: row.status
  })
  dialogVisible.value = true
}

async function saveDepartment() {
  if (!deptFormRef.value) return
  
  await deptFormRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true
      try {
        if (isEdit.value) {
          await updateDepartment(currentId.value, deptForm)
          ElMessage.success('更新成功')
        } else {
          await createDepartment(deptForm)
          ElMessage.success('创建成功')
        }
        dialogVisible.value = false
        fetchDepartments()
      } catch (error) {
        console.error('Save department failed:', error)
      } finally {
        submitting.value = false
      }
    }
  })
}

async function deleteDepartment(row) {
  ElMessageBox.confirm(`确定要删除部门「${row.name}」吗？删除后该部门的用户将变成无部门状态。`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await deleteDepartment(row.id)
      ElMessage.success('删除成功')
      fetchDepartments()
    } catch (error) {
      console.error('Delete department failed:', error)
    }
  }).catch(() => {})
}

onMounted(() => {
  fetchUsers()
  fetchDepartments()
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
