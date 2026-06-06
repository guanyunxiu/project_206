<template>
  <div class="page-container room-list">
    <div class="page-header">
      <h2 class="page-title">会议室列表</h2>
      <div class="search-bar">
        <el-input
          v-model="searchForm.keyword"
          placeholder="搜索会议室名称、位置"
          :prefix-icon="Search"
          clearable
          style="width: 250px; margin-right: 12px;"
          @keyup.enter="fetchRooms"
        />
        <el-select v-model="searchForm.capacity" placeholder="容量筛选" clearable style="width: 150px; margin-right: 12px;">
          <el-option label="可容纳10人以上" :value="10" />
          <el-option label="可容纳20人以上" :value="20" />
          <el-option label="可容纳30人以上" :value="30" />
          <el-option label="可容纳50人以上" :value="50" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="fetchRooms">搜索</el-button>
      </div>
    </div>

    <el-row :gutter="20">
      <el-col :xs="24" :sm="12" :md="8" :lg="6" v-for="room in roomList" :key="room.id">
        <el-card class="room-card" shadow="hover">
          <div class="room-image" @click="goToDetail(room.id)">
            <img :src="room.image_url || 'https://via.placeholder.com/400x250'" :alt="room.name" />
            <div class="room-status" :class="{ 'status-active': room.status === 1, 'status-inactive': room.status === 0 }">
              {{ room.status === 1 ? '可用' : '不可用' }}
            </div>
          </div>
          <div class="room-info">
            <h3 class="room-name">{{ room.name }}</h3>
            <div class="room-meta">
              <span class="meta-item">
                <el-icon><User /></el-icon>
                容纳 {{ room.capacity }} 人
              </span>
              <span class="meta-item">
                <el-icon><Location /></el-icon>
                {{ room.location }}
              </span>
            </div>
            <div class="room-facilities">
              <el-tag
                v-for="(facility, index) in (room.facilities || '').split(',').slice(0, 4)" :key="index"
                size="small"
                type="info"
                effect="plain"
              >
                {{ facility.trim() }}
              </el-tag>
            </div>
            <div class="room-actions">
              <el-button type="primary" size="small" :disabled="room.status !== 1" @click="goToBooking(room.id)">
              <el-icon><Calendar /></el-icon>立即预约
              </el-button>
              <el-button size="small" @click="goToDetail(room.id)">详情</el-button>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <div class="pagination-container">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.page_size"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        :page-sizes="[8, 12, 20, 40]"
        @size-change="handleSizeChange"
        @current-change="fetchRooms"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Search, User, Location, Calendar } from '@element-plus/icons-vue'
import { getRoomList } from '@/api/room'

const router = useRouter()

const roomList = ref([])
const loading = ref(false)

const searchForm = reactive({
  keyword: '',
  capacity: null
})

const pagination = reactive({
  page: 1,
  page_size: 8,
  total: 0
})

async function fetchRooms() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.page_size,
      ...searchForm
    }
    if (!searchForm.capacity) delete params.capacity
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

function goToDetail(id) {
  router.push(`/rooms/${id}`)
}

function goToBooking(id) {
  router.push({ path: '/booking', query: { room_id: id } })
}

onMounted(() => {
  fetchRooms()
})
</script>

<style lang="scss" scoped>
.room-list {
  .room-card {
    margin-bottom: 20px;
    border-radius: 12px;
    overflow: hidden;

    .room-image {
      position: relative;
      height: 180px;
      overflow: hidden;
      cursor: pointer;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.3s;
      }

      &:hover img {
        transform: scale(1.05);
      }

      .room-status {
        position: absolute;
        top: 12px;
        right: 12px;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        color: #fff;

        &.status-active {
          background: #67C23A;
        }

        &.status-inactive {
          background: #F56C6C;
        }
      }
    }

    .room-info {
      padding: 16px;

      .room-name {
        margin: 0 0 12px 0;
        font-size: 18px;
        font-weight: 600;
        color: #303133;
      }

      .room-meta {
        display: flex;
        gap: 16px;
        margin-bottom: 12px;

        .meta-item {
          display: flex;
          align-items: center;
          font-size: 13px;
          color: #909399;

          .el-icon {
            margin-right: 4px;
          }
        }
      }

      .room-facilities {
        margin-bottom: 16px;
        min-height: 24px;

        .el-tag {
          margin-right: 6px;
          margin-bottom: 6px;
        }
      }

      .room-actions {
        display: flex;
        gap: 8px;
      }
    }
  }

  .pagination-container {
    margin-top: 20px;
    text-align: center;
  }
}
</style>
