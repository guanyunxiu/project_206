<template>
  <div class="page-container room-detail">
    <div class="detail-header">
      <el-button :icon="ArrowLeft" @click="goBack">返回列表</el-button>
    </div>

    <el-card v-loading="loading" class="detail-card">
      <el-row :gutter="24">
        <el-col :lg="10" :md="12" :xs="24">
        <div class="room-image-large">
          <img :src="room.image_url || 'https://via.placeholder.com/600x400'" :alt="room.name" />
        </div>
        </el-col>
        <el-col :lg="14" :md="12" :xs="24">
          <div class="room-basic">
            <div class="room-title">
              <h2>{{ room.name }}</h2>
              <el-tag :type="room.status === 1 ? 'success' : 'danger'" size="large">
                {{ room.status === 1 ? '可用' : '不可用' }}
              </el-tag>
            </div>

            <div class="room-meta-list">
              <div class="meta-row">
                <span class="meta-label">容纳人数</span>
                <span class="meta-value">
                  <el-icon><User /></el-icon>
                  {{ room.capacity }} 人
                </span>
              </div>
              <div class="meta-row">
                <span class="meta-label">位置</span>
                <span class="meta-value">
                  <el-icon><Location /></el-icon>
                  {{ room.location }}
                </span>
              </div>
            </div>

            <div class="room-description">
              <h4>会议室描述</h4>
              <p>{{ room.description || '暂无描述' }}</p>
            </div>

            <div class="room-facilities">
              <h4>配套设施</h4>
              <div class="facility-list">
                <el-tag
                  v-for="(facility, index) in room.facilities_list" :key="index"
                  size="large"
                  type="primary"
                  effect="light"
                >
                  {{ facility }}
                </el-tag>
              </div>
            </div>

            <div class="room-actions">
              <el-button type="primary" size="large" :disabled="room.status !== 1" @click="goToBooking">
                <el-icon><Calendar /></el-icon>
                立即预约
              </el-button>
            </div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-card class="schedule-card">
      <template #header>
        <div class="card-header">
          <span>预约时间表</span>
          <el-date-picker
            v-model="selectedDate"
            type="date"
            :editable="false"
            :clearable="false"
            @change="fetchSchedule"
          />
        </div>
      </template>

      <div class="time-schedule">
        <div class="time-grid">
          <div
            v-for="slot in timeSlots" :key="slot.time"
            class="time-slot"
            :class="{ 'slot-available': slot.available, 'slot-booked': !slot.available }"
          >
            <div class="slot-time">{{ slot.time }}</div>
            <div v-if="slot.available" class="slot-status available">可预约</div>
            <div v-else class="slot-status booked">
              <div class="booking-title">{{ slot.booking?.title }}</div>
              <div class="booking-user">{{ slot.booking?.user_name }}</div>
            </div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, User, Location, Calendar } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { getRoomDetail, getRoomSchedule } from '@/api/room'

const route = useRoute()
const router = useRouter()

const roomId = route.params.id
const loading = ref(null)
const room = ref({})
const timeSlots = ref([])
const selectedDate = ref(dayjs().format('YYYY-MM-DD'))

async function fetchRoomDetail() {
  loading.value = true
  try {
    const res = await getRoomDetail(roomId)
    room.value = res.data
  } catch (error) {
    console.error('Fetch room detail failed:', error)
  } finally {
    loading.value = false
  }
}

async function fetchSchedule() {
  try {
    const res = await getRoomSchedule(roomId, selectedDate.value)
    timeSlots.value = res.data.time_slots || []
  } catch (error) {
    console.error('Fetch schedule failed:', error)
  }
}

function goBack() {
  router.push('/rooms')
}

function goToBooking() {
  router.push({ path: '/booking', query: { room_id: roomId, date: selectedDate.value } })
}

onMounted(() => {
  fetchRoomDetail()
  fetchSchedule()
})
</script>

<style lang="scss" scoped>
.room-detail {
  .detail-header {
    margin-bottom: 20px;
  }

  .detail-card {
    margin-bottom: 20px;

    .room-image-large {
      img {
        width: 100%;
        border-radius: 8px;
      }
    }

    .room-basic {
      .room-title {
        display: flex;
        align-items: center;
        margin-bottom: 24px;

        h2 {
          margin: 0 16px 0 0;
          font-size: 24px;
          font-weight: 600;
          color: #303133;
        }
      }

      .room-meta-list {
        margin-bottom: 24px;

        .meta-row {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
          padding: 8px 0;
          border-bottom: 1px solid #ebeef5;

          .meta-label {
            width: 100px;
            color: #909399;
          }

          .meta-value {
            flex: 1;
            display: flex;
            align-items: center;
            color: #303133;

            .el-icon {
              margin-right: 8px;
              color: #409EFF;
            }
          }
        }
      }

      .room-description, .room-facilities {
        margin-bottom: 24px;

        h4 {
          margin: 0 0 12px 0;
          font-size: 16px;
          color: #303133;
        }

        p {
          color: #606266;
          line-height: 1.6;
        }
      }

      .facility-list {
        .el-tag {
          margin-right: 12px;
          margin-bottom: 8px;
        }
      }

      .room-actions {
        margin-top: 24px;
      }
    }
  }

  .schedule-card {
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 600;
      font-size: 16px;
    }

    .time-schedule {
      .time-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 12px;
      }

      .time-slot {
        padding: 16px;
        border-radius: 8px;
        text-align: center;
        transition: all 0.3s;

        &.slot-available {
          background: #f0f9eb;
          border: 1px solid #c2e7b0;

          &:hover {
            background: #e1f3d8;
          }
        }

        &.slot-booked {
          background: #fef0f0;
          border: 1px solid #fbc4c4;
        }

        .slot-time {
          font-weight: 600;
          margin-bottom: 8px;
          color: #303133;
        }

        .slot-status {
          font-size: 12px;

          &.available {
            color: #67C23A;
          }

          &.booked {
            color: #F56C6C;

            .booking-title {
              font-weight: 500;
              margin-bottom: 4px;
            }

            .booking-user {
              font-size: 11px;
              opacity: 0.8;
            }
          }
        }
      }
    }
  }
}
</style>
