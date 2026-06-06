<template>
  <div class="page-container booking-page">
    <div class="page-header">
      <h2 class="page-title">预约会议室</h2>
    </div>

    <el-row :gutter="20">
      <el-col :lg="8" :md="12" :xs="24">
        <el-card class="step-card">
          <div class="step-title">
            <div class="step-number">1</div>
            <span>选择会议室</span>
          </div>
          <el-select
            v-model="bookingForm.room_id"
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
          <div v-if="selectedRoom" class="room-info-preview">
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="位置">{{ selectedRoom.location }}</el-descriptions-item>
              <el-descriptions-item label="容量">{{ selectedRoom.capacity }} 人</el-descriptions-item>
              <el-descriptions-item label="设施">{{ selectedRoom.facilities }}</el-descriptions-item>
            </el-descriptions>
          </div>
        </el-card>
      </el-col>

      <el-col :lg="8" :md="12" :xs="24">
        <el-card class="step-card">
          <div class="step-title">
            <div class="step-number">2</div>
            <span>选择时间</span>
          </div>
          <el-form label-width="80px">
            <el-form-item label="日期">
              <el-date-picker
                v-model="bookingForm.date"
                type="date"
                placeholder="选择日期"
                style="width: 100%;"
                :disabled-date="disabledDate"
                @change="onDateChange"
              />
            </el-form-item>
            <el-form-item label="开始时间">
              <el-time-select
                v-model="bookingForm.start_time"
                :start="08:00"
                :step="00:30"
                :end="19:30"
                placeholder="选择开始时间"
                style="width: 100%;"
                :disabled="!bookingForm.room_id || !bookingForm.date"
                @change="checkConflict"
              />
            </el-form-item>
            <el-form-item label="结束时间">
              <el-time-select
                v-model="bookingForm.end_time"
                :start="08:30"
                :step="00:30"
                :end="20:00"
                placeholder="选择结束时间"
                style="width: 100%;"
                :disabled="!bookingForm.start_time"
                :min-time="bookingForm.start_time"
                @change="checkConflict"
              />
            </el-form-item>
            <el-form-item v-if="conflictResult" label="">
              <el-alert
                :type="conflictResult.has_conflict ? 'error' : 'success'"
                :title="conflictResult.has_conflict ? '时间冲突' : '时间可用'"
                :description="conflictResult.has_conflict ? `与「${conflictResult.conflict_info?.title}」冲突 (${conflictResult.conflict_info?.start_time}-${conflictResult.conflict_info?.end_time})" : '该时段可以预约'"
                show-icon
              />
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :lg="8" :md="12" :xs="24">
        <el-card class="step-card">
          <div class="step-title">
            <div class="step-number">3</div>
            <span>会议信息</span>
          </div>
          <el-form :model="bookingForm" :rules="bookingRules" ref="bookingFormRef" label-width="80px">
            <el-form-item label="会议主题" prop="meeting_title">
              <el-input v-model="bookingForm.meeting_title" placeholder="请输入会议主题" />
            </el-form-item>
            <el-form-item label="会议描述">
              <el-input v-model="bookingForm.meeting_description" type="textarea" :rows="3" placeholder="请输入会议描述" />
            </el-form-item>
            <el-form-item label="参会人数" prop="attendee_count">
              <el-input-number v-model="bookingForm.attendee_count" :min="1" :max="selectedRoom?.capacity || 100" style="width: 100%;" />
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :lg="16" :md="24" :xs="24">
        <el-card class="step-card">
          <div class="step-title">
            <div class="step-number">4</div>
            <span>借用资产（可选）</span>
          </div>
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
        </el-card>
      </el-col>
    </el-row>

    <div class="submit-bar">
      <el-button size="large" @click="resetForm">重置</el-button>
      <el-button type="primary" size="large" :loading="submitting" @click="submitBooking">
        提交预约
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { getRoomList } from '@/api/room'
import { getAssetList } from '@/api/asset'
import { checkConflict, createBooking } from '@/api/booking'

