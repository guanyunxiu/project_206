<template>
  <div class="page-container admin-page">
    <div class="page-header">
      <h2 class="page-title">异常规则管理</h2>
      <el-button type="primary" :icon="Plus" @click="openAddDialog">新增规则</el-button>
    </div>

    <div class="search-bar">
      <el-input
        v-model="searchForm.keyword"
        placeholder="搜索规则名称"
        :prefix-icon="Search"
        clearable
        style="width: 250px; margin-right: 12px;"
        @keyup.enter="fetchRules"
      />
      <el-select v-model="searchForm.rule_type" placeholder="规则类型" clearable style="width: 150px; margin-right: 12px;">
        <el-option
          v-for="item in ruleTypeOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <el-select v-model="searchForm.is_enabled" placeholder="启用状态" clearable style="width: 120px; margin-right: 12px;">
        <el-option label="已启用" :value="1" />
        <el-option label="已禁用" :value="0" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="fetchRules">搜索</el-button>
    </div>

    <el-table :data="ruleList" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="rule_name" label="规则名称" min-width="150" />
      <el-table-column label="规则类型" width="120">
        <template #default="{ row }">
          <el-tag :type="getRuleTypeTag(row.rule_type)" size="small">
            {{ row.rule_type_name || getRuleTypeName(row.rule_type) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="触发阈值" width="100">
        <template #default="{ row }">{{ row.threshold }} 次</template>
      </el-table-column>
      <el-table-column label="时间窗口" width="100">
        <template #default="{ row }">{{ row.time_window }} 天</template>
      </el-table-column>
      <el-table-column label="处罚方式" width="140">
        <template #default="{ row }">
          <el-tag :type="getPenaltyTag(row.penalty_action)" size="small">
            {{ row.penalty_action_name || getPenaltyActionName(row.penalty_action) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="处罚时长" width="100">
        <template #default="{ row }">{{ row.penalty_duration }} 天</template>
      </el-table-column>
      <el-table-column label="是否启用" width="100">
        <template #default="{ row }">
          <el-switch
            v-model="row.is_enabled"
            :active-value="1"
            :inactive-value="0"
            @change="handleToggleEnabled(row)"
          />
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" min-width="150" show-overflow-tooltip />
      <el-table-column prop="created_at" label="创建时间" width="180" />
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" link @click="openEditDialog(row)">编辑</el-button>
          <el-button type="danger" size="small" link @click="handleDeleteRule(row)">删除</el-button>
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
        @current-change="fetchRules"
      />
    </div>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑规则' : '新增规则'" width="600px">
      <el-form :model="ruleForm" :rules="ruleRules" ref="ruleFormRef" label-width="120px">
        <el-form-item label="规则名称" prop="rule_name">
          <el-input v-model="ruleForm.rule_name" placeholder="请输入规则名称" />
        </el-form-item>
        <el-form-item label="规则类型" prop="rule_type">
          <el-select v-model="ruleForm.rule_type" placeholder="请选择规则类型" style="width: 100%;">
            <el-option
              v-for="item in ruleTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="触发阈值" prop="threshold">
          <el-input-number v-model="ruleForm.threshold" :min="1" :max="100" style="width: 100%;" />
          <span class="form-tip">在时间窗口内触发该次数即执行处罚</span>
        </el-form-item>
        <el-form-item label="时间窗口(天)" prop="time_window">
          <el-input-number v-model="ruleForm.time_window" :min="1" :max="365" style="width: 100%;" />
          <span class="form-tip">统计异常行为的时间范围</span>
        </el-form-item>
        <el-form-item label="处罚方式" prop="penalty_action">
          <el-select v-model="ruleForm.penalty_action" placeholder="请选择处罚方式" style="width: 100%;">
            <el-option
              v-for="item in penaltyOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="处罚时长(天)" prop="penalty_duration">
          <el-input-number v-model="ruleForm.penalty_duration" :min="1" :max="365" style="width: 100%;" />
          <span class="form-tip">处罚生效的持续时间</span>
        </el-form-item>
        <el-form-item label="是否启用" prop="is_enabled">
          <el-radio-group v-model="ruleForm.is_enabled">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="规则描述">
          <el-input
            v-model="ruleForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入规则描述"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveRule">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { getRules, getRule, createRule, updateRule, deleteRule } from '@/api/exceptionRule'

const ruleList = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const ruleFormRef = ref(null)
const currentId = ref(null)

const searchForm = reactive({
  keyword: '',
  rule_type: '',
  is_enabled: ''
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const ruleForm = reactive({
  rule_name: '',
  rule_type: '',
  threshold: 3,
  time_window: 30,
  penalty_action: '',
  penalty_duration: 7,
  is_enabled: 1,
  description: ''
})

const ruleRules = {
  rule_name: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  rule_type: [{ required: true, message: '请选择规则类型', trigger: 'change' }],
  threshold: [{ required: true, message: '请输入触发阈值', trigger: 'blur' }],
  time_window: [{ required: true, message: '请输入时间窗口', trigger: 'blur' }],
  penalty_action: [{ required: true, message: '请选择处罚方式', trigger: 'change' }],
  penalty_duration: [{ required: true, message: '请输入处罚时长', trigger: 'blur' }],
  is_enabled: [{ required: true, message: '请选择是否启用', trigger: 'change' }]
}

const ruleTypeOptions = [
  { label: '爽约会议', value: 'missed_meeting' },
  { label: '逾期归还', value: 'late_return' },
  { label: '预约冲突', value: 'booking_conflict' },
  { label: '超容预约', value: 'over_capacity' }
]

const penaltyOptions = [
  { label: '警告', value: 'warn' },
  { label: '限制预约', value: 'restrict_booking' },
  { label: '限制借用资产', value: 'restrict_assets' },
  { label: '禁用账户', value: 'disable_account' }
]

const ruleTypeMap = {
  missed_meeting: { text: '爽约会议', type: 'danger' },
  late_return: { text: '逾期归还', type: 'warning' },
  booking_conflict: { text: '预约冲突', type: 'info' },
  over_capacity: { text: '超容预约', type: 'primary' }
}

const penaltyMap = {
  warn: { text: '警告', type: 'info' },
  restrict_booking: { text: '限制预约', type: 'warning' },
  restrict_assets: { text: '限制借用资产', type: 'warning' },
  disable_account: { text: '禁用账户', type: 'danger' }
}

function getRuleTypeName(type) {
  return ruleTypeMap[type]?.text || type
}

function getRuleTypeTag(type) {
  return ruleTypeMap[type]?.type || 'info'
}

function getPenaltyActionName(action) {
  return penaltyMap[action]?.text || action
}

function getPenaltyTag(action) {
  return penaltyMap[action]?.type || 'info'
}

async function fetchRules() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.page_size,
      ...searchForm
    }
    if (!searchForm.rule_type) delete params.rule_type
    if (searchForm.is_enabled === '') delete params.is_enabled
    if (!searchForm.keyword) delete params.keyword

    const res = await getRules(params)
    ruleList.value = res.data.list
    pagination.total = res.data.total
  } catch (error) {
    console.error('Fetch rules failed:', error)
  } finally {
    loading.value = false
  }
}

function handleSizeChange(size) {
  pagination.page_size = size
  pagination.page = 1
  fetchRules()
}

function openAddDialog() {
  isEdit.value = false
  currentId.value = null
  Object.assign(ruleForm, {
    rule_name: '',
    rule_type: '',
    threshold: 3,
    time_window: 30,
    penalty_action: '',
    penalty_duration: 7,
    is_enabled: 1,
    description: ''
  })
  dialogVisible.value = true
}

async function openEditDialog(row) {
  isEdit.value = true
  currentId.value = row.id
  try {
    const res = await getRule(row.id)
    Object.assign(ruleForm, {
      rule_name: res.data.rule_name,
      rule_type: res.data.rule_type,
      threshold: res.data.threshold,
      time_window: res.data.time_window,
      penalty_action: res.data.penalty_action,
      penalty_duration: res.data.penalty_duration,
      is_enabled: res.data.is_enabled,
      description: res.data.description || ''
    })
    dialogVisible.value = true
  } catch (error) {
    console.error('Get rule failed:', error)
  }
}

async function saveRule() {
  if (!ruleFormRef.value) return

  await ruleFormRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true
      try {
        if (isEdit.value) {
          await updateRule(currentId.value, ruleForm)
          ElMessage.success('更新成功')
        } else {
          await createRule(ruleForm)
          ElMessage.success('创建成功')
        }
        dialogVisible.value = false
        fetchRules()
      } catch (error) {
        console.error('Save rule failed:', error)
      } finally {
        submitting.value = false
      }
    }
  })
}

async function handleToggleEnabled(row) {
  try {
    await updateRule(row.id, { is_enabled: row.is_enabled })
    ElMessage.success(row.is_enabled === 1 ? '已启用' : '已禁用')
  } catch (error) {
    console.error('Toggle enabled failed:', error)
    row.is_enabled = row.is_enabled === 1 ? 0 : 1
  }
}

async function handleDeleteRule(row) {
  ElMessageBox.confirm(`确定要删除规则「${row.rule_name}」吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await deleteRule(row.id)
      ElMessage.success('删除成功')
      fetchRules()
    } catch (error) {
      console.error('Delete rule failed:', error)
    }
  }).catch(() => {
    row.is_enabled = row.is_enabled === 1 ? 0 : 1
  })
}

onMounted(() => {
  fetchRules()
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

  .form-tip {
    display: block;
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
  }
}
</style>
