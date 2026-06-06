<template>
  <div class="page-container admin-page">
    <div class="page-header">
      <h2 class="page-title">逾期资产管理</h2>
      <el-button type="danger" :icon="Warning" :loading="processingOverdue" @click="handleBatchProcess">
        批量处理逾期
      </el-button>
    </div>

    <div class="search-bar">
      <el-input
        v-model="searchForm.keyword"
        placeholder="搜索资产名称/借用人"
        :prefix-icon="Search"
        clearable
        style="width: 250px; margin-right: 12px;"
        @keyup.enter="fetchOverdueRecords"
      />
      <el-select v-model="searchForm.reminder_status" placeholder="提醒状态" clearable style="width: 150px; margin-right: 12px;">
        <el-option label="未提醒" :value="0" />
        <el-option label="已提醒" :value="1" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="fetchOverdueRecords">搜索</el-button>
      <el-button :icon="Refresh" @click="resetSearch">重置</el-button>
    </div>

    <div class="stat-bar">
      <el-card class="stat-card" shadow="hover">
        <div class="stat-content">
          <div class="stat-label">逾期资产总数</div>
          <div class="stat-value text-danger">{{ stats.total }}</div>
        </div>
      </el-card>
      <el-card class="stat-card" shadow="hover">
        <div class="stat-content">
          <div class="stat-label">逾期超过7天</div>
          <div class="stat-value text-warning">{{ stats.over7days }}</div>
        </div>
      </el-card>
      <el-card class="stat-card" shadow="hover">
        <div class="stat-content">
          <div class="stat-label">已提醒</div>
          <div class="stat-value text-primary">{{ stats.reminded }}</div>
        </div>
      </el-card>
      <el-card class="stat-card" shadow="hover">
        <div class="stat-content">
          <div class="stat-label">未提醒</div>
          <div class="stat-value text-info">{{ stats.unreminded }}</div>
        </div>
      </el-card>
    </div>

    <el-table 
      :data="overdueList" 
      v-loading="loading" 
      stripe 
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="asset_name" label="资产名称" min-width="150">
        <template #default="{ row }">
          <span class="asset-name">{{ row.asset_name }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="borrower_name" label="借用人" width="120" />
      <el-table-column prop="borrower_department" label="所属部门" width="150" />
      <el-table-column prop="borrow_time" label="借用时间" width="180" />
      <el-table-column prop="expected_return_time" label="预计归还时间" width="180" />
      <el-table-column prop="overdue_days" label="逾期天数" width="120" align="center">
        <template #default="{ row }">
          <el-tag :type="row.overdue_days > 7 ? 'danger' : 'warning'" size="small">
            {{ row.overdue_days }} 天
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="reminder_status" label="提醒状态" width="120" align="center">
        <template #default="{ row }">
          <el-tag :type="row.reminder_status === 1 ? 'success' : 'info'" size="small">
            {{ row.reminder_status === 1 ? '已提醒' : '未提醒' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="reminder_count" label="提醒次数" width="100" align="center" />
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button 
            type="primary" 
            size="small" 
            link 
            :icon="Bell"
            :disabled="row.reminder_status === 1"
            :loading="sendingReminderId === row.id"
            @click="handleSendReminder(row)"
          >
            发送提醒
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
        @current-change="fetchOverdueRecords"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Warning, Bell, Refresh } from '@element-plus/icons-vue'
import { getOverdueRecords, sendReminder, processOverdue } from '@/api/assetAdvanced'

const overdueList = ref([])
const loading = ref(false)
const processingOverdue = ref(false)
const sendingReminderId = ref(null)
const selectedRows = ref([])

const searchForm = reactive({
  keyword: '',
  reminder_status: ''
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const stats = reactive({
  total: 0,
  over7days: 0,
  reminded: 0,
  unreminded: 0
})

function computeStats() {
  stats.total = pagination.total
  stats.over7days = overdueList.value.filter(item => item.overdue_days > 7).length
  stats.reminded = overdueList.value.filter(item => item.reminder_status === 1).length
  stats.unreminded = overdueList.value.filter(item => item.reminder_status === 0).length
}

async function fetchOverdueRecords() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.page_size,
      ...searchForm
    }
    if (searchForm.keyword === '') delete params.keyword
    if (searchForm.reminder_status === '') delete params.reminder_status
    
    const res = await getOverdueRecords(params)
    overdueList.value = res.data.list || []
    pagination.total = res.data.total || 0
    computeStats()
  } catch (error) {
    console.error('Fetch overdue records failed:', error)
    ElMessage.error('获取逾期记录失败')
  } finally {
    loading.value = false
  }
}

function handleSizeChange(size) {
  pagination.page_size = size
  pagination.page = 1
  fetchOverdueRecords()
}

function resetSearch() {
  searchForm.keyword = ''
  searchForm.reminder_status = ''
  pagination.page = 1
  fetchOverdueRecords()
}

function handleSelectionChange(rows) {
  selectedRows.value = rows
}

async function handleSendReminder(row) {
  ElMessageBox.confirm(
    `确定要向「${row.borrower_name}」发送资产「${row.asset_name}」的归还提醒吗？`,
    '发送提醒',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    sendingReminderId.value = row.id
    try {
      await sendReminder(row.id)
      ElMessage.success('提醒发送成功')
      fetchOverdueRecords()
    } catch (error) {
      console.error('Send reminder failed:', error)
      ElMessage.error('提醒发送失败')
    } finally {
      sendingReminderId.value = null
    }
  }).catch(() => {})
}

async function handleBatchProcess() {
  const count = selectedRows.value.length
  const message = count > 0 
    ? `确定要批量处理选中的 ${count} 条逾期记录吗？`
    : '确定要批量处理所有逾期记录吗？'
  
  ElMessageBox.confirm(message, '批量处理逾期', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    processingOverdue.value = true
    try {
      await processOverdue()
      ElMessage.success('批量处理成功')
      fetchOverdueRecords()
    } catch (error) {
      console.error('Process overdue failed:', error)
      ElMessage.error('批量处理失败')
    } finally {
      processingOverdue.value = false
    }
  }).catch(() => {})
}

onMounted(() => {
  fetchOverdueRecords()
})
</script>

<style lang="scss" scoped>
.admin-page {
  .search-bar {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
  }

  .stat-bar {
    display: flex;
    gap: 16px;
    margin-bottom: 20px;

    .stat-card {
      flex: 1;

      .stat-content {
        text-align: center;

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
    }
  }

  .pagination-container {
    margin-top: 20px;
    text-align: right;
  }

  .text-danger {
    color: #F56C6C;
  }

  .text-warning {
    color: #E6A23C;
  }

  .text-primary {
    color: #409EFF;
  }

  .text-info {
    color: #909399;
  }

  .asset-name {
    font-weight: 500;
  }
}
</style>
