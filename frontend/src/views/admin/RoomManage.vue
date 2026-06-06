<template>
  <div class="page-container admin-page">
    <div class="page-header">
      <h2 class="page-title">会议室管理</h2>
      <el-button type="primary" :icon="Plus" @click="openAddDialog">新增会议室</el-button>
    </div>

    <div class="search-bar">
      <el-input
        v-model="searchForm.keyword"
        placeholder="搜索会议室名称、位置"
        :prefix-icon="Search"
        clearable
        style="width: 250px; margin-right: 12px;"
        @keyup.enter="fetchRooms"
      />
      <el-select v-model="searchForm.status" placeholder="状态筛选" clearable style="width: 120px; margin-right: 12px;">
        <el-option label="可用" :value="1" />
        <el-option label="不可用" :value="0" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="fetchRooms">搜索</el-button>
    </div>

    <el-table :data="roomList" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column label="图片" width="120">
        <template #default="{ row }">
          <el-image
            :src="row.image_url || 'https://via.placeholder.com/100x60'"
            :preview-src-list="[row.image_url]"
            fit="cover"
            style="width: 100px; height: 60px; border-radius: 4px;"
          />
        </template>
      </el-table-column>
      <el-table-column prop="name" label="名称" min-width="120" />
      <el-table-column prop="capacity" label="容量" width="80">
        <template #default="{ row }">{{ row.capacity }} 人</template>
      </el-table-column>
      <el-table-column prop="location" label="位置" min-width="150" />
      <el-table-column prop="facilities" label="设施" min-width="200" show-overflow-tooltip />
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
          <el-button type="danger" size="small" link @click="deleteRoom(row)">删除</el-button>
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
        @current-change="fetchRooms"
      />
    </div>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑会议室' : '新增会议室'" width="600px">
      <el-form :model="roomForm" :rules="roomRules" ref="roomFormRef" label-width="100px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="roomForm.name" placeholder="请输入会议室名称" />
        </el-form-item>
        <el-form-item label="容量" prop="capacity">
          <el-input-number v-model="roomForm.capacity" :min="1" :max="200" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="位置" prop="location">
          <el-input v-model="roomForm.location" placeholder="请输入位置" />
        </el-form-item>
        <el-form-item label="设施">
          <el-input
            v-model="roomForm.facilities"
            type="textarea"
            :rows="2"
            placeholder="多个设施用逗号分隔，如：投影仪,白板,音响系统"
          />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="roomForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入会议室描述"
          />
        </el-form-item>
        <el-form-item label="图片URL">
          <el-input v-model="roomForm.image_url" placeholder="请输入图片链接" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="roomForm.status">
            <el-radio :value="1">可用</el-radio>
            <el-radio :value="0">不可用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveRoom">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { createRoom, updateRoom, deleteRoom, getRoomList } from '@/api/room'

const roomList = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const roomFormRef = ref(null)
const currentId = ref(null)

const searchForm = reactive({
  keyword: '',
  status: null
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const roomForm = reactive({
  name: '',
  capacity: 10,
  location: '',
  facilities: '',
  description: '',
  image_url: '',
  status: 1
})

const roomRules = {
  name: [{ required: true, message: '请输入会议室名称', trigger: 'blur' }],
  capacity: [{ required: true, message: '请输入容量', trigger: 'blur' }],
  location: [{ required: true, message: '请输入位置', trigger: 'blur' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }]
}

async function fetchRooms() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.page_size,
      ...searchForm
    }
    if (searchForm.status === null) delete params.status
    const res = await getRoomList(params)
    roomList.value = res.data.list
    pagination.total = res.data.total
  } catch (error) {
    console.error('Fetch rooms failed:', error)
  } finally {
    loading.value = false
  }
}

function handleSizeChange(size) {
  pagination.page_size = size
  pagination.page = 1
  fetchRooms()
}

function openAddDialog() {
  isEdit.value = false
  currentId.value = null
  Object.assign(roomForm, {
    name: '',
    capacity: 10,
    location: '',
    facilities: '',
    description: '',
    image_url: '',
    status: 1
  })
  dialogVisible.value = true
}

function openEditDialog(row) {
  isEdit.value = true
  currentId.value = row.id
  Object.assign(roomForm, {
    name: row.name,
    capacity: row.capacity,
    location: row.location,
    facilities: row.facilities || '',
    description: row.description || '',
    image_url: row.image_url || '',
    status: row.status
  })
  dialogVisible.value = true
}

async function saveRoom() {
  if (!roomFormRef.value) return
  
  await roomFormRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true
      try {
        if (isEdit.value) {
          await updateRoom(currentId.value, roomForm)
          ElMessage.success('更新成功')
        } else {
          await createRoom(roomForm)
          ElMessage.success('创建成功')
        }
        dialogVisible.value = false
        fetchRooms()
      } catch (error) {
        console.error('Save room failed:', error)
      } finally {
        submitting.value = false
      }
    }
  })
}

async function deleteRoom(row) {
  ElMessageBox.confirm(`确定要删除会议室「${row.name}」吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await deleteRoom(row.id)
      ElMessage.success('删除成功')
      fetchRooms()
    } catch (error) {
      console.error('Delete room failed:', error)
    }
  }).catch(() => {})
}

onMounted(() => {
  fetchRooms()
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
