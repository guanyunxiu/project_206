<template>
  <div class="page-container asset-list">
    <div class="page-header">
      <h2 class="page-title">资产列表</h2>
      <div class="search-bar">
        <el-input
          v-model="searchForm.keyword"
          placeholder="搜索资产名称"
          :prefix-icon="Search"
          clearable
          style="width: 250px; margin-right: 12px;"
          @keyup.enter="fetchAssets"
        />
        <el-select v-model="searchForm.category" placeholder="分类筛选" clearable style="width: 150px; margin-right: 12px;">
          <el-option label="投影仪" value="projector" />
          <el-option label="摄像机" value="camera" />
          <el-option label="白板" value="whiteboard" />
          <el-option label="麦克风" value="microphone" />
          <el-option label="其他" value="other" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="fetchAssets">搜索</el-button>
      </div>
    </div>

    <el-row :gutter="20">
      <el-col :xs="24" :sm="12" :md="8" :lg="6" v-for="asset in assetList" :key="asset.id">
        <el-card class="asset-card" shadow="hover">
          <div class="asset-header">
            <div class="asset-icon" :class="`icon-${asset.category}`">
              <el-icon :size="32">
                <component :is="getCategoryIcon(asset.category)" />
              </el-icon>
            </div>
            <el-tag :type="asset.available_quantity > 0 ? 'success' : 'danger'" size="small">
              {{ asset.available_quantity > 0 ? '可借' : '已借完' }}
            </el-tag>
          </div>
          <div class="asset-info">
            <h3 class="asset-name">{{ asset.name }}</h3>
            <div class="asset-category">
              <el-tag size="small" type="info">{{ asset.category_name }}</el-tag>
            </div>
            <p class="asset-desc">{{ asset.description }}</p>
            <div class="asset-stock">
              <div class="stock-item">
                <span class="stock-label">总数</span>
                <span class="stock-value">{{ asset.total_quantity }}</span>
              </div>
              <div class="stock-item">
                <span class="stock-label">可借</span>
                <span class="stock-value available">{{ asset.available_quantity }}</span>
              </div>
              <div class="stock-item">
                <span class="stock-label">已借</span>
                <span class="stock-value borrowed">{{ asset.total_quantity - asset.available_quantity }}</span>
              </div>
            </div>
            <div class="asset-action">
              <el-button
                type="primary"
                size="small"
                :disabled="asset.available_quantity === 0"
                @click="goToBooking(asset.id)"
              >
                预约借用
              </el-button>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <div class="pagination-container">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.page_size"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        :page-sizes="[8, 12, 20, 40]"
        @size-change="handleSizeChange"
        @current-change="fetchAssets"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Camera, VideoCamera, Edit, Microphone, Box } from '@element-plus/icons-vue'
import { getAssetList } from '@/api/asset'

const router = useRouter()

const assetList = ref([])
const loading = ref(false)

const searchForm = reactive({
  keyword: '',
  category: ''
})

const pagination = reactive({
  page: 1,
  page_size: 8,
  total: 0
})

function getCategoryIcon(category) {
  const iconMap = {
    'projector': VideoCamera,
    'camera': Camera,
    'whiteboard': Edit,
    'microphone': Microphone,
    'other': Box
  }
  return iconMap[category] || Box
}

async function fetchAssets() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.page_size,
      ...searchForm
    }
    if (!searchForm.category) delete params.category
    const res = await getAssetList(params)
    assetList.value = res.data.list
    pagination.total = res.data.total
  } catch (error) {
    console.error('Fetch assets failed:', error)
  } finally {
    loading.value = false
  }
}

function handleSizeChange(size) {
  pagination.page_size = size
  pagination.page = 1
  fetchAssets()
}

function goToBooking(assetId) {
  router.push({ path: '/booking', query: { asset_id: assetId } })
}

onMounted(() => {
  fetchAssets()
})
</script>

<style lang="scss" scoped>
.asset-list {
  .search-bar {
    display: flex;
    align-items: center;
  }

  .asset-card {
    margin-bottom: 20px;
    border-radius: 12px;

    .asset-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;

      .asset-icon {
        width: 64px;
        height: 64px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;

        &.icon-projector { background: linear-gradient(135deg, #667eea, #764ba2); }
        &.icon-camera { background: linear-gradient(135deg, #f093fb, #f5576c); }
        &.icon-whiteboard { background: linear-gradient(135deg, #4facfe, #00f2fe); }
        &.icon-microphone { background: linear-gradient(135deg, #43e97b, #38f9d7); }
        &.icon-other { background: linear-gradient(135deg, #fa709a, #fee140); }
      }
    }

    .asset-info {
      .asset-name {
        margin: 0 0 8px 0;
        font-size: 16px;
        font-weight: 600;
        color: #303133;
      }

      .asset-category {
        margin-bottom: 12px;
      }

      .asset-desc {
        margin: 0 0 16px 0;
        font-size: 13px;
        color: #606266;
        min-height: 36px;
        line-height: 1.5;
      }

      .asset-stock {
        display: flex;
        justify-content: space-around;
        padding: 12px;
        background: #f5f7fa;
        border-radius: 8px;
        margin-bottom: 16px;

        .stock-item {
          text-align: center;

          .stock-label {
            display: block;
            font-size: 12px;
            color: #909399;
            margin-bottom: 4px;
          }

          .stock-value {
            font-size: 18px;
            font-weight: 600;
            color: #303133;

            &.available { color: #67C23A; }
            &.borrowed { color: #E6A23C; }
          }
        }
      }

      .asset-action {
        text-align: center;
      }
    }
  }

  .pagination-container {
    margin-top: 20px;
    text-align: center;
  }
}
</style>
