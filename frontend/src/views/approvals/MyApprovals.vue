<template>
  <div class="page-container my-approvals">
    <div class="page-header">
      <h2 class="page-title">我的审批</h2>
      <div class="filter-bar">
        <el-select v-model="filterForm.status" placeholder="审批状态" clearable style="width: 150px; margin-right: 12px;">
          <el-option label="自动通过" value="auto_approved" />
          <el-option label="等待部门审批" value="pending_dept" />
          <el-option label="等待行政审批" value="pending_admin" />
          <el-option label="已通过" value="approved" />
          <el-option label="已驳回" value="rejected" />
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
        <el-button type="primary" :icon="Search" @click="fetchApprovals">查询</el-button>
      </div>
    </div>

    <el-table :data="approvalList" v-loading="loading" stripe>
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
      <el-table-column prop="current_step_name" label="当前审批步骤" width="140">
        <template #default="{ row }">
          {{ row.current_step_name || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="approval_status_name" label="审批状态" width="120">
        <template #default="{ row }">
          <el-tag :type="getApprovalTagType(row.approval_status)" size="small">
            {{ row.approval_status_name }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" link @click="viewDetail(row)">详情</el-button>
          <el-button
            type="warning"
            size="small"
            link
            v-if="row.approval_status === 'rejected'"
            @click="openResubmitDialog(row)"
          >
            重新提交
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
        @current-change="fetchApprovals"
      />
    </div>

    <el-dialog v-model="resubmitDialogVisible" title="重新提交预约" width="800px" :close-on-click-modal="false">
      <el-form :model="resubmitForm" :rules="bookingRules" ref="resubmitFormRef" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
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
          <el-col :span="12">
            <el-form-item label="日期" prop="date">
              <el-date-picker
                v-model="resubmitForm.date"
                type="date"
                placeholder="选择日期"
                style="width: 100%;"
                :disabled-date="disabledDate"
                @change="onDateChange"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="开始时间" prop="start_time">
              <el-time-select
                v-model="resubmitForm.start_time"
                start="08:00"
                step="00:30"
                end="19:30"
                placeholder="选择开始时间"
                style="width: 100%;"
                :disabled="!resubmitForm.room_id || !resubmitForm.date"
                @change="checkConflict"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束时间" prop="end_time">
              <el-time-select
                v-model="resubmitForm.end_time"
                start="08:30"
                step="00:30"
                end="20:00"
                placeholder="选择结束时间"
                style="width: 100%;"
                :disabled="!resubmitForm.start_time"
                :min-time="resubmitForm.start_time"
                @change="checkConflict"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24" v-if="conflictResult">
            <el-form-item label="">
              <el-alert
                :type="conflictResult.has_conflict ? 'error' : 'success'"
                :title="conflictResult.has_conflict ? '时间冲突' : '时间可用'"
                :description="conflictResult.has_conflict ? `与「${conflictResult.conflict_info?.title}」冲突 (${conflictResult.conflict_info?.start_time}-${conflictResult.conflict_info?.end_time})` : '该时段可以预约'"
                show-icon
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="会议主题" prop="meeting_title">
              <el-input v-model="resubmitForm.meeting_title" placeholder="请输入会议主题" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="参会人数" prop="attendee_count">
              <el-input-number v-model="resubmitForm.attendee_count" :min="1" :max="selectedRoom?.capacity || 100" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="会议描述">
              <el-input v-model="resubmitForm.meeting_description" type="textarea" :rows="3" placeholder="请输入会议描述" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="借用资产">
              <div class="asset-list">
                <el-row :gutter="16">
                  <el-col :xs="12" :sm="8" v-for="asset in assetList" :key="asset.id">
                    <div class="asset-item" :class="{ 'asset-selected': isAssetSelected(asset.id) }">
                      <div class="asset-header">
                        <span class="asset-name">{{ asset.name }}</span>
                        <span class="asset-stock">库存: {{ asset.available_quantity }}</span>
                      </div>
                      <div class="asset-category">
                        <el-tag size="small" type="info">{{ asset.category_name }}</el-tag>
                      </div>
                      <div class="asset-desc">{{ asset.description }}</div>
                      <div class="asset-qty">
                        <el-input-number
                          v-model="assetQuantities[asset.id]"
                          :min="0"
                          :max="asset.available_quantity"
                          :disabled="asset.available_quantity === 0"
                          size="small"
                          @change="onAssetQtyChange(asset)"
                        />
                      </div>
                    </div>
                  </el-col>
                </el-row>
              </div>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="resubmitDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleResubmit">重新提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { getMyApprovals, resubmitBooking } from '@/api/approval'
import { getRoomList } from '@/api/room'
import { getAssetList } from '@/api/asset'
import { checkConflict as checkConflictApi } from '@/api/booking'

const router = useRouter()

const approvalList = ref([])
const loading = ref(false)
const resubmitDialogVisible = ref(false)
const resubmitFormRef = ref(null)
const currentApproval = ref(null)
const roomList = ref([])
const assetList = ref([])
const assetQuantities = reactive({})
const selectedRoom = ref(null)
const conflictResult = ref(null)
const submitting = ref(false)

const filterForm = reactive({
  status: '',
  date_range: []
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const resubmitForm = reactive({
  room_id: null,
  date: '',
  start_time: '',
  end_time: '',
  meeting_title: '',
  meeting_description: '',
  attendee_count: 1
})

const bookingRules = {
  room_id: [{ required: true, message: '请选择会议室', trigger: 'change' }],
  date: [{ required: true, message: '请选择日期', trigger: 'change' }],
  start_time: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  end_time: [{ required: true, message: '请选择结束时间', trigger: 'change' }],
  meeting_title: [{ required: true, message: '请输入会议主题', trigger: 'blur' }],
  attendee_count: [{ required: true, message: '请输入参会人数', trigger: 'blur' }]
}

function disabledDate(time) {
  return time.getTime() < dayjs().startOf('day').toDate().getTime()
}

async function fetchApprovals() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.page_size,
      status: filterForm.status || undefined,
      date_from: filterForm.date_range?.[0],
      date_to: filterForm.date_range?.[1]
    }
    const res = await getMyApprovals(params)
    approvalList.value = res.data.list
    pagination.total = res.data.total
  } catch (error) {
    console.error('Fetch approvals failed:', error)
  } finally {
    loading.value = false
  }
}

function handleSizeChange(size) {
  pagination.page_size = size
  pagination.page = 1
  fetchApprovals()
}

function getApprovalTagType(status) {
  const typeMap = {
    'auto_approved': 'success',
    'pending_dept': 'warning',
    'pending_admin': 'warning',
    'approved': 'success',
    'rejected': 'danger'
  }
  return typeMap[status] || 'info'
}

function viewDetail(row) {
  router.push(`/approvals/${row.id}`)
}

async function fetchRooms() {
  try {
    const res = await getRoomList({ pageSize: 100 })
    roomList.value = res.data.list
  } catch (error) {
    console.error('Fetch rooms failed:', error)
  }
}

async function fetchAssets() {
  try {
    const res = await getAssetList({ pageSize: 100 })
    assetList.value = res.data.list
    assetList.value.forEach(asset => {
      assetQuantities[asset.id] = 0
    })
  } catch (error) {
    console.error('Fetch assets failed:', error)
  }
}

function onRoomChange(roomId) {
  selectedRoom.value = roomList.value.find(r => r.id === roomId)
  conflictResult.value = null
}

async function onDateChange() {
  resubmitForm.start_time = ''
  resubmitForm.end_time = ''
  conflictResult.value = null
}

async function checkConflict() {
  if (resubmitForm.room_id && resubmitForm.date && resubmitForm.start_time && resubmitForm.end_time) {
    try {
      const res = await checkConflictApi({
        room_id: resubmitForm.room_id,
        date: resubmitForm.date,
        start_time: resubmitForm.start_time,
        end_time: resubmitForm.end_time
      })
      conflictResult.value = res.data
    } catch (error) {
      console.error('Check conflict failed:', error)
    }
  }
}

function isAssetSelected(assetId) {
  return assetQuantities[assetId] > 0
}

function onAssetQtyChange(asset) {
  assetQuantities[asset.id] = Math.max(0, Math.min(asset.available_quantity, assetQuantities[asset.id] || 0))
}

async function openResubmitDialog(row) {
  currentApproval.value = row
  Object.assign(resubmitForm, {
    room_id: row.room_id,
    date: row.date,
    start_time: row.start_time,
    end_time: row.end_time,
    meeting_title: row.meeting_title,
    meeting_description: row.meeting_description || '',
    attendee_count: row.attendee_count
  })
  selectedRoom.value = roomList.value.find(r => r.id === row.room_id) || null
  conflictResult.value = null
  Object.keys(assetQuantities).forEach(key => {
    assetQuantities[key] = 0
  })
  resubmitDialogVisible.value = true
}

async function handleResubmit() {
  if (!resubmitFormRef.value || !currentApproval.value) return

  await resubmitFormRef.value.validate(async (valid) => {
    if (!valid) return

    if (conflictResult.value?.has_conflict) {
      ElMessage.error('所选时间存在冲突，请重新选择时间')
      return
    }

    const assets = Object.entries(assetQuantities)
      .filter(([id, qty]) => qty > 0)
      .map(([id, qty]) => ({ asset_id: parseInt(id), quantity: qty }))

    submitting.value = true
    try {
      await resubmitBooking(currentApproval.value.id, {
        ...resubmitForm,
        assets
      })
      ElMessage.success('重新提交成功')
      resubmitDialogVisible.value = false
      fetchApprovals()
    } catch (error) {
      console.error('Resubmit booking failed:', error)
    } finally {
      submitting.value = false
    }
  })
}

onMounted(() => {
  fetchApprovals()
  fetchRooms()
  fetchAssets()
})
</script>

<style lang="scss" scoped>
.my-approvals {
  .filter-bar {
    display: flex;
    align-items: center;
  }

  .pagination-container {
    margin-top: 20px;
    text-align: right;
  }

  .asset-list {
    .asset-item {
      border: 2px solid #ebeef5;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      transition: all 0.3s;
      cursor: pointer;

      &:hover {
        border-color: #409EFF;
      }

      &.asset-selected {
        border-color: #409EFF;
        background: #ecf5ff;
      }

      .asset-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;

        .asset-name {
          font-weight: 600;
          color: #303133;
        }

        .asset-stock {
          font-size: 12px;
          color: #909399;
        }
      }

      .asset-category {
        margin-bottom: 8px;
      }

      .asset-desc {
        font-size: 12px;
        color: #606266;
        margin-bottom: 12px;
        min-height: 32px;
      }

      .asset-qty {
        text-align: right;
      }
    }
  }
}
</style>
