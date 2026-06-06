<template>
  <div class="page-container admin-page">
    <div class="page-header">
      <h2 class="page-title">预约管理</h2>
    </div>

    <div class="search-bar">
      <el-input
        v-model="searchForm.keyword"
        placeholder="搜索会议主题、预约人"
        :prefix-icon="Search"
        clearable
        style="width: 250px; margin-right: 12px;"
        @keyup.enter="fetchBookings"
      />
      <el-select v-model="searchForm.status" placeholder="状态筛选" clearable style="width: 150px; margin-right: 12px;">
        <el-option label="待使用" value="pending" />
        <el-option label="使用中" value="in_use" />
        <el-option label="已完成" value="completed" />
        <el-option label="已取消" value="cancelled" />
      </el-select>
      <el-date-picker
        v-model="searchForm.date"
        type="date"
        placeholder="选择日期"
        value-format="YYYY-MM-DD"
        style="width: 180px; margin-right: 12px;"
      />
      <el-button type="primary" :icon="Search" @click="fetchBookings">搜索</el-button>
    </div>

    <el-table :data="bookingList" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="meeting_title" label="会议主题" min-width="150" show-overflow-tooltip />
      <el-table-column label="会议室" width="120">
        <template #default="{ row }">{{ row.room_name }}</template>
      </el-table-column>
      <el-table-column label="预约人" width="100">
        <template #default="{ row }">{{ row.user_name }}</template>
      </el-table-column>
      <el-table-column label="预约日期" width="120">
        <template #default="{ row }">{{ row.booking_date }}</template>
      </el-table-column>
      <el-table-column label="时间" width="130">
        <template #default="{ row }">
          {{ row.start_time }} - {{ row.end_time }}
        </template>
      </el-table-column>
      <el-table-column label="参会人数" width="100">
        <template #default="{ row }">{{ row.attendees }} 人</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)" size="small">
            {{ getStatusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="借用资产" min-width="150" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.assets && row.assets.length">
            {{ row.assets }}
          </span>
          <span v-else style="color: #999;">无</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" link @click="viewDetail(row)">详情</el-button>
          <el-button
            v-if="row.status === 'pending' || row.status === 'in_use'"
            type="danger"
            size="small"
            link
            @click="handleCancelBooking(row)"
          >取消</el-button>
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
        @current-change="fetchBookings"
      />
    </div>

    <el-dialog v-model="detailVisible" title="预约详情" width="600px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="会议主题">{{ detailData.meeting_title }}</el-descriptions-item>
        <el-descriptions-item label="会议室">{{ detailData.room_name }}</el-descriptions-item>
        <el-descriptions-item label="预约人">{{ detailData.user_name }}</el-descriptions-item>
        <el-descriptions-item label="部门">{{ detailData.department_name }}</el-descriptions-item>
        <el-descriptions-item label="预约日期">{{ detailData.booking_date }}</el-descriptions-item>
        <el-descriptions-item label="时间段">{{ detailData.start_time }} - {{ detailData.end_time }}</el-descriptions-item>
        <el-descriptions-item label="参会人数">{{ detailData.attendees }} 人</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(detailData.status)">{{ getStatusText(detailData.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="会议描述" :span="2">{{ detailData.description || '无' }}</el-descriptions-item>
        <el-descriptions-item label="借用资产" :span="2">
          <span v-if="detailData.assets && detailData.assets.length">
            {{ detailData.assets }}
          </span>
          <span v-else>无</span>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间" :span="2">{{ detailData.created_at }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { getBookingList, cancelBooking, getBookingDetail } from '@/api/booking'

const bookingList = ref([])
const loading = ref(false)
const detailVisible = ref(false)
const detailData = ref({})

const searchForm = reactive({
  keyword: '',
  status: '',
  date: ''
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const statusMap = {
  pending: { text: '待使用', type: 'warning' },
  in_use: { text: '使用中', type: 'primary' },
  completed: { text: '已完成', type: 'success' },
  cancelled: { text: '已取消', type: 'info' }
}

function getStatusText(status) {
  return statusMap[status]?.text || status
}

function getStatusType(status) {
  return statusMap[status]?.type || 'info'
}

async function fetchBookings() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.page_size,
      ...searchForm
    }
    if (!searchForm.status) delete params.status
    if (!searchForm.date) delete params.date
    const res = await getBookingList(params)
    bookingList.value = res.data.list
    pagination.total = res.data.total
  } catch (error) {
    console.error('Fetch bookings failed:', error)
  } finally {
    loading.value = false
  }
}

function handleSizeChange(size) {
  pagination.page_size = size
  pagination.page = 1
  fetchBookings()
}

async function viewDetail(row) {
  try {
    const res = await getBookingDetail(row.id)
    detailData.value = res.data
    detailVisible.value = true
  } catch (error) {
    console.error('Get detail failed:', error)
  }
}

async function handleCancelBooking(row) {
  ElMessageBox.confirm(`确定要取消预约「${row.meeting_title}」吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await cancelBooking(row.id)
      ElMessage.success('取消成功')
      fetchBookings()
    } catch (error) {
      console.error('Cancel booking failed:', error)
    }
  }).catch(() => {})
}

onMounted(() => {
  fetchBookings()
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
