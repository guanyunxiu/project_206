<template>
  <div class="page-container checkin-page" v-loading="loading">
    <div class="page-header">
      <h2 class="page-title">会议签到</h2>
      <el-button @click="goBack">返回</el-button>
    </div>

    <el-row :gutter="20">
      <el-col :lg="16" :md="24" :xs="24">
        <el-card class="info-card">
          <template #header>
            <span class="card-title">会议基本信息</span>
          </template>
          <el-descriptions :column="2" border v-if="bookingDetail">
            <el-descriptions-item label="预约编号">{{ bookingDetail.id }}</el-descriptions-item>
            <el-descriptions-item label="签到状态">
              <el-tag :type="getCheckinStatusTagType(bookingDetail.checkin_status)">
                {{ getCheckinStatusText(bookingDetail.checkin_status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="会议室">{{ bookingDetail.room_name }}</el-descriptions-item>
            <el-descriptions-item label="位置">{{ bookingDetail.room_location }}</el-descriptions-item>
            <el-descriptions-item label="会议主题">{{ bookingDetail.meeting_title }}</el-descriptions-item>
            <el-descriptions-item label="参会人数">{{ bookingDetail.attendee_count }} 人</el-descriptions-item>
            <el-descriptions-item label="日期">{{ bookingDetail.date }}</el-descriptions-item>
            <el-descriptions-item label="时间">{{ bookingDetail.start_time }} - {{ bookingDetail.end_time }}</el-descriptions-item>
            <el-descriptions-item label="签到时间" v-if="bookingDetail.checkin_time">
              {{ formatDateTime(bookingDetail.checkin_time) }}
            </el-descriptions-item>
            <el-descriptions-item label="签到方式" v-if="bookingDetail.checkin_method">
              {{ getCheckinMethodText(bookingDetail.checkin_method) }}
            </el-descriptions-item>
            <el-descriptions-item label="会议描述" :span="2">
              {{ bookingDetail.meeting_description || '无' }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card class="records-card">
          <template #header>
            <span class="card-title">签到记录</span>
          </template>
          <el-table :data="checkinRecords" v-loading="recordsLoading" stripe>
            <el-table-column prop="id" label="编号" width="80" />
            <el-table-column label="签到时间" width="180">
              <template #default="{ row }">
                {{ formatDateTime(row.checkin_time) }}
              </template>
            </el-table-column>
            <el-table-column prop="checkin_method" label="签到方式" width="120">
              <template #default="{ row }">
                {{ getCheckinMethodText(row.checkin_method) }}
              </template>
            </el-table-column>
            <el-table-column prop="operator_name" label="操作人" />
            <el-table-column prop="remark" label="备注" show-overflow-tooltip />
          </el-table>
          <el-empty v-if="checkinRecords.length === 0" description="暂无签到记录" :image-size="100" />
        </el-card>
      </el-col>

      <el-col :lg="8" :md="24" :xs="24">
        <el-card class="qrcode-card">
          <template #header>
            <span class="card-title">签到二维码</span>
          </template>
          <div class="qrcode-container">
            <div class="qrcode-wrapper" v-if="qrcodeData">
              <el-image :src="qrcodeData" fit="contain" />
            </div>
            <el-empty v-else description="二维码加载中..." :image-size="80" />
          </div>
          <div class="checkin-actions">
            <el-alert
              v-if="bookingDetail?.checkin_status === 'pending'"
              title="签到宽限时间提示"
              type="info"
              :closable="false"
              show-icon
              style="margin-bottom: 16px;"
            >
              <template #default>
              请在会议开始前 15 分钟至会议开始后 30 分钟内完成签到，逾期将被标记为爽约。
              </template>
            </el-alert>
            <el-alert
              v-if="bookingDetail?.checkin_status === 'checked_in'"
              title="已完成签到"
              type="success"
              :closable="false"
              show-icon
              style="margin-bottom: 16px;"
            >
              <template #default>
              您已成功签到，请准时参加会议。
              </template>
            </el-alert>
            <el-alert
              v-if="bookingDetail?.checkin_status === 'no_show'"
              title="已标记为爽约"
              type="error"
              :closable="false"
              show-icon
              style="margin-bottom: 16px;"
            >
              <template #default>
              您未在规定时间内签到，已被标记为爽约。
              </template>
            </el-alert>
            <el-button
              v-if="bookingDetail?.checkin_status === 'pending'"
              type="primary"
              size="large"
              :loading="checkingIn"
              style="width: 100%;"
              @click="handleCheckin"
            >
              签到（后台签到）
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import { getBookingDetail } from '@/api/booking'
import { getQRCode, checkin, getCheckinRecords } from '@/api/checkin'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const recordsLoading = ref(false)
const checkingIn = ref(false)
const bookingDetail = ref(null)
const qrcodeData = ref('')
const checkinRecords = ref([])

function getCheckinStatusText(status) {
  const statusMap = {
    pending: '待签到',
    checked_in: '已签到',
    no_show: '已爽约'
  }
  return statusMap[status] || status
}

function getCheckinStatusTagType(status) {
  const typeMap = {
    pending: 'warning',
    checked_in: 'success',
    no_show: 'danger'
  }
  return typeMap[status] || 'info'
}

function getCheckinMethodText(method) {
  const methodMap = {
    qrcode: '二维码签到',
    manual: '后台签到'
  }
  return methodMap[method] || method
}

function formatDateTime(datetime) {
  return datetime ? dayjs(datetime).format('YYYY-MM-DD HH:mm:ss') : '-'
}

async function fetchBookingDetail() {
  loading.value = true
  try {
    const bookingId = route.params.id
    const res = await getBookingDetail(bookingId)
    bookingDetail.value = res.data
    await fetchQRCode(bookingId)
    await fetchCheckinRecords(bookingId)
  } catch (error) {
    console.error('Fetch booking detail failed:', error)
  } finally {
    loading.value = false
  }
}

async function fetchQRCode(bookingId) {
  try {
    const res = await getQRCode(bookingId)
    qrcodeData.value = res.data
  } catch (error) {
    console.error('Fetch QR code failed:', error)
  }
}

async function fetchCheckinRecords(bookingId) {
  recordsLoading.value = true
  try {
    const res = await getCheckinRecords(bookingId)
    checkinRecords.value = res.data || []
  } catch (error) {
    console.error('Fetch checkin records failed:', error)
  } finally {
    recordsLoading.value = false
  }
}

async function handleCheckin() {
  ElMessageBox.confirm('确定要执行后台签到吗？', '确认签到', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
      checkingIn.value = true
      try {
        await checkin({
          booking_id: route.params.id,
          method: 'manual'
        })
        ElMessage.success('签到成功')
        await fetchBookingDetail()
      } catch (error) {
        console.error('Checkin failed:', error)
      } finally {
        checkingIn.value = false
      }
    }).catch(() => {})
}

function goBack() {
  router.back()
}

onMounted(() => {
  fetchBookingDetail()
})
</script>

<style lang="scss" scoped>
.checkin-page {
  .info-card,
  .records-card,
  .qrcode-card {
    margin-bottom: 20px;
  }

  .card-title {
    font-weight: 600;
    font-size: 16px;
    color: #303133;
  }

  .qrcode-card {
    position: sticky;
    top: 20px;

    .qrcode-container {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px 0;
      min-height: 280px;

      .qrcode-wrapper {
        width: 240px;
        height: 240px;
        border: 2px solid #ebeef5;
        border-radius: 12px;
        padding: 10px;
        background: #fff;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);

        :deep(.el-image) {
          width: 100%;
          height: 100%;
        }
      }
    }

    .checkin-actions {
      margin-top: 20px;
    }
  }
}
</style>
