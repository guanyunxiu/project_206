<template>
  <div class="page-container violation-records">
    <el-row :gutter="20" class="stat-cards">
      <el-col :xs="12" :sm="12">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-info">
              <div class="stat-value danger-text">{{ violationCount }}</div>
              <div class="stat-label">当前爽约次数</div>
            </div>
            <div class="stat-icon" style="background-color: #F56C6C">
              <el-icon :size="28" color="#fff">
                <Warning />
              </el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="12">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-info">
              <div class="stat-value">{{ maxViolationCount }}</div>
              <div class="stat-label">最大允许次数</div>
            </div>
            <div class="stat-icon" style="background-color: #409EFF">
              <el-icon :size="28" color="#fff">
                <CircleCheck />
              </el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <div class="page-header">
      <h2 class="page-title">我的爽约记录</h2>
      <div class="filter-bar">
        <el-date-picker
          v-model="filterForm.date_range"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 300px; margin-right: 12px;"
          value-format="YYYY-MM-DD"
        />
        <el-button type="primary" :icon="Search" @click="fetchViolations">查询</el-button>
      </div>
    </div>

    <el-table :data="violationList" v-loading="loading" stripe>
      <el-table-column prop="id" label="记录编号" width="100" />
      <el-table-column prop="meeting_title" label="会议主题" min-width="150" show-overflow-tooltip />
      <el-table-column prop="room_name" label="会议室" min-width="120" />
      <el-table-column label="日期时间" width="280">
        <template #default="{ row }">
          <div>{{ row.date || '-' }}</div>
          <div style="color: #909399; font-size: 12px;">{{ row.start_time || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="violation_type_name" label="违规类型" width="120">
        <template #default="{ row }">
          <el-tag :type="getViolationTagType(row.violation_type)" size="small">
            {{ row.violation_type_name }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="记录时间" width="180">
        <template #default="{ row }">
          {{ formatDateTime(row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
    </el-table>

    <div class="pagination-container">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.page_size"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        :page-sizes="[10, 20, 50, 100]"
        @size-change="handleSizeChange"
        @current-change="fetchViolations"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { Search, Warning, CircleCheck } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { getMyViolations } from '@/api/checkin'
import { getSystemSettings } from '@/api/booking'

const violationList = ref([])
const loading = ref(false)
const violationCount = ref(0)
const maxViolationCount = ref(3)

const filterForm = reactive({
  date_range: []
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

async function fetchViolations() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.page_size,
      start_date: filterForm.date_range?.[0],
      end_date: filterForm.date_range?.[1]
    }
    const res = await getMyViolations(params)
    violationList.value = res.data.list
    pagination.total = res.data.total
    violationCount.value = res.data.violation_count || 0
  } catch (error) {
    console.error('Fetch violations failed:', error)
  } finally {
    loading.value = false
  }
}

async function fetchSystemSettings() {
  try {
    const res = await getSystemSettings()
    maxViolationCount.value = res.data.max_violation_count || 3
  } catch (error) {
    console.error('Fetch system settings failed:', error)
  }
}

function handleSizeChange(size) {
  pagination.page_size = size
  pagination.page = 1
  fetchViolations()
}

function getViolationTagType(type) {
  const typeMap = {
    'no_show': 'danger',
    'late_return': 'warning',
    'other': 'info'
  }
  return typeMap[type] || 'info'
}

function formatDateTime(datetime) {
  return datetime ? dayjs(datetime).format('YYYY-MM-DD HH:mm:ss') : '-'
}

onMounted(() => {
  fetchSystemSettings()
  fetchViolations()
})
</script>

<style lang="scss" scoped>
.violation-records {
  .stat-cards {
    margin-bottom: 20px;
  }

  .stat-card {
    .stat-content {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .stat-info {
        .stat-value {
          font-size: 28px;
          font-weight: 600;
          color: #303133;
          line-height: 1.2;

          &.danger-text {
            color: #F56C6C;
          }
        }

        .stat-label {
          font-size: 14px;
          color: #909399;
          margin-top: 4px;
        }
      }

      .stat-icon {
        width: 60px;
        height: 60px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
  }

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
