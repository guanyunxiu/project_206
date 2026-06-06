<template>
  <div class="page-container notifications">
    <div class="page-header">
      <h2 class="page-title">
        消息通知
        <el-tag v-if="unreadCount > 0" type="danger" size="small" class="unread-badge">
          {{ unreadCount > 99 ? '99+' : unreadCount }} 条未读
        </el-tag>
      </h2>
      <div class="action-bar">
        <el-select v-model="filterForm.status" placeholder="状态筛选" clearable style="width: 150px; margin-right: 12px;" @change="handleFilterChange">
          <el-option label="未读" value="unread" />
          <el-option label="已读" value="read" />
        </el-select>
        <el-button type="primary" :icon="Check" @click="handleMarkAllAsRead" :disabled="unreadCount === 0">
          全部已读
        </el-button>
      </div>
    </div>

    <div v-loading="loading" class="notification-list">
      <div v-if="notificationList.length === 0" class="empty-state">
        <el-empty description="暂无消息通知" />
      </div>
      <div
        v-for="item in notificationList"
        :key="item.id"
        class="notification-item"
        :class="{ 'is-read': item.is_read }"
        @click="handleMarkAsRead(item)"
      >
        <div class="notification-icon">
          <el-badge :is-dot="!item.is_read" :hidden="item.is_read">
            <el-icon :size="24" :color="item.is_read ? '#909399' : '#409EFF'">
              <component :is="getNotificationIcon(item.type)" />
            </el-icon>
          </el-badge>
        </div>
        <div class="notification-content">
          <div class="notification-header">
            <span class="notification-title">{{ item.title }}</span>
            <span class="notification-time">{{ formatDateTime(item.created_at) }}</span>
          </div>
          <div class="notification-body">{{ item.content }}</div>
          <div class="notification-actions">
            <el-button
              v-if="!item.is_read"
              type="primary"
              size="small"
              link
              @click.stop="handleMarkAsRead(item)"
            >
              标记已读
            </el-button>
            <el-button
              type="danger"
              size="small"
              link
              @click.stop="handleDelete(item)"
            >
              删除
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <div class="pagination-container">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.page_size"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        :page-sizes="[10, 20, 50, 100]"
        @size-change="handleSizeChange"
        @current-change="fetchNotifications"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Bell, Warning, SuccessFilled, InfoFilled, CircleCloseFilled } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification
} from '@/api/notification'

const notificationList = ref([])
const loading = ref(false)
const unreadCount = ref(0)

const filterForm = reactive({
  status: ''
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

async function fetchNotifications() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.page_size,
      is_read: filterForm.status === 'unread' ? false : filterForm.status === 'read' ? true : undefined
    }
    const res = await getNotifications(params)
    notificationList.value = res.data.list
    pagination.total = res.data.total
  } catch (error) {
    console.error('Fetch notifications failed:', error)
  } finally {
    loading.value = false
  }
}

async function fetchUnreadCount() {
  try {
    const res = await getUnreadCount()
    unreadCount.value = res.data.count
  } catch (error) {
    console.error('Fetch unread count failed:', error)
  }
}

function handleFilterChange() {
  pagination.page = 1
  fetchNotifications()
}

function handleSizeChange(size) {
  pagination.page_size = size
  pagination.page = 1
  fetchNotifications()
}

function getNotificationIcon(type) {
  const iconMap = {
    'booking': Bell,
    'approval': InfoFilled,
    'warning': Warning,
    'success': SuccessFilled,
    'error': CircleCloseFilled,
    'info': InfoFilled
  }
  return iconMap[type] || Bell
}

function formatDateTime(datetime) {
  return datetime ? dayjs(datetime).format('YYYY-MM-DD HH:mm:ss') : '-'
}

async function handleMarkAsRead(item) {
  if (item.is_read) return
  try {
    await markAsRead(item.id)
    item.is_read = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  } catch (error) {
    console.error('Mark as read failed:', error)
  }
}

async function handleMarkAllAsRead() {
  if (unreadCount.value === 0) return
  ElMessageBox.confirm('确定要将所有消息标记为已读吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await markAllAsRead()
      ElMessage.success('已全部标记为已读')
      notificationList.value.forEach(item => {
        item.is_read = true
      })
      unreadCount.value = 0
    } catch (error) {
      console.error('Mark all as read failed:', error)
    }
  }).catch(() => {})
}

async function handleDelete(item) {
  ElMessageBox.confirm('确定要删除这条消息吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await deleteNotification(item.id)
      ElMessage.success('删除成功')
      if (!item.is_read) {
        unreadCount.value = Math.max(0, unreadCount.value - 1)
      }
      fetchNotifications()
    } catch (error) {
      console.error('Delete notification failed:', error)
    }
  }).catch(() => {})
}

onMounted(() => {
  fetchNotifications()
  fetchUnreadCount()
})
</script>

<style lang="scss" scoped>
.notifications {
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    .page-title {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #303133;
    }

    .unread-badge {
      font-weight: normal;
    }

    .action-bar {
      display: flex;
      align-items: center;
    }
  }

  .notification-list {
    background: #fff;
    border-radius: 8px;
    padding: 12px;

    .empty-state {
      padding: 60px 0;
    }

    .notification-item {
      display: flex;
      padding: 16px;
      border-radius: 8px;
      cursor: pointer;
      transition: background-color 0.2s;

      &:hover {
        background-color: #f5f7fa;
      }

      &.is-read {
        opacity: 0.7;
      }

      & + .notification-item {
        margin-top: 8px;
      }

      .notification-icon {
        flex-shrink: 0;
        margin-right: 16px;
        padding-top: 2px;
      }

      .notification-content {
        flex: 1;
        min-width: 0;

        .notification-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;

          .notification-title {
            font-size: 15px;
            font-weight: 600;
            color: #303133;
          }

          .notification-time {
            font-size: 12px;
            color: #909399;
            flex-shrink: 0;
            margin-left: 16px;
          }
        }

        .notification-body {
          font-size: 14px;
          color: #606266;
          line-height: 1.6;
          margin-bottom: 8px;
          word-break: break-word;
        }

        .notification-actions {
          display: flex;
          gap: 16px;
        }
      }
    }
  }

  .pagination-container {
    margin-top: 20px;
    text-align: right;
  }
}
</style>
