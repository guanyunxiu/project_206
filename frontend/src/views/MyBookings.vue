<template>
  <div class="page-container my-bookings">
    <div class="page-header">
      <h2 class="page-title">我的预约</h2>
      <div class="filter-bar">
        <el-select v-model="filterForm.status" placeholder="状态筛选" clearable style="width: 150px; margin-right: 12px;">
          <el-option label="待使用" value="pending" />
          <el-option label="使用中" value="in_use" />
          <el-option label="已完成" value="completed" />
          <el-option label="已取消" value="cancelled" />
        </el-select>
        <el-date-picker
          v-model="filterForm.date_range"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 300px; margin-right: 12px;"
          value-format="YYYY-MM-DD"
        />
        <el-button type="primary" :icon="Search" @click="fetchBookings">查询</el-button>
      </div>
    </div>

    <el-table :data="bookingList" v-loading="loading" stripe>
      <el-table-column prop="id" label="预约编号" width="100" />
      <el-table-column prop="room_name" label="会议室" min-width="120" />
      <el-table-column prop="meeting_title" label="会议主题" min-width="150" show-overflow-tooltip />
      <el-table-column prop="attendee_count" label="参会人数" width="100" />
      <el-table-column label="日期时间" width="280">
        <template #default="{ row }">
          <div>{{ row.date }}</div>
          <div style="color: #909399; font-size: 12px;">{{ row.start_time }} - {{ row.end_time }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="status_name" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="getStatusTagType(row.status)" size="small">{{ row.status_name }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="180">
        <template #default="{ row }">
          {{ formatDateTime(row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" link @click="viewDetail(row)">详情</el-button>
          <el-button
            type="danger"
            size="small"
            link
            :disabled="row.status === 'cancelled' || row.status === 'completed'"
            @click="cancelBooking(row)"
          >
            取消
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
        @current-change="fetchBookings"
      />
    </div>

    <el-dialog v-model="detailDialogVisible" title="预约详情" width="600px">
      <div v-if="currentBooking" class="booking-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="预约编号">{{ currentBooking.id }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusTagType(currentBooking.status)">
              {{ currentBooking.status_name }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="会议室">{{ currentBooking.room_name }}</el-descriptions-item>
          <el-descriptions-item label="位置">{{ currentBooking.room_location }}</el-descriptions-item>
          <el-descriptions-item label="会议主题">{{ currentBooking.meeting_title }}</el-descriptions-item>
          <el-descriptions-item label="参会人数">{{ currentBooking.attendee_count }} 人</el-descriptions-item>
          <el-descriptions-item label="日期">{{ currentBooking.date }}</el-descriptions-item>
          <el-descriptions-item label="时间">{{ currentBooking.start_time }} - {{ currentBooking.end_time }}</el-descriptions-item>
          <el-descriptions-item label="会议描述" :span="2">
            {{ currentBooking.meeting_description || '无' }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间" :span="2">
            {{ formatDateTime(currentBooking.created_at) }}
          </el-descriptions-item>
        </el-descriptions>

        <div v-if="currentBooking.borrowings?.length > 0" class="borrowed-assets">
          <h4>借用资产</h4>
          <el-table :data="currentBooking.borrowings" size="small">
            <el-table-column prop="asset_name" label="资产名称" />
            <el-table-column prop="asset_category_name" label="分类" width="100" />
            <el-table-column prop="quantity" label="数量" width="80" />
            <el-table-column prop="status_name" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'returned' ? 'success' : 'warning'" size="small">
                  {{ row.status_name }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { getMyBookings, cancelBooking, getBookingDetail } from '@/api/booking'

const bookingList = ref([])
const loading = ref(false)
const detailDialogVisible = ref(false)
const currentBooking = ref(null)

const filterForm = reactive({
  status: '',
  date_range: []
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

async function fetchBookings() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.page_size,
      status: filterForm.status || undefined,
      date_from: filterForm.date_range?.[0],
      date_to: filterForm.date_range?.[1]
    }
    const res = await getMyBookings(params)
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

function getStatusTagType(status) {
  const typeMap = {
    'pending': 'warning',
    'in_use': 'primary',
    'completed': 'success',
    'cancelled': 'info'
  }
  return typeMap[status] || 'info'
}

function formatDateTime(datetime) {
  return datetime ? dayjs(datetime).format('YYYY-MM-DD HH:mm:ss') : '-'
}

async function viewDetail(row) {
  try {
    const res = await getBookingDetail(row.id)
    currentBooking.value = res.data
    detailDialogVisible.value = true
  } catch (error) {
    console.error('Get booking detail failed:', error)
  }
}

async function cancelBooking(row) {
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
.my-bookings {
  .filter-bar {
    display: flex;
    align-items: center;
  }

  .pagination-container {
    margin-top: 20px;
    text-align: right;
  }

  .booking-detail {
    .borrowed-assets {
      margin-top: 20px;

      h4 {
        margin: 0 0 12px 0;
        font-size: 16px;
        color: #303133;
      }
    }
  }
}
</style>
