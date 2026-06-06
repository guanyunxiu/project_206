<template>
  <div class="page-container approval-detail" v-loading="loading">
    <div class="page-header">
      <h2 class="page-title">审批详情</h2>
      <el-button @click="goBack">返回</el-button>
    </div>

    <el-row :gutter="20">
      <el-col :lg="16" :md="24" :xs="24">
        <el-card class="info-card">
          <template #header>
            <span class="card-title">预约基本信息</span>
          </template>
          <el-descriptions :column="2" border v-if="bookingDetail">
            <el-descriptions-item label="预约编号">{{ bookingDetail.id }}</el-descriptions-item>
            <el-descriptions-item label="审批状态">
              <el-tag :type="getApprovalStatusTagType(bookingDetail.approval_status)">
                {{ getApprovalStatusText(bookingDetail.approval_status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="会议室">{{ bookingDetail.room_name }}</el-descriptions-item>
            <el-descriptions-item label="位置">{{ bookingDetail.room_location }}</el-descriptions-item>
            <el-descriptions-item label="会议主题">{{ bookingDetail.meeting_title }}</el-descriptions-item>
            <el-descriptions-item label="参会人数">{{ bookingDetail.attendee_count }} 人</el-descriptions-item>
            <el-descriptions-item label="日期">{{ bookingDetail.date }}</el-descriptions-item>
            <el-descriptions-item label="时间">{{ bookingDetail.start_time }} - {{ bookingDetail.end_time }}</el-descriptions-item>
            <el-descriptions-item label="申请人">{{ bookingDetail.applicant_name }}</el-descriptions-item>
            <el-descriptions-item label="申请时间">{{ formatDateTime(bookingDetail.created_at) }}</el-descriptions-item>
            <el-descriptions-item label="会议描述" :span="2">
              {{ bookingDetail.meeting_description || '无' }}
            </el-descriptions-item>
          </el-descriptions>

          <div v-if="bookingDetail?.borrowings?.length > 0" class="borrowed-assets">
            <h4>借用资产</h4>
            <el-table :data="bookingDetail.borrowings" size="small">
              <el-table-column prop="asset_name" label="资产名称" />
              <el-table-column prop="asset_category_name" label="分类" width="100" />
              <el-table-column prop="quantity" label="数量" width="80" />
            </el-table>
          </div>
        </el-card>

        <el-card class="timeline-card">
          <template #header>
            <span class="card-title">审批记录</span>
          </template>
          <el-timeline v-if="approvalRecords.length > 0">
            <el-timeline-item
              v-for="(record, index) in approvalRecords"
              :key="index"
              :timestamp="formatDateTime(record.created_at)"
              :type="record.action === 'approved' ? 'success' : 'danger'"
              :icon="record.action === 'approved' ? 'CircleCheck' : 'CircleClose'"
            >
              <div class="timeline-content">
                <div class="timeline-header">
                  <span class="approver-name">{{ record.approver_name }}</span>
                  <el-tag size="small" :type="record.action === 'approved' ? 'success' : 'danger'">
                    {{ record.action === 'approved' ? '通过' : '驳回' }}
                  </el-tag>
                  <span class="step-name">{{ getStepName(record.step) }}</span>
                </div>
                <div class="timeline-comment" v-if="record.comment">
                  {{ record.comment }}
                </div>
              </div>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-else description="暂无审批记录" :image-size="100" />
        </el-card>

        <el-card class="resubmit-card" v-if="bookingDetail?.approval_status === 'rejected'">
          <template #header>
            <span class="card-title">重新提交</span>
          </template>
          <el-alert
            title="预约已被驳回，请修改后重新提交"
            type="warning"
            :closable="false"
            style="margin-bottom: 20px;"
          />
          <el-form :model="resubmitForm" :rules="resubmitRules" ref="resubmitFormRef" label-width="100px">
            <el-row :gutter="20">
              <el-col :md="12" :xs="24">
                <el-form-item label="会议室" prop="room_id">
                  <el-select
                    v-model="resubmitForm.room_id"
                    placeholder="请选择会议室"
                    style="width: 100%;"
                    filterable
                    @change="onRoomChange"
                  >
                    <el-option
                      v-for="room in roomList"
                      :key="room.id"
                      :label="`${room.name} (${room.capacity}人)`"
                      :value="room.id"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :md="12" :xs="24">
                <el-form-item label="日期" prop="date">
                  <el-date-picker
                    v-model="resubmitForm.date"
                    type="date"
                    placeholder="选择日期"
                    style="width: 100%;"
                    :disabled-date="disabledDate"
                  />
                </el-form-item>
              </el-col>
              <el-col :md="12" :xs="24">
                <el-form-item label="开始时间" prop="start_time">
                  <el-time-select
                    v-model="resubmitForm.start_time"
                    start="08:00"
                    step="00:30"
                    end="19:30"
                    placeholder="选择开始时间"
                    style="width: 100%;"
                  />
                </el-form-item>
              </el-col>
              <el-col :md="12" :xs="24">
                <el-form-item label="结束时间" prop="end_time">
                  <el-time-select
                    v-model="resubmitForm.end_time"
                    start="08:30"
                    step="00:30"
                    end="20:00"
                    placeholder="选择结束时间"
                    style="width: 100%;"
                    :min-time="resubmitForm.start_time"
                  />
                </el-form-item>
              </el-col>
              <el-col :md="12" :xs="24">
                <el-form-item label="会议主题" prop="meeting_title">
                  <el-input v-model="resubmitForm.meeting_title" placeholder="请输入会议主题" />
                </el-form-item>
              </el-col>
              <el-col :md="12" :xs="24">
                <el-form-item label="参会人数" prop="attendee_count">
                  <el-input-number
                    v-model="resubmitForm.attendee_count"
                    :min="1"
                    :max="selectedRoom?.capacity || 100"
                    style="width: 100%;"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label="会议描述">
                  <el-input
                    v-model="resubmitForm.meeting_description"
                    type="textarea"
                    :rows="3"
                    placeholder="请输入会议描述"
                  />
                </el-form-item>
              </el-col>
            </el-row>
            <div class="form-actions">
              <el-button @click="resetResubmitForm">重置</el-button>
              <el-button type="primary" :loading="submitting" @click="handleResubmit">
                重新提交
              </el-button>
            </div>
          </el-form>
        </el-card>
      </el-col>

      <el-col :lg="8" :md="24" :xs="24">
        <el-card class="progress-card">
          <template #header>
            <span class="card-title">审批进度</span>
          </template>
          <el-steps
            :active="getActiveStep()"
            direction="vertical"
            :finish-status="bookingDetail?.approval_status === 'rejected' ? 'error' : 'success'"
          >
            <el-step title="待开始" description="等待提交审批" />
            <el-step title="部门审批" description="部门负责人审批" />
            <el-step title="行政确认" description="行政人员确认" />
            <el-step title="已完成" description="审批通过" />
          </el-steps>

          <div class="approval-actions" v-if="canApprove">
            <el-divider />
            <h4>审批操作</h4>
            <el-form label-width="80px">
              <el-form-item label="审批意见">
                <el-input
                  v-model="approvalComment"
                  type="textarea"
                  :rows="3"
                  placeholder="请输入审批意见（可选）"
                />
              </el-form-item>
              <div class="action-buttons">
                <el-button type="success" :loading="approving" @click="handleApprove">
                  通过
                </el-button>
                <el-button type="danger" :loading="rejecting" @click="handleReject">
                  驳回
                </el-button>
              </div>
            </el-form>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleCheck, CircleClose } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useUserStore } from '@/store/user'
import { getBookingDetail } from '@/api/booking'
import { getRoomList } from '@/api/room'
import {
  getApprovalRecords,
  approveBooking,
  rejectBooking,
  resubmitBooking
} from '@/api/approval'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const approving = ref(false)
const rejecting = ref(false)
const submitting = ref(false)
const bookingDetail = ref(null)
const approvalRecords = ref([])
const approvalComment = ref('')
const roomList = ref([])
const selectedRoom = ref(null)
const resubmitFormRef = ref(null)

const resubmitForm = reactive({
  room_id: null,
  date: '',
  start_time: '',
  end_time: '',
  meeting_title: '',
  meeting_description: '',
  attendee_count: 1
})

const resubmitRules = {
  room_id: [{ required: true, message: '请选择会议室', trigger: 'change' }],
  date: [{ required: true, message: '请选择日期', trigger: 'change' }],
  start_time: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  end_time: [{ required: true, message: '请选择结束时间', trigger: 'change' }],
  meeting_title: [{ required: true, message: '请输入会议主题', trigger: 'blur' }],
  attendee_count: [{ required: true, message: '请输入参会人数', trigger: 'blur' }]
}

const canApprove = computed(() => {
  if (!bookingDetail.value) return false
  const isPending = bookingDetail.value.approval_status === 'pending'
  const isApprover = checkIsApprover()
  return isPending && isApprover
})

function checkIsApprover() {
  if (!bookingDetail.value || !userStore.userInfo) return false
  const currentStep = bookingDetail.value.current_approval_step
  const userRole = userStore.userInfo.role
  
  if (currentStep === 1) {
    return userRole === 'dept_admin' || userRole === 'admin' || userRole === 'super_admin'
  } else if (currentStep === 2) {
    return userRole === 'admin' || userRole === 'super_admin'
  }
  return false
}

function getActiveStep() {
  if (!bookingDetail.value) return 0
  if (bookingDetail.value.approval_status === 'rejected') {
    return bookingDetail.value.current_approval_step || 0
  }
  if (bookingDetail.value.approval_status === 'approved') {
    return 3
  }
  return bookingDetail.value.current_approval_step || 0
}

function getApprovalStatusText(status) {
  const statusMap = {
    pending: '待审批',
    approved: '已通过',
    rejected: '已驳回',
    cancelled: '已取消'
  }
  return statusMap[status] || status
}

function getApprovalStatusTagType(status) {
  const typeMap = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
    cancelled: 'info'
  }
  return typeMap[status] || 'info'
}

