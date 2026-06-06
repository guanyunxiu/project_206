<template>
  <div class="page-container admin-page">
    <div class="page-header">
      <h2 class="page-title">系统设置</h2>
    </div>

    <el-form :model="settingsForm" :rules="settingsRules" ref="settingsFormRef" label-width="180px" v-loading="loading">
      <el-card class="settings-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span class="card-title">签到设置</span>
          </div>
        </template>
        <el-form-item label="签到宽限时间（分钟）" prop="checkin_grace_minutes">
          <el-input-number
            v-model="settingsForm.checkin_grace_minutes"
            :min="1"
            :max="60"
            :step="1"
            style="width: 200px;"
          />
          <span class="form-tip">会议开始后多少分钟内签到仍有效</span>
        </el-form-item>
      </el-card>

      <el-card class="settings-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span class="card-title">爽约规则</span>
          </div>
        </template>
        <el-form-item label="最大爽约次数" prop="max_violation_count">
          <el-input-number
            v-model="settingsForm.max_violation_count"
            :min="1"
            :max="10"
            :step="1"
            style="width: 200px;"
          />
          <span class="form-tip">达到此次数后将限制预约</span>
        </el-form-item>
        <el-form-item label="爽约自动重置天数" prop="violation_reset_days">
          <el-input-number
            v-model="settingsForm.violation_reset_days"
            :min="7"
            :max="365"
            :step="1"
            style="width: 200px;"
          />
          <span class="form-tip">多少天后爽约记录自动清零</span>
        </el-form-item>
      </el-card>

      <el-card class="settings-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span class="card-title">资产设置</span>
          </div>
        </template>
        <el-form-item label="资产借用归还期限（天）" prop="asset_return_days">
          <el-input-number
            v-model="settingsForm.asset_return_days"
            :min="1"
            :max="30"
            :step="1"
            style="width: 200px;"
          />
          <span class="form-tip">资产借用后需在此期限内归还</span>
        </el-form-item>
        <el-form-item label="逾期提醒提前天数" prop="overdue_remind_days">
          <el-input-number
            v-model="settingsForm.overdue_remind_days"
            :min="1"
            :max="7"
            :step="1"
            style="width: 200px;"
          />
          <span class="form-tip">到期前多少天开始提醒</span>
        </el-form-item>
      </el-card>

      <el-card class="settings-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span class="card-title">审批设置</span>
          </div>
        </template>
        <el-form-item label="大型会议人数阈值" prop="large_meeting_threshold">
          <el-input-number
            v-model="settingsForm.large_meeting_threshold"
            :min="5"
            :max="100"
            :step="1"
            style="width: 200px;"
          />
          <span class="form-tip">参会人数达到此值视为大型会议</span>
        </el-form-item>
        <el-form-item label="需要审批的会议室类型" prop="approval_required_room_types">
          <el-select
            v-model="settingsForm.approval_required_room_types"
            multiple
            placeholder="请选择需要审批的会议室类型"
            style="width: 400px;"
          >
            <el-option label="小型会议室" value="small" />
            <el-option label="中型会议室" value="medium" />
            <el-option label="大型会议室" value="large" />
            <el-option label="培训室" value="training" />
          </el-select>
          <span class="form-tip">选择后，预约该类型会议室需要审批</span>
        </el-form-item>
      </el-card>

      <div class="form-actions">
        <el-button type="primary" :loading="submitting" @click="saveSettings">保存设置</el-button>
        <el-button @click="resetSettings">重置</el-button>
      </div>
    </el-form>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getSystemSettings, updateSystemSettings } from '@/api/booking'

const loading = ref(false)
const submitting = ref(false)
const settingsFormRef = ref(null)

const defaultSettings = {
  checkin_grace_minutes: 15,
  max_violation_count: 3,
  violation_reset_days: 30,
  asset_return_days: 3,
  overdue_remind_days: 1,
  large_meeting_threshold: 20,
  approval_required_room_types: ['large', 'training']
}

const settingsForm = reactive({ ...defaultSettings })

const settingsRules = {
  checkin_grace_minutes: [
    { required: true, message: '请输入签到宽限时间', trigger: 'blur' },
    { type: 'number', min: 1, max: 60, message: '范围为1-60分钟', trigger: 'blur' }
  ],
  max_violation_count: [
    { required: true, message: '请输入最大爽约次数', trigger: 'blur' },
    { type: 'number', min: 1, max: 10, message: '范围为1-10次', trigger: 'blur' }
  ],
  violation_reset_days: [
    { required: true, message: '请输入爽约自动重置天数', trigger: 'blur' },
    { type: 'number', min: 7, max: 365, message: '范围为7-365天', trigger: 'blur' }
  ],
  asset_return_days: [
    { required: true, message: '请输入资产借用归还期限', trigger: 'blur' },
    { type: 'number', min: 1, max: 30, message: '范围为1-30天', trigger: 'blur' }
  ],
  overdue_remind_days: [
    { required: true, message: '请输入逾期提醒提前天数', trigger: 'blur' },
    { type: 'number', min: 1, max: 7, message: '范围为1-7天', trigger: 'blur' }
  ],
  large_meeting_threshold: [
    { required: true, message: '请输入大型会议人数阈值', trigger: 'blur' },
    { type: 'number', min: 5, max: 100, message: '范围为5-100人', trigger: 'blur' }
  ],
  approval_required_room_types: [
    { required: true, message: '请选择需要审批的会议室类型', trigger: 'change' }
  ]
}

async function fetchSettings() {
  loading.value = true
  try {
    const res = await getSystemSettings()
    if (res.data) {
      Object.assign(settingsForm, {
        ...defaultSettings,
        ...res.data
      })
    }
  } catch (error) {
    console.error('Fetch settings failed:', error)
    ElMessage.error('获取系统设置失败')
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  if (!settingsFormRef.value) return

  await settingsFormRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true
      try {
        await updateSystemSettings(settingsForm)
        ElMessage.success('系统设置保存成功')
      } catch (error) {
        console.error('Save settings failed:', error)
      } finally {
        submitting.value = false
      }
    }
  })
}

function resetSettings() {
  if (settingsFormRef.value) {
    settingsFormRef.value.resetFields()
  }
}

onMounted(() => {
  fetchSettings()
})
</script>

<style lang="scss" scoped>
.admin-page {
  .settings-card {
    margin-bottom: 20px;

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .card-title {
        font-size: 16px;
        font-weight: 600;
        color: #303133;
      }
    }

    :deep(.el-form-item) {
      margin-bottom: 22px;
    }

    .form-tip {
      margin-left: 12px;
      color: #909399;
      font-size: 13px;
    }
  }

  .form-actions {
    padding: 20px 0;
    text-align: center;

    .el-button + .el-button {
      margin-left: 12px;
    }
  }
}
</style>