const route = useRoute()
const router = useRouter()

const roomList = ref([])
const assetList = ref([])
const assetQuantities = reactive({})
const selectedRoom = ref(null)
const conflictResult = ref(null)
const submitting = ref(false)
const bookingFormRef = ref(null)

const bookingForm = reactive({
  room_id: route.query.room_id ? parseInt(route.query.room_id) : null,
  date: route.query.date || dayjs().format('YYYY-MM-DD'),
  start_time: '',
  end_time: '',
  meeting_title: '',
  meeting_description: '',
  attendee_count: 1
})

const bookingRules = {
  meeting_title: [{ required: true, message: '请输入会议主题', trigger: 'blur' }],
  attendee_count: [{ required: true, message: '请输入参会人数', trigger: 'blur' }]
}

function disabledDate(time) {
  return time.getTime() < dayjs().startOf('day').toDate().getTime()
}

async function fetchRooms() {
  try {
    const res = await getRoomList({ pageSize: 100 })
    roomList.value = res.data.list
    if (bookingForm.room_id) {
      onRoomChange(bookingForm.room_id)
    }
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
  bookingForm.start_time = ''
  bookingForm.end_time = ''
  conflictResult.value = null
}

async function checkConflict() {
  if (!bookingForm.room_id && bookingForm.date && bookingForm.start_time && bookingForm.end_time) {
    try {
      const res = await checkConflict({
        room_id: bookingForm.room_id,
        date: bookingForm.date,
        start_time: bookingForm.start_time,
        end_time: bookingForm.end_time
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

function resetForm() {
  bookingForm.room_id = null
  bookingForm.date = dayjs().format('YYYY-MM-DD')
  bookingForm.start_time = ''
  bookingForm.end_time = ''
  bookingForm.meeting_title = ''
  bookingForm.meeting_description = ''
  bookingForm.attendee_count = 1
  selectedRoom.value = null
  conflictResult.value = null
  Object.keys(assetQuantities).forEach(key => {
    assetQuantities[key] = 0
  })
}

async function submitBooking() {
  if (!bookingFormRef.value) return
  
  await bookingFormRef.value.validate(async (valid) => {
    if (!valid) return

    if (!bookingForm.room_id) {
      ElMessage.warning('请选择会议室')
      return
    }
    if (!bookingForm.start_time || !bookingForm.end_time) {
      ElMessage.warning('请选择预约时间')
      return
    }
    if (conflictResult.value?.has_conflict) {
      ElMessage.error('所选时间存在冲突，请重新选择时间')
      return
    }

    const assets = Object.entries(assetQuantities)
      .filter(([id, qty]) => qty > 0)
      .map(([id, qty]) => ({ asset_id: parseInt(id), quantity: qty }))

    submitting.value = true
    try {
      await createBooking({
        ...bookingForm,
        assets
      })
      ElMessage.success('预约成功')
      router.push('/my-bookings')
    } catch (error) {
      console.error('Create booking failed:', error)
    } finally {
      submitting.value = false
    }
  })
}

onMounted(() => {
  fetchRooms()
  fetchAssets()
})
</script>

<style lang="scss" scoped>
.booking-page {
  .step-card {
    margin-bottom: 20px;

    .step-title {
      display: flex;
      align-items: center;
      margin-bottom: 20px;
      font-size: 16px;
      font-weight: 600;
      color: #303133;

      .step-number {
        width: 28px;
        height: 28px;
        background: #409EFF;
        color: #fff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 12px;
        font-size: 14px;
      }
    }

    .room-info-preview {
      margin-top: 16px;
    }
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

  .submit-bar {
    position: sticky;
    bottom: 0;
    background: #fff;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.1);
    text-align: right;
    margin-top: 20px;

    .el-button {
      margin-left: 12px;
    }
  }
}
</style>
