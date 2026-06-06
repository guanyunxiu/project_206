<template>
  <div class="page-container asset-repair">
    <div class="page-header">
      <h2 class="page-title">资产报修</h2>
    </div>

    <el-row :gutter="20">
      <el-col :lg="8" :md="12" :xs="24">
        <el-card class="info-card" v-loading="loading">
          <div class="card-title">资产信息</div>
          <el-descriptions v-if="asset" :column="1" border size="small">
            <el-descriptions-item label="资产名称">{{ asset.name }}</el-descriptions-item>
            <el-descriptions-item label="资产分类">
              <el-tag size="small" type="info">{{ asset.category_name }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="资产编号">{{ asset.asset_no || asset.id }}</el-descriptions-item>
            <el-descriptions-item label="当前状态">
              <el-tag :type="getStatusTagType(asset.status)" size="small">
                {{ asset.status_name || getStatusText(asset.status) }}
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>
          <el-empty v-else description="加载中..." />
        </el-card>
      </el-col>

      <el-col :lg="16" :md="12" :xs="24">
        <el-card class="form-card" v-loading="submitting">
          <div class="card-title">报修信息</div>
          <el-form
            :model="repairForm"
            :rules="repairRules"
            ref="repairFormRef"
            label-width="100px"
          >
            <el-form-item label="故障描述" prop="description">
              <el-input
                v-model="repairForm.description"
                type="textarea"
                :rows="5"
                placeholder="请详细描述故障情况..."
                maxlength="500"
                show-word-limit
              />
            </el-form-item>

            <el-form-item label="故障图片">
              <el-upload
                v-model:file-list="fileList"
                :action="uploadUrl"
                :headers="uploadHeaders"
                list-type="picture-card"
                :limit="3"
                :on-exceed="handleExceed"
                :on-success="handleUploadSuccess"
                :on-remove="handleUploadRemove"
                :before-upload="beforeUpload"
                accept="image/*"
              >
                <el-icon><Plus /></el-icon>
                <template #tip>
                  <div class="el-upload__tip">最多上传3张图片，支持 jpg、png 格式</div>
                </template>
              </el-upload>
            </el-form-item>

            <el-form-item label="紧急程度" prop="priority">
              <el-radio-group v-model="repairForm.priority">
                <el-radio-button value="low">
                  <el-tag type="info" size="small" effect="dark">低</el-tag>
                </el-radio-button>
                <el-radio-button value="medium">
                  <el-tag type="warning" size="small" effect="dark">中</el-tag>
                </el-radio-button>
                <el-radio-button value="high">
                  <el-tag type="danger" size="small" effect="dark">高</el-tag>
                </el-radio-button>
              </el-radio-group>
            </el-form-item>

            <el-form-item>
              <el-button @click="resetForm">重置</el-button>
              <el-button type="primary" :loading="submitting" @click="submitRepair">
                提交报修
              </el-button>
              <el-button @click="goBack">返回</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { getAssetList, createRepair } from '@/api/asset'

const route = useRoute()
const router = useRouter()

const assetId = parseInt(route.params.id)
const loading = ref(false)
const submitting = ref(false)
const asset = ref(null)
const repairFormRef = ref(null)
const fileList = ref([])

const uploadUrl = '/api/upload'
const uploadHeaders = {
  Authorization: `Bearer ${localStorage.getItem('token')}`
}

const repairForm = reactive({
  asset_id: assetId,
  description: '',
  images: [],
  priority: 'medium'
})

const repairRules = {
  description: [
    { required: true, message: '请输入故障描述', trigger: 'blur' },
    { min: 10, message: '故障描述至少10个字符', trigger: 'blur' }
  ],
  priority: [
    { required: true, message: '请选择紧急程度', trigger: 'change' }
  ]
}

function getStatusTagType(status) {
  const typeMap = {
    'available': 'success',
    'in_use': 'warning',
    'repairing': 'danger',
    'damaged': 'danger',
    'lost': 'info'
  }
  return typeMap[status] || 'info'
}

function getStatusText(status) {
  const textMap = {
    'available': '可用',
    'in_use': '使用中',
    'repairing': '维修中',
    'damaged': '已损坏',
    'lost': '已丢失'
  }
  return textMap[status] || status
}

async function fetchAssetDetail() {
  loading.value = true
  try {
    const res = await getAssetList({ id: assetId })
    if (res.data?.list?.length > 0) {
      asset.value = res.data.list[0]
    }
  } catch (error) {
    console.error('Fetch asset detail failed:', error)
  } finally {
    loading.value = false
  }
}

function beforeUpload(file) {
  const isImage = file.type.startsWith('image/')
  const isLt2M = file.size / 1024 / 1024 < 2

  if (!isImage) {
    ElMessage.error('只能上传图片文件!')
    return false
  }
  if (!isLt2M) {
    ElMessage.error('图片大小不能超过 2MB!')
    return false
  }
  return true
}

function handleExceed(files, fileList) {
  ElMessage.warning(`最多只能上传3张图片`)
}

function handleUploadSuccess(response, uploadFile) {
  if (response.code === 200 && response.data?.url) {
    repairForm.images.push(response.data.url)
  } else {
    ElMessage.error('上传失败')
  }
}

function handleUploadRemove(uploadFile) {
  const index = fileList.value.indexOf(uploadFile)
  if (index > -1) {
    repairForm.images.splice(index, 1)
  }
}

function resetForm() {
  repairForm.description = ''
  repairForm.images = []
  repairForm.priority = 'medium'
  fileList.value = []
  repairFormRef.value?.resetFields()
}

function goBack() {
  router.back()
}

async function submitRepair() {
  if (!repairFormRef.value) return

  await repairFormRef.value.validate(async (valid) => {
    if (!valid) return

    submitting.value = true
    try {
      await createRepair({
        asset_id: repairForm.asset_id,
        description: repairForm.description,
        images: repairForm.images,
        priority: repairForm.priority
      })
      ElMessage.success('报修提交成功')
      router.push('/my-assets')
    } catch (error) {
      console.error('Submit repair failed:', error)
    } finally {
      submitting.value = false
    }
  })
}

onMounted(() => {
  fetchAssetDetail()
})
</script>

<style lang="scss" scoped>
.asset-repair {
  .info-card,
  .form-card {
    margin-bottom: 20px;

    .card-title {
      font-size: 16px;
      font-weight: 600;
      color: #303133;
      margin-bottom: 20px;
    }
  }

  :deep(.el-upload--picture-card) {
    width: 100px;
    height: 100px;
    line-height: 100px;
  }

  :deep(.el-upload-list--picture-card .el-upload-list__item) {
    width: 100px;
    height: 100px;
  }

  .el-upload__tip {
    margin-top: 8px;
    font-size: 12px;
    color: #909399;
  }

  :deep(.el-radio-button__inner) {
    padding: 8px 16px;
  }

  :deep(.el-radio-button--medium .el-radio-button__inner) {
    padding: 8px 16px;
  }
}
</style>
