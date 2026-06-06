<template>
  <div class="page-container admin-page">
    <div class="page-header">
      <h2 class="page-title">审批管理</h2>
      <el-radio-group v-model="activeTab" @change="handleTabChange" style="margin-left: 20px;">
        <el-radio-button value="pending">待审批</el-radio-button>
        <el-radio-button value="history">审批历史</el-radio-button>
      </el-radio-group>
    </div>

    <template v-if="activeTab === 'pending'">
      <el-table :data="pendingList" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="meeting_title" label="会议主题" min-width="150" show-overflow-tooltip />
        <el-table-column label="会议室" width="120">
          <template #default="{ row }">{{ row.room_name }}</template>
        </el-table-column>
        <el-table-column label="预约人" width="100">
          <template #default="{ row }">{{ row.user_name }}</template>
        </el-table-column>
        <el-table-column label="部门" width="120">
          <template #default="{ row }">{{ row.department_name }}</template>
        </el-table-column>
        <el-table-column label="预约日期" width="120">
          <template #default="{ row }">{{ row.date }}</template>
        </el-table-column>
        <el-table-column label="时间" width="130">
          <template #default="{ row }">
            {{ row.start_time }} - {{ row.end_time }}
          </template>
        </el-table-column>
        <el-table-column label="参会人数" width="100">
          <template #default="{ row }">{{ row.attendee_count }} 人</template>
        </el-table-column>
        <el-table-column label="会议类型" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.meeting_type === 'large' ? 'danger' : 'info'">
              {{ row.meeting_type_name }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="审批状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getApprovalStatusType(row.approval_status)" size="small">
              {{ row.approval_status_name }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" link @click="viewDetail(row)">详情</el-button>
            <el-button type="success" size="small" link @click="handleApprove(row)">通过</el-button>
            <el-button type="danger" size="small" link @click="handleReject(row)">驳回</el-button>
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
          @current-change="fetchPendingApprovals"
        />
      </div>
    </template>

    <template v-else>
      <div class="search-bar">
        <el-input
          v-model="searchForm.keyword"
          placeholder="搜索会议主题、预约人"
          :prefix-icon="Search"
          clearable
          style="width: 250px; margin-right: 12px;"
          @keyup.enter="fetchHistoryApprovals"
        />
        <el-select v-model="searchForm.status" placeholder="审批状态" clearable style="width: 150px; margin-right: 12px;">
          <el-option label="已通过" value="approved" />
          <el-option label="已驳回" value="rejected" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="fetchHistoryApprovals">搜索</el-button>
      </div>

      <el-table :data="historyList" v-loading="historyLoading" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="meeting_title" label="会议主题" min-width="150" show-overflow-tooltip />
        <el-table-column label="会议室" width="120">
          <template #default="{ row }">{{ row.room_name }}</template>
        </el-table-column>
        <el-table-column label="预约人" width="100">
          <template #default="{ row }">{{ row.user_name }}</template>
        </el-table-column>
        <el-table-column label="审批状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getApprovalStatusType(row.approval_status)" size="small">
              {{ row.approval_status_name }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="审批时间" width="180">
          <template #default="{ row }">
            <span v-if="row.approval_records && row.approval_records.length > 0">
              {{ row.approval_records[0].created_at }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="审批人" width="100">
          <template #default="{ row }">
            <span v-if="row.approval_records && row.approval_records.length > 0">
              {{ row.approval_records[0].approver_name }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" link @click="viewDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-pagination
          v-model:current-page="historyPagination.page"
          v-model:page-size="historyPagination.page_size"
          :total="historyPagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          :page-sizes="[10, 20, 50, 100]"
          @size-change="handleHistorySizeChange"
          @current-change="fetchHistoryApprovals"
        />
      </div>
    </template>

    <el-dialog v-model="detailVisible" title="预约详情" width="700px">
      <el-descriptions :column="2" border v-if="detailData.id">
        <el-descriptions-item label="会议主题" :span="2">{{ detailData.meeting_title }}</el-descriptions-item>
        <el-descriptions-item label="会议室">{{ detailData.room_name }}</el-descriptions-item>
        <el-descriptions-item label="位置">{{ detailData.room_location }}</el-descriptions-item>
        <el-descriptions-item label="预约人">{{ detailData.user_name }}</el-descriptions-item>
        <el-descriptions-item label="部门">{{ detailData.department_name }}</el-descriptions-item>
        <el-descriptions-item label="预约日期">{{ detailData.date }}</el-descriptions-item>
        <el-descriptions-item label="时间段">{{ detailData.start_time }} - {{ detailData.end_time }}</el-descriptions-item>
        <el-descriptions-item label="参会人数">{{ detailData.attendee_count }} 人</el-descriptions-item>
        <el-descriptions-item label="会议类型">
          <el-tag size="small" :type="detailData.meeting_type === 'large' ? 'danger' : 'info'">
            {{ detailData.meeting_type_name }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="预约状态">
          <el-tag :type="getStatusType(detailData.status)">{{ detailData.status_name }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="审批状态">
          <el-tag :type="getApprovalStatusType(detailData.approval_status)">
            {{ detailData.approval_status_name }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="跨部门">
          <el-tag :type="detailData.is_cross_department ? 'warning' : 'info'" size="small">
            {{ detailData.is_cross_department ? '是' : '否' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="会议描述" :span="2">{{ detailData.meeting_description || '无' }}</el-descriptions-item>
        <el-descriptions-item label="借用资产" :span="2">
          <span v-if="detailData.borrowings && detailData.borrowings.length">
            <el-tag v-for="item in detailData.borrowings" :key="item.id" style="margin-right: 8px;" size="small">
              {{ item.asset_name }} x{{ item.quantity }}
            </el-tag>
          </span>
          <span v-else>无</span>
        </el-descriptions-item>
      </el-descriptions>

      <el-divider content-position="left">审批历史</el-divider>
      <el-timeline v-if="detailData.approval_records && detailData.approval_records.length > 0">
        <el-timeline-item
          v-for="(record, index) in detailData.approval_records"
          :key="record.id"
          :timestamp="record.created_at"
          :type="record.status === 'approved' ? 'success' : 'danger'"
        >
          <h4 style="margin: 0 0 8px 0;">
            {{ record.status === 'approved' ? '审批通过' : '审批驳回' }}
            <el-tag size="small" style="margin-left: 8px;">
              {{ getApproverRoleText(record.approver_role) }}
            </el-tag>
          </h4>
          <p style="margin: 0;">
            审批人：{{ record.approver_name }}
          </p>
          <p v-if="record.comment" style="margin: 8px 0 0 0; color: #666;">
            意见：{{ record.comment }}
          </p>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="暂无审批记录" :image-size="80" />

      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <template v-if="activeTab === 'pending' && detailData.approval_status && detailData.approval_status.startsWith('pending')">
          <el-button type="success" @click="handleApprove(detailData)">通过</el-button>
          <el-button type="danger" @click="handleReject(detailData)">驳回</el-button>
        </template>
      </template>
    </el-dialog>

    <el-dialog v-model="rejectVisible" title="驳回预约" width="450px">
      <el-form :model="rejectForm" label-width="80px">
        <el-form-item label="驳回理由" required>
          <el-input
            v-model="rejectForm.comment"
            type="textarea"
            :rows="4"
            placeholder="请输入驳回理由"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="danger" :loading="actionLoading" @click="confirmReject">确认驳回</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { getPendingApprovals, getMyApprovals, approveBooking, rejectBooking } from '@/api/approval'
import { getBookingDetail } from '@/api/booking'

const activeTab = ref('pending')
const loading = ref(false)
const historyLoading = ref(false)
const actionLoading = ref(false)
const pendingList = ref([])
const historyList = ref([])
const detailVisible = ref(false)
const rejectVisible = ref(false)
const detailData = ref({})
const currentBooking = ref(null)

const searchForm = reactive({
  keyword: '',
  status: ''
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const historyPagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const rejectForm = reactive({
  comment: ''
})

const approvalStatusMap = {
  auto_approved: { text: '自动通过', type: 'success' },
  pending_dept: { text: '待部门审核', type: 'warning' },
  pending_admin: { text: '待行政确认', type: 'warning' },
  approved: { text: '已通过', type: 'success' },
  rejected: { text: '已驳回', type: 'danger' }
}

const statusMap = {
  pending: { text: '待使用', type: 'warning' },
  in_use: { text: '使用中', type: 'primary' },
  completed: { text: '已完成', type: 'success' },
  cancelled: { text: '已取消', type: 'info' },
  missed: { text: '已爽约', type: 'danger' }
}

function getApprovalStatusType(status) {
  return approvalStatusMap[status]?.type || 'info'
}

function getStatusType(status) {
  return statusMap[status]?.type || 'info'
}

function getApproverRoleText(role) {
  const roleMap = {
    dept_admin: '部门管理员',
    admin: '行政管理员'
  }
  return roleMap[role] || role
}

function handleTabChange() {
  if (activeTab.value === 'pending') {
    pagination.page = 1
    fetchPendingApprovals()
  } else {
    historyPagination.page = 1
    searchForm.keyword = ''
    searchForm.status = ''
    fetchHistoryApprovals()
  }
}

async function fetchPendingApprovals() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.page_size
    }
    const res = await getPendingApprovals(params)
    pendingList.value = res.data.list
    pagination.total = res.data.total
  } catch (error) {
    console.error('Fetch pending approvals failed:', error)
  } finally {
    loading.value = false
  }
}

async function fetchHistoryApprovals() {
  historyLoading.value = true
  try {
    const params = {
      page: historyPagination.page,
      pageSize: historyPagination.page_size,
      status: searchForm.status || undefined
    }
    const res = await getMyApprovals(params)
    let list = res.data.list
    if (searchForm.keyword) {
      const keyword = searchForm.keyword.toLowerCase()
      list = list.filter(item =>
        item.meeting_title?.toLowerCase().includes(keyword) ||
        item.user_name?.toLowerCase().includes(keyword)
      )
    }
    list = list.filter(item => item.approval_status === 'approved' || item.approval_status === 'rejected')
    historyList.value = list
    historyPagination.total = list.length
  } catch (error) {
    console.error('Fetch history approvals failed:', error)
  } finally {
    historyLoading.value = false
  }
}

function handleSizeChange(size) {
  pagination.page_size = size
  pagination.page = 1
  fetchPendingApprovals()
}

function handleHistorySizeChange(size) {
  historyPagination.page_size = size
  historyPagination.page = 1
  fetchHistoryApprovals()
}

async function viewDetail(row) {
  try {
    const res = await getBookingDetail(row.id)
    detailData.value = res.data
    detailVisible.value = true
  } catch (error) {
    console.error('Get detail failed:', error)
  }
}

function handleApprove(row) {
  ElMessageBox.confirm(`确定要通过预约「${row.meeting_title}」吗？`, '确认通过', {
    confirmButtonText: '确定通过',
    cancelButtonText: '取消',
    type: 'success'
  }).then(async () => {
    actionLoading.value = true
    try {
      await approveBooking(row.id, { comment: '' })
      ElMessage.success('审批通过成功')
      detailVisible.value = false
      fetchPendingApprovals()
    } catch (error) {
      console.error('Approve failed:', error)
    } finally {
      actionLoading.value = false
    }
  }).catch(() => {})
}

function handleReject(row) {
  currentBooking.value = row
  rejectForm.comment = ''
  rejectVisible.value = true
}

async function confirmReject() {
  if (!rejectForm.comment.trim()) {
    ElMessage.warning('请输入驳回理由')
    return
  }
  actionLoading.value = true
  try {
    await rejectBooking(currentBooking.value.id, { comment: rejectForm.comment })
    ElMessage.success('驳回成功')
    rejectVisible.value = false
    detailVisible.value = false
    fetchPendingApprovals()
  } catch (error) {
    console.error('Reject failed:', error)
  } finally {
    actionLoading.value = false
  }
}

onMounted(() => {
  fetchPendingApprovals()
})
</script>

<style lang="scss" scoped>
.admin-page {
  .page-header {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
  }

  .search-bar {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
  }

  .pagination-container {
    margin-top: 20px;
    text-align: right;
  }

  :deep(.el-timeline-item__content) {
    padding-left: 12px;
  }
}
</style>
