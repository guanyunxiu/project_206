<template>
  <div class="page-container my-assets">
    <div class="page-header">
      <h2 class="page-title">我的借用</h2>
      <div class="filter-bar">
        <el-select v-model="filterForm.status" placeholder="状态筛选" clearable style="width: 150px; margin-right: 12px;">
          <el-option label="借用中" value="borrowed" />
          <el-option label="已归还" value="returned" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="fetchBorrowings">查询</el-button>
      </div>
    </div>

    <el-table :data="borrowingList" v-loading="loading" stripe>
      <el-table-column prop="id" label="记录编号" width="100" />
      <el-table-column prop="asset_name" label="资产名称" min-width="120" />
      <el-table-column prop="asset_category_name" label="分类" width="100" />
      <el-table-column prop="quantity" label="数量" width="80" />
      <el-table-column prop="meeting_title" label="关联会议" min-width="150" show-overflow-tooltip />
      <el-table-column prop="room_name" label="会议室" width="120" />
      <el-table-column label="会议时间" width="200">
        <template #default="{ row }">
          <div>{{ row.date }}</div>
          <div style="color: #909399; font-size: 12px;">{{ row.start_time }} - {{ row.end_time }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="status_name" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'borrowed' ? 'warning' : 'success'" size="small">
            {{ row.status_name }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="borrowed_at" label="借用时间" width="180">
        <template #default="{ row }">
          {{ formatDateTime(row.borrowed_at) }}
        </template>
      </el-table-column>
      <el-table-column prop="returned_at" label="归还时间" width="180">
        <template #default="{ row }">
          {{ row.returned_at ? formatDateTime(row.returned_at) : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button
            type="success"
            size="small"
            link
            :disabled="row.status === 'returned'"
            @click="returnAsset(row)"
          >
            归还
          </el-button>
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
        @current-change="fetchBorrowings"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { getMyBorrowings, returnAsset } from '@/api/asset'

const borrowingList = ref([])
const loading = ref(false)

const filterForm = reactive({
  status: ''
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

async function fetchBorrowings() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.page_size,
      status: filterForm.status || undefined
    }
    const res = await getMyBorrowings(params)
    borrowingList.value = res.data.list
    pagination.total = res.data.total
  } catch (error) {
    console.error('Fetch borrowings failed:', error)
  } finally {
    loading.value = false
  }
}

function handleSizeChange(size) {
  pagination.page_size = size
  pagination.page = 1
  fetchBorrowings()
}

function formatDateTime(datetime) {
  return datetime ? dayjs(datetime).format('YYYY-MM-DD HH:mm:ss') : '-'
}

async function returnAsset(row) {
  ElMessageBox.confirm(`确定要归还「${row.asset_name}」吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await returnAsset(row.id)
      ElMessage.success('归还成功')
      fetchBorrowings()
    } catch (error) {
      console.error('Return asset failed:', error)
    }
  }).catch(() => {})
}

onMounted(() => {
  fetchBorrowings()
})
</script>

<style lang="scss" scoped>
.my-assets {
  .filter-bar {
    display: flex;
    align-items: center;
  }

  .pagination-container {
    margin-top: 20px;
    text-align: right;
  }
}
</style>
