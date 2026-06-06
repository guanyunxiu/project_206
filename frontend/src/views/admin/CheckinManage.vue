<template>
  <div class="page-container admin-page">
    <div class="page-header">
      <h2 class="page-title">签到管理</h2>
      <div class="header-actions">
        <el-button type="primary" :icon="Plus" @click="openManualCheckinDialog">后台签到</el-button>
      </div>
    </div>

    <div class="search-bar">
      <el-input
        v-model="searchForm.keyword"
        placeholder="搜索会议主题、签到人、会议室"
        :prefix-icon="Search"
        clearable
        style="width: 250px; margin-right: 12px;"
        @keyup.enter="fetchRecords"
      />
      <el-select v-model="searchForm.checkin_method" placeholder="签到方式" clearable style="width: 140px; margin-right: 12px;">
        <el-option label="二维码签到" value="qrcode" />
        <el-option label="后台签到" value="manual" />
      </el-select>
      <el-select v-model="searchForm.is_late" placeholder="是否迟到" clearable style="width: 120px; margin-right: 12px;">
        <el-option label="准时" :value="0" />
        <el-option label="迟到" :value="1" />
      </el-select>
      <el-date-picker
        v-model="searchForm.date_range"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        style="width: 260px; margin-right: 12px;"
      />
      <el-button type="primary" :icon="Search" @click="fetchRecords">搜索</el-button>
      <el-button :icon="Refresh" @click="resetSearch">重置</el-button>
    </div>

    <el-table :data="recordList" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="meeting_title" label="会议主题" min-width="150" show-overflow-tooltip />
      <el-table-column label="会议室" width="120">
        <template #default="{ row }">{{ row.room_name }}</template>
      </el-table-column>
      <el-table-column label="签到用户" width="100">
        <template #default="{ row }">{{ row.user_name }}</template>
      </el-table-column>
      <el-table-column label="会议日期" width="120">
        <template #default="{ row }">{{ row.date }}</template>
      </el-table-column>
      <el-table-column label="会议时间" width="130">
        <template #default="{ row }">
          {{ row.start_time }} - {{ row.end_time }}
        </template>
      </el-table-column>
      <el-table-column label="签到时间" width="160">
        <template #default="{ row }">{{ formatDateTime(row.checkin_time) }}</template>
      </el-table-column>
      <el-table-column label="签到方式" width="100">
        <template #default="{ row }">
          <el-tag :type="row.checkin_method === 'manual' ? 'success' : 'primary'" size="small">
            {{ row.checkin_method_name }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag v-if="row.is_late === 1" type="danger" size="small">迟到</el-tag>
          <el-tag v-else type="success" size="small">准时</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" link @click="viewCheckinRecords(row.booking_id)">签到详情</el-button>
          <el-button
            v-if="canMarkMissed(row)"
            type="danger"
            size="small"
            link
            @click="handleMarkMissed(row)"
          >标记爽约</el-button>
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
        @current-change="fetchRecords"
      />
    </div>

    <el-dialog v-model="manualCheckinVisible" title="后台签到" width="500px">
      <el-form :model="manualCheckinForm" label-width="80px">
        <el-form-item label="选择预约" required>
          <el-select
            v-model="manualCheckinForm.booking_id"
            placeholder="请选择预约"
            filterable
            remote
            reserve-keyword
            :remote-method="searchBookings"
            :loading="bookingSearchLoading"
            style="width: 100%;"
          >
            <el-option
              v-for="item in bookingOptions"
              :key="item.id"
              :label="`${item.meeting_title} - ${item.room_name} (${item.date} ${item.start_time}-${item.end_time})`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="签到用户" required>
          <el-select
            v-model="manualCheckinForm.user_id"
            placeholder="请选择签到用户"
            filterable
            remote
            reserve-keyword
            :remote-method="searchUsers"
            :loading="userSearchLoading"
            style="width: 100%;"
          >
            <el-option
              v-for="item in userOptions"
              :key="item.id"
              :label="`${item.real_name} (${item.username})`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="manualCheckinVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleManualCheckin">确认签到</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="checkinDetailVisible" title="签到详情" width="600px">
      <div v-if="checkinDetailData">
        <div class="detail-info">
          <p><strong>会议主题：</strong>{{ checkinDetailData.meeting_title }}</p>
          <p><strong>签到人数：</strong>{{ checkinDetailData.total_checked }} 人</p>
        </div>
        <el-divider />
        <el-table :data="checkinDetailData.checkin_records" stripe>
          <el-table-column prop="real_name" label="姓名" width="100" />
          <el-table-column prop="username" label="账号" width="120" />
          <el-table-column label="签到时间" width="160">
            <template #default="{ row }">{{ formatDateTime(row.checkin_time) }}</template>
          </el-table-column>
          <el-table-column label="签到方式" width="100">
            <template #default="{ row }">
              <el-tag :type="row.checkin_method === 'manual' ? 'success' : 'primary'" size="small">
                {{ row.checkin_method_name }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <el-tag v-if="row.is_late === 1" type="danger" size="small">迟到</el-tag>
              <el-tag v-else type="success" size="small">准时</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, Refresh } from '@element-plus/icons-vue'
import { getCheckinRecordList, manualCheckin, processMissed, getCheckinRecords } from '@/api/checkin'
import { getBookingList } from '@/api/booking'
import { getUserList } from '@/api/user'

const recordList = ref([])
const loading = ref(false)
const submitting = ref(false)
const bookingSearchLoading = ref(false)
const userSearchLoading = ref(false)

const manualCheckinVisible = ref(false)
const checkinDetailVisible = ref(false)
const checkinDetailData = ref(null)

const bookingOptions = ref([])
const userOptions = ref([])

const searchForm = reactive({
  keyword: '',
  checkin_method: '',
  is_late: '',
  date_range: []
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const manualCheckinForm = reactive({
  booking_id: null,
  user_id: null
})

function formatDateTime(datetime) {
  if (!datetime) return ''
  const d = new Date(datetime)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  const second = String(d.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

function canMarkMissed(row) {
  const now = new Date()
  const bookingDate = new Date(row.date)
  const [endH, endM] = row.end_time.split(':').map(Number)
  const endTime = new Date(bookingDate)
  endTime.setHours(endH, endM, 0, 0)
  return now > endTime
}

async function fetchRecords() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.page_size,
      keyword: searchForm.keyword || undefined,
      checkin_method: searchForm.checkin_method || undefined,
      is_late: searchForm.is_late !== '' ? searchForm.is_late : undefined,
      date_from: searchForm.date_range?.[0] || undefined,
      date_to: searchForm.date_range?.[1] || undefined
    }
    Object.keys(params).forEach(key => params[key] === undefined && delete params[key])
    const res = await getCheckinRecordList(params)
    recordList.value = res.data.list
    pagination.total = res.data.total
  } catch (error) {
    console.error('Fetch checkin records failed:', error)
  } finally {
    loading.value = false
  }
}

function handleSizeChange(size) {
  pagination.page_size = size
  pagination.page = 1
  fetchRecords()
}

function resetSearch() {
  searchForm.keyword = ''
  searchForm.checkin_method = ''
  searchForm.is_late = ''
  searchForm.date_range = []
  pagination.page = 1
  fetchRecords()
}

function openManualCheckinDialog() {
  manualCheckinForm.booking_id = null
  manualCheckinForm.user_id = null
  bookingOptions.value = []
  userOptions.value = []
  manualCheckinVisible.value = true
}

async function searchBookings(query) {
  if (!query) {
    bookingOptions.value = []
    return
  }
  bookingSearchLoading.value = true
  try {
    const res = await getBookingList({ keyword: query, pageSize: 20, status: 'pending' })
    bookingOptions.value = res.data.list
  } catch (error) {
    console.error('Search bookings failed:', error)
  } finally {
    bookingSearchLoading.value = false
  }
}

async function searchUsers(query) {
  if (!query) {
    userOptions.value = []
    return
  }
  userSearchLoading.value = true
  try {
    const res = await getUserList({ keyword: query, pageSize: 20 })
    userOptions.value = res.data.list
  } catch (error) {
    console.error('Search users failed:', error)
  } finally {
    userSearchLoading.value = false
  }
}

async function handleManualCheckin() {
  if (!manualCheckinForm.booking_id || !manualCheckinForm.user_id) {
    ElMessage.warning('请选择预约和签到用户')
    return
  }
  submitting.value = true
  try {
    await manualCheckin(manualCheckinForm.booking_id, { user_id: manualCheckinForm.user_id })
    ElMessage.success('后台签到成功')
    manualCheckinVisible.value = false
    fetchRecords()
  } catch (error) {
    console.error('Manual checkin failed:', error)
  } finally {
    submitting.value = false
  }
}

async function handleMarkMissed(row) {
  ElMessageBox.confirm(
    `确定要将会议「${row.meeting_title}」标记为爽约吗？`,
    '提示',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      await processMissed({ booking_id: row.booking_id })
      ElMessage.success('已标记为爽约')
      fetchRecords()
    } catch (error) {
      console.error('Mark missed failed:', error)
    }
  }).catch(() => {})
}

async function viewCheckinRecords(bookingId) {
  try {
    const res = await getCheckinRecords(bookingId)
    checkinDetailData.value = res.data
    checkinDetailVisible.value = true
  } catch (error) {
    console.error('Get checkin detail failed:', error)
  }
}

onMounted(() => {
  fetchRecords()
})
</script>

<style lang="scss" scoped>
.admin-page {
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .search-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 20px;
  }

  .pagination-container {
    margin-top: 20px;
    text-align: right;
  }

  .detail-info {
    p {
      margin: 8px 0;
      line-height: 1.6;
    }
  }
}
</style>