function getStepName(step) {
  const stepMap = {
    0: '待开始',
    1: '部门审批',
    2: '行政确认',
    3: '已完成'
  }
  return stepMap[step] || `步骤${step}`
}

function formatDateTime(datetime) {
  return datetime ? dayjs(datetime).format('YYYY-MM-DD HH:mm:ss') : '-'
}

function disabledDate(time) {
  return time.getTime() < dayjs().startOf('day').toDate().getTime()
}

function onRoomChange(roomId) {
  selectedRoom.value = roomList.value.find(r => r.id === roomId)
}

async function fetchBookingDetail() {
  loading.value = true
  try {
    const res = await getBookingDetail(route.params.id)
    bookingDetail.value = res.data
    await fetchApprovalRecords()
    if (bookingDetail.value.approval_status === 'rejected') {
      await fetchRooms()
      initResubmitForm()
    }
  } catch (error) {
    console.error('Fetch booking detail failed:', error)
  } finally {
    loading.value = false
  }
}

async function fetchApprovalRecords() {
  try {
    const res = await getApprovalRecords(route.params.id)
    approvalRecords.value = res.data || []
  } catch (error) {
    console.error('Fetch approval records failed:', error)
  }
}

async function fetchRooms() {
  try {
    const res = await getRoomList({ pageSize: 100 })
    roomList.value = res.data.list
  } catch (error) {
    console.error('Fetch rooms failed:', error)
  }
}

