<template>
  <div class="page-container admin-page">
    <div class="page-header">
      <h2 class="page-title">逾期资产管理</h2>
    </div>

    <el-row :gutter="20" class="stats-row">
      <el-col :span="8">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-label">逾期总数</div>
            <div class="stat-value text-primary">{{ stats.total }}</div>
          </div>
          <div class="stat-icon">
            <el-icon :size="48" color="#409EFF"><Warning /></el-icon>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-label">逾期30天以上</div>
            <div class="stat-value text-danger">{{ stats.over30Days }}</div>
          </div>
          <div class="stat-icon">
            <el-icon :size="48" color="#F56C6C"><BellFilled /></el-icon>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-label">已发送催还</div>
            <div class="stat-value text-success">{{ stats.reminded }}</div>
          </div>
          <div class="stat-icon">
            <el-icon :size="48" color="#67C23A"><Message /></el-icon>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <div class="search-bar">
      <el-date-picker
        v-model="searchForm.dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        style="width: 280px; margin-right: 12px;"
      />
      <el-button type="primary" :icon="Search" @click="fetchOverdueAssets">搜索</el-button>
      <el-button :icon="Refresh" @click="resetSearch">重置</el-button>
    </div>

    <div class="batch-actions">
      <el-button
        type="warning"
        :icon="Bell"
        :disabled="selectedIds.length === 0"
        @click="handleBatchRemind"
      >
        批量催还 ({{ selectedIds.length }})
      </el-button>
    </div>

    <el-table
      :data="overdueList"
      v-loading="loading"
      stripe
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="55" />
      <el-table-column prop="id" label="记录编号" width="100" />
      <el-table-column prop="asset_name" label="资产名称" min-width="150" />
      <el-table-column prop="borrower_name" label="借用人" width="100" />
      <el-table-column prop="borrow_date" label="借用日期" width="120" />
      <el-table-column prop="expected_return_date" label="应归还日期" width="120" />
      <el-table-column label="逾期天数" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="getOverdueDaysType(row.overdue_days)" size="small">
            {{ row.overdue_days }} 天
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)" size="small">
            {{ getStatusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button
            type="warning"
            size="small"
            link
            @click="handleRemind(row)"
          >催还</el-button>
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
        @current-change="fetchOverdueAssets"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Bell, Warning, BellFilled, Message } from '@element-plus/icons-vue'
import { getOverdueAssets, remindOverdue } from '@/api/asset'

const overdueList = ref([])
const loading = ref(false)
const selectedIds = ref([])

const stats = reactive({
  total: 0,
  over30Days: 0,
  reminded: 0
})

const searchForm = reactive({
  dateRange: []
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const statusMap = {
  borrowed: { text: '借用中', type: 'primary' },
  overdue: { text: '已逾期', type: 'danger' }
}

function getStatusText(status) {
  return statusMap[status]?.text || status
}

function getStatusType(status) {
  return statusMap[status]?.type || 'info'
}

function getOverdueDaysType(days) {
  if (days >= 7) return 'danger'
  return 'warning'
}

function calculateStats(list) {
  stats.total = pagination.total
  stats.over30Days = list.filter(item => item.overdue_days >= 30).length
  stats.reminded = list.filter(item => item.reminded).length
}

async function fetchOverdueAssets() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.page_size
    }
    if (searchForm.dateRange && searchForm.dateRange.length === 2) {
      params.start_date = searchForm.dateRange[0]
      params.end_date = searchForm.dateRange[1]
    }
    const res = await getOverdueAssets(params)
    overdueList.value = res.data.list
    pagination.total = res.data.total
    calculateStats(res.data.list)
  } catch (error) {
    console.error('Fetch overdue assets failed:', error)
  } finally {
    loading.value = false
  }
}

function handleSizeChange(size) {
  pagination.page_size = size
  pagination.page = 1
  fetchOverdueAssets()
}

function resetSearch() {
  searchForm.dateRange = []
  pagination.page = 1
  fetchOverdueAssets()
}

function handleSelectionChange(selection) {
  selectedIds.value = selection.map(item => item.id)
}

async function handleRemind(row) {
  ElMessageBox.confirm(`确定要向「${row.borrower_name}」发送催还通知吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await remindOverdue({ ids: [row.id] })
      ElMessage.success('催还通知发送成功')
      fetchOverdueAssets()
    } catch (error) {
      console.error('Remind failed:', error)
    }
  }).catch(() => {})
}

async function handleBatchRemind() {
  if (selectedIds.value.length === 0) {
    ElMessage.warning('请先选择要催还的记录')
    return
  }
  ElMessageBox.confirm(`确定要向选中的 ${selectedIds.value.length} 条记录发送催还通知吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await remindOverdue({ ids: selectedIds.value })
      ElMessage.success('批量催还通知发送成功')
      selectedIds.value = []
      fetchOverdueAssets()
    } catch (error) {
      console.error('Batch remind failed:', error)
    }
  }).catch(() => {})
}

onMounted(() => {
  fetchOverdueAssets()
})
</script>

<style lang="scss" scoped>
.admin-page {
  .stats-row {
    margin-bottom: 20px;
  }

  .stat-card {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .stat-content {
      .stat-label {
        font-size: 14px;
        color: #909399;
        margin-bottom: 8px;
      }

      .stat-value {
        font-size: 28px;
        font-weight: 600;
      }
    }

    .stat-icon {
      opacity: 0.8;
    }

    .text-primary {
      color: #409EFF;
    }

    .text-danger {
      color: #F56C6C;
    }

    .text-success {
      color: #67C23A;
    }
  }

  .search-bar {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
  }

  .batch-actions {
    margin-bottom: 16px;
  }

  .pagination-container {
    margin-top: 20px;
    text-align: right;
  }
}
</style>
