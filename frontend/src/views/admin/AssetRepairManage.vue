<template>
  <div class="page-container admin-page">
    <div class="page-header">
      <h2 class="page-title">资产报修管理</h2>
      <el-button type="primary" :icon="Plus" @click="openAddDialog">新增报修</el-button>
    </div>

    <div class="search-bar">
      <el-input
        v-model="searchForm.keyword"
        placeholder="搜索报修标题"
        :prefix-icon="Search"
        clearable
        style="width: 250px; margin-right: 12px;"
        @keyup.enter="fetchRepairs"
      />
      <el-select v-model="searchForm.status" placeholder="状态筛选" clearable style="width: 150px; margin-right: 12px;">
        <el-option label="待处理" value="pending" />
        <el-option label="维修中" value="repairing" />
        <el-option label="已解决" value="resolved" />
        <el-option label="已取消" value="cancelled" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="fetchRepairs">搜索</el-button>
    </div>

    <el-table :data="repairList" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="asset_name" label="资产名称" min-width="150" />
      <el-table-column prop="asset_category_name" label="资产分类" width="100">
        <template #default="{ row }">
          <el-tag size="small">{{ row.asset_category_name }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="报修标题" min-width="150" />
      <el-table-column prop="description" label="问题描述" min-width="200" show-overflow-tooltip />
      <el-table-column prop="fault_level_name" label="故障等级" width="100">
        <template #default="{ row }">
          <el-tag :type="getFaultLevelTagType(row.fault_level)" size="small">
            {{ row.fault_level_name }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="status_name" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="getStatusTagType(row.status)" size="small">
            {{ row.status_name }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="reporter_name" label="报修人" width="100" />
      <el-table-column prop="repaired_by_name" label="处理人" width="100" />
      <el-table-column prop="repair_note" label="维修备注" min-width="150" show-overflow-tooltip />
      <el-table-column prop="created_at" label="报修时间" width="180" />
      <el-table-column prop="repaired_at" label="维修时间" width="180" />
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" link @click="openEditDialog(row)">处理</el-button>
          <el-button type="info" size="small" link @click="viewDetail(row)">详情</el-button>
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
        @current-change="fetchRepairs"
      />
    </div>

    <el-dialog v-model="addDialogVisible" title="新增报修" width="500px">
      <el-form :model="addForm" :rules="addRules" ref="addFormRef" label-width="100px">
        <el-form-item label="资产" prop="asset_id">
          <el-select v-model="addForm.asset_id" placeholder="请选择资产" style="width: 100%;" filterable>
            <el-option
              v-for="asset in assetOptions"
              :key="asset.id"
              :label="asset.name"
              :value="asset.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="标题" prop="title">
          <el-input v-model="addForm.title" placeholder="请输入报修标题" />
        </el-form-item>
        <el-form-item label="故障等级" prop="fault_level">
          <el-radio-group v-model="addForm.fault_level">
            <el-radio value="minor">轻微</el-radio>
            <el-radio value="medium">中等</el-radio>
            <el-radio value="major">严重</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="问题描述">
          <el-input
            v-model="addForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入问题描述"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitAdd">提交</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editDialogVisible" title="处理报修" width="500px">
      <el-descriptions :column="1" border size="small" style="margin-bottom: 20px;">
        <el-descriptions-item label="报修标题">{{ currentRepair.title }}</el-descriptions-item>
        <el-descriptions-item label="资产名称">{{ currentRepair.asset_name }}</el-descriptions-item>
        <el-descriptions-item label="问题描述">{{ currentRepair.description }}</el-descriptions-item>
        <el-descriptions-item label="报修人">{{ currentRepair.reporter_name }}</el-descriptions-item>
        <el-descriptions-item label="报修时间">{{ currentRepair.created_at }}</el-descriptions-item>
      </el-descriptions>
      <el-form :model="editForm" :rules="editRules" ref="editFormRef" label-width="100px">
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="editForm.status">
            <el-radio value="pending">待处理</el-radio>
            <el-radio value="repairing">维修中</el-radio>
            <el-radio value="resolved">已解决</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="维修备注" prop="repair_note">
          <el-input
            v-model="editForm.repair_note"
            type="textarea"
            :rows="4"
            placeholder="请输入维修备注"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitEdit">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailDialogVisible" title="报修详情" width="600px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="ID">{{ currentRepair.id }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusTagType(currentRepair.status)" size="small">
            {{ currentRepair.status_name }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="资产名称">{{ currentRepair.asset_name }}</el-descriptions-item>
        <el-descriptions-item label="资产分类">{{ currentRepair.asset_category_name }}</el-descriptions-item>
        <el-descriptions-item label="报修标题">{{ currentRepair.title }}</el-descriptions-item>
        <el-descriptions-item label="故障等级">
          <el-tag :type="getFaultLevelTagType(currentRepair.fault_level)" size="small">
            {{ currentRepair.fault_level_name }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="报修人">{{ currentRepair.reporter_name }}</el-descriptions-item>
        <el-descriptions-item label="处理人">{{ currentRepair.repaired_by_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="报修时间">{{ currentRepair.created_at }}</el-descriptions-item>
        <el-descriptions-item label="维修时间">{{ currentRepair.repaired_at || '-' }}</el-descriptions-item>
        <el-descriptions-item label="问题描述" :span="2">{{ currentRepair.description }}</el-descriptions-item>
        <el-descriptions-item label="维修备注" :span="2">{{ currentRepair.repair_note || '暂无' }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { getRepairs, createRepair, updateRepair } from '@/api/assetAdvanced'
import { getAssetList } from '@/api/asset'

const repairList = ref([])
const assetOptions = ref([])
const loading = ref(false)
const addDialogVisible = ref(false)
const editDialogVisible = ref(false)
const detailDialogVisible = ref(false)
const submitting = ref(false)
const addFormRef = ref(null)
const editFormRef = ref(null)
const currentRepair = ref({})

const searchForm = reactive({
  keyword: '',
  status: ''
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const addForm = reactive({
  asset_id: null,
  title: '',
  description: '',
  fault_level: 'minor'
})

const addRules = {
  asset_id: [{ required: true, message: '请选择资产', trigger: 'change' }],
  title: [{ required: true, message: '请输入报修标题', trigger: 'blur' }],
  fault_level: [{ required: true, message: '请选择故障等级', trigger: 'change' }]
}

const editForm = reactive({
  status: 'pending',
  repair_note: ''
})

const editRules = {
  status: [{ required: true, message: '请选择状态', trigger: 'change' }]
}

function getStatusTagType(status) {
  const typeMap = {
    pending: 'warning',
    repairing: 'primary',
    resolved: 'success',
    cancelled: 'info'
  }
  return typeMap[status] || 'info'
}

function getFaultLevelTagType(level) {
  const typeMap = {
    minor: 'success',
    medium: 'warning',
    major: 'danger'
  }
  return typeMap[level] || 'info'
}

async function fetchRepairs() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.page_size,
      ...searchForm
    }
    if (!searchForm.status) delete params.status
    if (!searchForm.keyword) delete params.keyword
    const res = await getRepairs(params)
    repairList.value = res.data.list
    pagination.total = res.data.total
  } catch (error) {
    console.error('Fetch repairs failed:', error)
  } finally {
    loading.value = false
  }
}

async function fetchAssets() {
  try {
    const res = await getAssetList({ pageSize: 1000 })
    assetOptions.value = res.data.list || []
  } catch (error) {
    console.error('Fetch assets failed:', error)
  }
}

function handleSizeChange(size) {
  pagination.page_size = size
  pagination.page = 1
  fetchRepairs()
}

function openAddDialog() {
  Object.assign(addForm, {
    asset_id: null,
    title: '',
    description: '',
    fault_level: 'minor'
  })
  addDialogVisible.value = true
}

async function submitAdd() {
  if (!addFormRef.value) return
  
  await addFormRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true
      try {
        await createRepair(addForm)
        ElMessage.success('报修提交成功')
        addDialogVisible.value = false
        fetchRepairs()
      } catch (error) {
        console.error('Create repair failed:', error)
      } finally {
        submitting.value = false
      }
    }
  })
}

function openEditDialog(row) {
  currentRepair.value = { ...row }
  Object.assign(editForm, {
    status: row.status,
    repair_note: row.repair_note || ''
  })
  editDialogVisible.value = true
}

async function submitEdit() {
  if (!editFormRef.value) return
  
  await editFormRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true
      try {
        await updateRepair(currentRepair.value.id, editForm)
        ElMessage.success('更新成功')
        editDialogVisible.value = false
        fetchRepairs()
      } catch (error) {
        console.error('Update repair failed:', error)
      } finally {
        submitting.value = false
      }
    }
  })
}

function viewDetail(row) {
  currentRepair.value = { ...row }
  detailDialogVisible.value = true
}

onMounted(() => {
  fetchRepairs()
  fetchAssets()
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