function initResubmitForm() {
  if (!bookingDetail.value) return
  resubmitForm.room_id = bookingDetail.value.room_id
  resubmitForm.date = bookingDetail.value.date
  resubmitForm.start_time = bookingDetail.value.start_time
  resubmitForm.end_time = bookingDetail.value.end_time
  resubmitForm.meeting_title = bookingDetail.value.meeting_title
  resubmitForm.meeting_description = bookingDetail.value.meeting_description || ''
  resubmitForm.attendee_count = bookingDetail.value.attendee_count
  onRoomChange(bookingDetail.value.room_id)
}

function resetResubmitForm() {
  initResubmitForm()
}

async function handleApprove() {
  ElMessageBox.confirm('确定要通过该预约吗？', '确认通过', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'success'
  }).then(async () => {
    approving.value = true
    try {
      await approveBooking(route.params.id, { comment: approvalComment.value })
      ElMessage.success('审批通过')
      approvalComment.value = ''
      await fetchBookingDetail()
    } catch (error) {
      console.error('Approve booking failed:', error)
    } finally {
      approving.value = false
    }
  }).catch(() => {})
}

async function handleReject() {
  ElMessageBox.confirm('确定要驳回该预约吗？', '确认驳回', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    rejecting.value = true
    try {
      await rejectBooking(route.params.id, { comment: approvalComment.value })
      ElMessage.success('已驳回')
      approvalComment.value = ''
      await fetchBookingDetail()
    } catch (error) {
      console.error('Reject booking failed:', error)
    } finally {
      rejecting.value = false
    }
  }).catch(() => {})
}

async function handleResubmit() {
  if (!resubmitFormRef.value) return
  
  await resubmitFormRef.value.validate(async (valid) => {
    if (!valid) return

    submitting.value = true
    try {
      await resubmitBooking(route.params.id, {
        ...resubmitForm
      })
      ElMessage.success('重新提交成功')
      await fetchBookingDetail()
    } catch (error) {
      console.error('Resubmit booking failed:', error)
    } finally {
      submitting.value = false
    }
  })
}

function goBack() {
  router.back()
}

onMounted(() => {
  fetchBookingDetail()
})
</script>

<style lang="scss" scoped>
.approval-detail {
  .info-card,
  .timeline-card,
  .progress-card,
  .resubmit-card {
    margin-bottom: 20px;
  }

  .card-title {
    font-weight: 600;
    font-size: 16px;
    color: #303133;
  }

  .borrowed-assets {
    margin-top: 20px;

    h4 {
      margin: 0 0 12px 0;
      font-size: 16px;
      color: #303133;
    }
  }

  .timeline-content {
    .timeline-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;

      .approver-name {
        font-weight: 600;
        color: #303133;
      }

      .step-name {
        color: #909399;
        font-size: 12px;
      }
    }

    .timeline-comment {
      color: #606266;
      font-size: 14px;
      line-height: 1.6;
    }
  }

  .progress-card {
    position: sticky;
    top: 20px;

    .approval-actions {
      h4 {
        margin: 0 0 16px 0;
        font-size: 16px;
        color: #303133;
      }

      .action-buttons {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }
    }
  }

  .resubmit-card {
    .form-actions {
      text-align: right;
      margin-top: 20px;

      .el-button {
        margin-left: 12px;
      }
    }
  }
}
</style>
