<template>
  <div class="page-container admin-page">
    <div class="page-header">
      <h2 class="page-title">报修管理</h2>
    </div>

    <div class="search-bar">
      <el-select v-model="searchForm.status" placeholder="状态筛选" clearable style="width: 150px; margin-right: 12px;">
        <el-option label="待处理" value="pending" />
        <el-option label="处理中" value="processing" />
        <el-option label="已解决" value="resolved" />
        <el-option label="无法修复" value="cannot_repair" />
      </el-select>
      <el-select v-model="searchForm.urgency" placeholder="紧急程度" clearable style="width: 150px; margin-right: 12px;">
        <el-option label="低" value="low" />
        <el-option label="中" value="medium" />
        <el-option label="高" value="high" />
      </el-select>
      <el-date-picker
        v-model="searchForm.dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        style="width: 280px; margin-right: 12px;"
      />
      <el-button type="primary" :icon="Search" @click="fetchRepairs">搜索</el-button>
    </div>

    <el-table :data="repairList" v-loading="loading" stripe>
      <el-table-column prop="id" label="报修编号" width="100" />
      <el-table-column prop="asset_name" label="资产名称" min-width="150" />
      <el-table-column prop="reporter_name" label="报修人" width="100" />
      <el-table-column label="紧急程度" width="100">
        <template #default="{ row }">
          <el-tag :type="getUrgencyType(row.urgency)" size="small">
            {{ getUrgencyText(row.urgency) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="故障描述" min-width="200" show-overflow-tooltip />
      <el-table-column prop="created_at" label="报修时间" width="180" />
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
            v-if="row.status === 'pending' || row.status === 'processing'"
            type="primary"
            size="small"
            link
            @click="openProcessDialog(row)"
          >处理</el-button>
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
        @current-change="fetchRepairs"
      />
    </div>

    <el-dialog v-model="processDialogVisible" title="处理报修" width="500px">
      <el-form :model="processForm" :rules="processRules" ref="processFormRef" label-width="100px">
        <el-form-item label="报修编号">
          <el-input v-model="currentRepair.id" disabled />
        </el-form-item>
        <el-form-item label="资产名称">
          <el-input v-model="currentRepair.asset_name" disabled />
        </el-form-item>
        <el-form-item label="故障描述">
          <el-input v-model="currentRepair.description" type="textarea" :rows="2" disabled />
        </el-form-item>
        <el-form-item label="处理结果" prop="result">
          <el-radio-group v-model="processForm.result">
            <el-radio value="resolved">已修复</el-radio>
            <el-radio value="cannot_repair">无法修复</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="处理备注" prop="remark">
          <el-input
            v-model="processForm.remark"
            type="textarea"
            :rows="3"
            placeholder="请输入处理备注"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="processDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleProcess">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { getRepairList, processRepair } from '@/api/asset'

const repairList = ref([])
const loading = ref(false)
const processDialogVisible = ref(false)
const submitting = ref(false)
const processFormRef = ref(null)
const currentRepair = ref({})

const searchForm = reactive({
  status: '',
  urgency: '',
  dateRange: []
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const processForm = reactive({
  result: 'resolved',
  remark: ''
})

const processRules = {
  result: [{ required: true, message: '请选择处理结果', trigger: 'change' }],
  remark: [{ required: true, message: '请输入处理备注', trigger: 'blur' }]
}

const statusMap = {
  pending: { text: '待处理', type: 'warning' },
  processing: { text: '处理中', type: 'primary' },
  resolved: { text: '已解决', type: 'success' },
  cannot_repair: { text: '无法修复', type: 'danger' }
}

const urgencyMap = {
  low: { text: '低', type: 'info' },
  medium: { text: '中', type: 'warning' },
  high: { text: '高', type: 'danger' }
}

function getStatusText(status) {
  return statusMap[status]?.text || status
}

function getStatusType(status) {
  return statusMap[status]?.type || 'info'
}

function getUrgencyText(urgency) {
  return urgencyMap[urgency]?.text || urgency
}

function getUrgencyType(urgency) {
  return urgencyMap[urgency]?.type || 'info'
}

async function fetchRepairs() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.page_size,
      status: searchForm.status || undefined,
      urgency: searchForm.urgency || undefined
    }
    if (searchForm.dateRange && searchForm.dateRange.length === 2) {
      params.start_date = searchForm.dateRange[0]
      params.end_date = searchForm.dateRange[1]
    }
    const res = await getRepairList(params)
    repairList.value = res.data.list
    pagination.total = res.data.total
  } catch (error) {
    console.error('Fetch repairs failed:', error)
  } finally {
    loading.value = false
  }
}

function handleSizeChange(size) {
  pagination.page_size = size
  pagination.page = 1
  fetchRepairs()
}

function openProcessDialog(row) {
  currentRepair.value = { ...row }
  Object.assign(processForm, {
    result: 'resolved',
    remark: ''
  })
  processDialogVisible.value = true
}

async function handleProcess() {
  if (!processFormRef.value) return
  
  await processFormRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true
      try {
        await processRepair(currentRepair.value.id, {
          status: processForm.result,
          remark: processForm.remark
        })
        ElMessage.success('处理成功')
        processDialogVisible.value = false
        fetchRepairs()
      } catch (error) {
        console.error('Process repair failed:', error)
      } finally {
        submitting.value = false
      }
    }
  })
}

onMounted(() => {
  fetchRepairs()
})
</script>

<style lang="scss" scoped>
.admin-page {
  .search-bar {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
  }

  .pagination-container {
    margin-top: 20px;
    text-align: right;
  }
}
</style>
