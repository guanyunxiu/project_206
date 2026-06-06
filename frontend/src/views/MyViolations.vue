<template>
  <div class="page-container my-violations">
    <div class="page-header">
      <h2 class="page-title">我的违规记录</h2>
    </div>

    <el-alert
      v-if="isBookingRestricted && restrictionInfo"
      :title="`预约功能已被限制`"
      type="error"
      :closable="false"
      show-icon
      style="margin-bottom: 20px;"
    >
      <template #default>
        <p>您在30天内已爽约 {{ restrictionInfo.violation_count }} 次，超过规则阈值 {{ restrictionInfo.threshold }} 次。</p>
        <p>根据「{{ restrictionInfo.rule_name }}」规则，您的预约功能将被限制 {{ restrictionInfo.penalty_duration }} 天。</p>
        <p>如有疑问，请联系管理员。</p>
      </template>
    </el-alert>

    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="12">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-icon missed">
              <el-icon><Warning /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.missed_count_30d }}</div>
              <div class="stat-label">30天内爽约次数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-icon late">
              <el-icon><Clock /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.late_return_count_30d }}</div>
              <div class="stat-label">30天内逾期次数</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <div class="filter-bar" style="margin-bottom: 16px;">
      <el-select v-model="filterForm.type" placeholder="违规类型筛选" clearable style="width: 180px; margin-right: 12px;">
        <el-option label="会议爽约" value="missed" />
        <el-option label="逾期归还" value="late_return" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="fetchViolations">查询</el-button>
    </div>

    <el-table :data="violationList" v-loading="loading" stripe>
      <el-table-column prop="id" label="记录编号" width="100" />
      <el-table-column prop="type_name" label="违规类型" width="120">
        <template #default="{ row }">
          <el-tag :type="getViolationTagType(row.type)" size="small">{{ row.type_name }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="违规描述" min-width="250" show-overflow-tooltip />
      <el-table-column prop="booking_id" label="关联预约" width="120">
        <template #default="{ row }">
          <span v-if="row.booking_id">#{{ row.booking_id }}</span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="记录时间" width="180">
        <template #default="{ row }">
          {{ formatDateTime(row.created_at) }}
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
        @current-change="fetchViolations"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { Search, Warning, Clock } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { getMyViolations } from '@/api/checkin'

const violationList = ref([])
const loading = ref(false)
const stats = reactive({
  missed_count_30d: 0,
  late_return_count_30d: 0
})
const isBookingRestricted = ref(false)
const restrictionInfo = ref(null)

const filterForm = reactive({
  type: ''
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
      type: filterForm.type || undefined
    }
    const res = await getMyViolations(params)
    violationList.value = res.data.list
    pagination.total = res.data.total
    stats.missed_count_30d = res.data.stats.missed_count_30d
    stats.late_return_count_30d = res.data.stats.late_return_count_30d
    isBookingRestricted.value = res.data.is_booking_restricted
    restrictionInfo.value = res.data.restriction_info
  } catch (error) {
    console.error('Fetch violations failed:', error)
  } finally {
    loading.value = false
  }
}

function handleSizeChange(size) {
  pagination.page_size = size
  pagination.page = 1
  fetchViolations()
}

function getViolationTagType(type) {
  const typeMap = {
    'missed': 'danger',
    'late_return': 'warning'
  }
  return typeMap[type] || 'info'
}

function formatDateTime(datetime) {
  return datetime ? dayjs(datetime).format('YYYY-MM-DD HH:mm:ss') : '-'
}

onMounted(() => {
  fetchViolations()
})
</script>

<style lang="scss" scoped>
.my-violations {
  .filter-bar {
    display: flex;
    align-items: center;
  }

  .pagination-container {
    margin-top: 20px;
    text-align: right;
  }

  .stat-card {
    display: flex;
    align-items: center;
    padding: 10px 0;

    .stat-icon {
      width: 60px;
      height: 60px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 16px;

      .el-icon {
        font-size: 28px;
        color: #fff;
      }

      &.missed {
        background: linear-gradient(135deg, #f56c6c 0%, #f78989 100%);
      }

      &.late {
        background: linear-gradient(135deg, #e6a23c 0%, #ebb563 100%);
      }
    }

    .stat-info {
      .stat-value {
        font-size: 28px;
        font-weight: 600;
        color: #303133;
        line-height: 1.2;
      }

      .stat-label {
        font-size: 14px;
        color: #909399;
        margin-top: 4px;
      }
    }
  }
}
</style>
