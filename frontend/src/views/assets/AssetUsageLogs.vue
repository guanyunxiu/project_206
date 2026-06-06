<template>
  <div class="page-container asset-usage-logs">
    <div class="page-header">
      <h2 class="page-title">资产使用日志</h2>
    </div>

    <div v-if="assetInfo" class="asset-info">
      <el-descriptions :column="4" border>
        <el-descriptions-item label="资产名称">{{ assetInfo.name }}</el-descriptions-item>
        <el-descriptions-item label="分类">{{ assetInfo.category_name }}</el-descriptions-item>
        <el-descriptions-item label="编号">{{ assetInfo.id }}</el-descriptions-item>
        <el-descriptions-item label="当前状态">
          <el-tag :type="assetInfo.status === 1 ? 'success' : 'danger'" size="small">
            {{ assetInfo.status === 1 ? '可用' : '不可用' }}
          </el-tag>
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <el-table :data="logList" v-loading="loading" stripe style="margin-top: 20px;">
      <el-table-column prop="id" label="记录编号" width="100" />
      <el-table-column prop="action" label="操作类型" width="100">
        <template #default="{ row }">
          <el-tag :type="getActionTagType(row.action)" size="small">
            {{ getActionName(row.action) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="user_name" label="操作人" width="120" />
      <el-table-column prop="action_time" label="操作时间" width="180">
        <template #default="{ row }">
          {{ formatDateTime(row.action_time) }}
        </template>
      </el-table-column>
      <el-table-column label="借用/归还日期" width="180">
        <template #default="{ row }">
          <div v-if="row.borrow_date">{{ row.borrow_date }}</div>
          <div v-else-if="row.return_date">{{ row.return_date }}</div>
          <div v-else>-</div>
        </template>
      </el-table-column>
      <el-table-column prop="quantity" label="数量" width="80" align="center" />
      <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.remark || '-' }}
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
        @current-change="fetchLogs"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import dayjs from 'dayjs'
import { getAssetList, getUsageLogs } from '@/api/asset'

const route = useRoute()

const assetInfo = ref(null)
const logList = ref([])
const loading = ref(false)

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const actionMap = {
  borrow: { name: '借用', type: 'primary' },
  return: { name: '归还', type: 'success' },
  repair: { name: '报修', type: 'warning' },
  scrap: { name: '报废', type: 'danger' }
}

async function fetchAssetInfo() {
  try {
    const assetId = route.params.assetId
    const res = await getAssetList({ id: assetId })
    if (res.data?.list?.length > 0) {
      assetInfo.value = res.data.list[0]
    }
  } catch (error) {
    console.error('Fetch asset info failed:', error)
  }
}

async function fetchLogs() {
  loading.value = true
  try {
    const assetId = route.params.assetId
    const params = {
      page: pagination.page,
      pageSize: pagination.page_size
    }
    const res = await getUsageLogs(assetId, params)
    logList.value = res.data.list
    pagination.total = res.data.total
  } catch (error) {
    console.error('Fetch usage logs failed:', error)
  } finally {
    loading.value = false
  }
}

function handleSizeChange(size) {
  pagination.page_size = size
  pagination.page = 1
  fetchLogs()
}

function getActionName(action) {
  return actionMap[action]?.name || action
}

function getActionTagType(action) {
  return actionMap[action]?.type || 'info'
}

function formatDateTime(datetime) {
  return datetime ? dayjs(datetime).format('YYYY-MM-DD HH:mm:ss') : '-'
}

onMounted(() => {
  fetchAssetInfo()
  fetchLogs()
})
</script>

<style lang="scss" scoped>
.asset-usage-logs {
  .pagination-container {
    margin-top: 20px;
    text-align: right;
  }
}
</style>
