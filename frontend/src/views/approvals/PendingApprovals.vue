<template>
  <div class="page-container pending-approvals">
    <div class="page-header">
      <h2 class="page-title">待我审批</h2>
      <div class="filter-bar">
        <el-select v-model="filterForm.status" placeholder="状态筛选" clearable style="width: 150px; margin-right: 12px;">
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
      <el-table-column prop="applicant_name" label="申请人" width="100" />
      <el-table-column prop="created_at" label="申请时间" width="180">
        <template #default="{ row }">
          {{ formatDateTime(row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column label="审批状态" width="130">
        <template #default="{ row }">
          <el-tag :type="getStatusTagType(row.approval_status)" size="small">{{ getStatusName(row.approval_status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button type="success" size="small" link @click="handleApprove(row)">通过</el-button>
          <el-button type="danger" size="small" link @click="handleReject(row)">驳回</el-button>
          <el-button type="primary" size="small" link @click="viewDetail(row)">详情</el-button>
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

    <el-dialog v-model="approveDialogVisible" title="审批通过" width="500px">
      <el-form :model="approveForm" label-width="80px">
        <el-form-item label="审批意见">
          <el-input
            v-model="approveForm.comment"
            type="textarea"
            :rows="4"
            placeholder="请输入审批意见（选填）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitApprove">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="rejectDialogVisible" title="审批驳回" width="500px">
      <el-form :model="rejectForm" label-width="80px">
        <el-form-item label="驳回理由" required>
          <el-input
            v-model="rejectForm.comment"
            type="textarea"
            :rows="4"
            placeholder="请输入驳回理由（必填）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="submitReject">确定驳回</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useRouter } from 'vue-router'
import { getPendingApprovals, approveBooking, rejectBooking } from '@/api/approval'

const router = useRouter()

const approvalList = ref([])
const loading = ref(false)
const approveDialogVisible = ref(false)
const rejectDialogVisible = ref(false)
const currentApproval = ref(null)

const filterForm = reactive({
  status: '',
  date_range: []
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const approveForm = reactive({
  comment: ''
})

const rejectForm = reactive({
  comment: ''
})

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
    const res = await getPendingApprovals(params)
    approvalList.value = res.data.list
    pagination.total = res.data.total
  } catch (error) {
    console.error('Fetch pending approvals failed:', error)
  } finally {
    loading.value = false
  }
}

function handleSizeChange(size) {
  pagination.page_size = size
  pagination.page = 1
  fetchApprovals()
}

function getStatusTagType(status) {
  const typeMap = {
    'pending_dept': 'warning',
    'pending_admin': 'warning',
    'approved': 'success',
    'rejected': 'danger'
  }
  return typeMap[status] || 'info'
}

function getStatusName(status) {
  const nameMap = {
    'pending_dept': '等待部门审批',
    'pending_admin': '等待行政审批',
    'approved': '已通过',
    'rejected': '已驳回'
  }
  return nameMap[status] || status
}

function formatDateTime(datetime) {
  return datetime ? dayjs(datetime).format('YYYY-MM-DD HH:mm:ss') : '-'
}

function handleApprove(row) {
  currentApproval.value = row
  approveForm.comment = ''
  approveDialogVisible.value = true
}

async function submitApprove() {
  try {
    await approveBooking(currentApproval.value.id, { comment: approveForm.comment })
    ElMessage.success('审批通过成功')
    approveDialogVisible.value = false
    fetchApprovals()
  } catch (error) {
    console.error('Approve failed:', error)
  }
}

function handleReject(row) {
  currentApproval.value = row
  rejectForm.comment = ''
  rejectDialogVisible.value = true
}

async function submitReject() {
  if (!rejectForm.comment.trim()) {
    ElMessage.warning('请输入驳回理由')
    return
  }
  try {
    await rejectBooking(currentApproval.value.id, { comment: rejectForm.comment })
    ElMessage.success('审批驳回成功')
    rejectDialogVisible.value = false
    fetchApprovals()
  } catch (error) {
    console.error('Reject failed:', error)
  }
}

function viewDetail(row) {
  router.push(`/approvals/${row.id}`)
}

onMounted(() => {
  fetchApprovals()
})
</script>

<style lang="scss" scoped>
.pending-approvals {
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
