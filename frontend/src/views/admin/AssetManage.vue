<template>
  <div class="page-container admin-page">
    <div class="page-header">
      <h2 class="page-title">资产管理</h2>
      <el-button type="primary" :icon="Plus" @click="openAddDialog">新增资产</el-button>
    </div>

    <div class="search-bar">
      <el-input
        v-model="searchForm.keyword"
        placeholder="搜索资产名称"
        :prefix-icon="Search"
        clearable
        style="width: 250px; margin-right: 12px;"
        @keyup.enter="fetchAssets"
      />
      <el-select v-model="searchForm.category" placeholder="分类筛选" clearable style="width: 150px; margin-right: 12px;">
        <el-option label="投影仪" value="projector" />
        <el-option label="摄像机" value="camera" />
        <el-option label="白板" value="whiteboard" />
        <el-option label="麦克风" value="microphone" />
        <el-option label="其他" value="other" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="fetchAssets">搜索</el-button>
    </div>

    <el-table :data="assetList" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="name" label="名称" min-width="150" />
      <el-table-column prop="category_name" label="分类" width="100">
        <template #default="{ row }">
          <el-tag size="small">{{ row.category_name }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
      <el-table-column prop="total_quantity" label="总数" width="80" align="center" />
      <el-table-column prop="available_quantity" label="可用" width="80" align="center">
        <template #default="{ row }">
          <span :class="{ 'text-danger': row.available_quantity === 0 }">{{ row.available_quantity }}</span>
        </template>
      </el-table-column>
      <el-table-column label="已借" width="80" align="center">
        <template #default="{ row }">
          {{ row.total_quantity - row.available_quantity }}
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
            {{ row.status === 1 ? '可用' : '不可用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" link @click="openEditDialog(row)">编辑</el-button>
          <el-button type="danger" size="small" link @click="deleteAsset(row)">删除</el-button>
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
        @current-change="fetchAssets"
      />
    </div>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑资产' : '新增资产'" width="500px">
      <el-form :model="assetForm" :rules="assetRules" ref="assetFormRef" label-width="100px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="assetForm.name" placeholder="请输入资产名称" />
        </el-form-item>
        <el-form-item label="分类" prop="category">
          <el-select v-model="assetForm.category" placeholder="请选择分类" style="width: 100%;">
            <el-option label="投影仪" value="projector" />
            <el-option label="摄像机" value="camera" />
            <el-option label="白板" value="whiteboard" />
            <el-option label="麦克风" value="microphone" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="assetForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入资产描述"
          />
        </el-form-item>
        <el-form-item label="总数" prop="total_quantity">
          <el-input-number v-model="assetForm.total_quantity" :min="0" :max="1000" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="assetForm.status">
            <el-radio :value="1">可用</el-radio>
            <el-radio :value="0">不可用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveAsset">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { createAsset, updateAsset, deleteAsset, getAssetList } from '@/api/asset'

const assetList = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const assetFormRef = ref(null)
const currentId = ref(null)

const searchForm = reactive({
  keyword: '',
  category: ''
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const assetForm = reactive({
  name: '',
  category: '',
  description: '',
  total_quantity: 0,
  status: 1
})

const assetRules = {
  name: [{ required: true, message: '请输入资产名称', trigger: 'blur' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
  total_quantity: [{ required: true, message: '请输入总数', trigger: 'blur' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }]
}

async function fetchAssets() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.page_size,
      ...searchForm
    }
    if (!searchForm.category) delete params.category
    const res = await getAssetList(params)
    assetList.value = res.data.list
    pagination.total = res.data.total
  } catch (error) {
    console.error('Fetch assets failed:', error)
  } finally {
    loading.value = false
  }
}

function handleSizeChange(size) {
  pagination.page_size = size
  pagination.page = 1
  fetchAssets()
}

function openAddDialog() {
  isEdit.value = false
  currentId.value = null
  Object.assign(assetForm, {
    name: '',
    category: '',
    description: '',
    total_quantity: 0,
    status: 1
  })
  dialogVisible.value = true
}

function openEditDialog(row) {
  isEdit.value = true
  currentId.value = row.id
  Object.assign(assetForm, {
    name: row.name,
    category: row.category,
    description: row.description || '',
    total_quantity: row.total_quantity,
    status: row.status
  })
  dialogVisible.value = true
}

async function saveAsset() {
  if (!assetFormRef.value) return
  
  await assetFormRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true
      try {
        if (isEdit.value) {
          await updateAsset(currentId.value, assetForm)
          ElMessage.success('更新成功')
        } else {
          await createAsset(assetForm)
          ElMessage.success('创建成功')
        }
        dialogVisible.value = false
        fetchAssets()
      } catch (error) {
        console.error('Save asset failed:', error)
      } finally {
        submitting.value = false
      }
    }
  })
}

async function deleteAsset(row) {
  ElMessageBox.confirm(`确定要删除资产「${row.name}」吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await deleteAsset(row.id)
      ElMessage.success('删除成功')
      fetchAssets()
    } catch (error) {
      console.error('Delete asset failed:', error)
    }
  }).catch(() => {})
}

onMounted(() => {
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

  .text-danger {
    color: #F56C6C;
    font-weight: 600;
  }
}
</style>
